import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { PrismaService } from '../../src/core/database/prisma.service';

describe('Auth Local Flow E2E - Layer 3 Database Assertions', () => {
  let helper: TestAppHelper;
  let prisma: PrismaService;
  let httpServer: any;

  beforeAll(async () => {
    helper = new TestAppHelper();
    await helper.init();
    prisma = helper.getPrisma();
    httpServer = helper.getHttpServer();
  }, 30000);

  afterAll(async () => {
    await helper.cleanDatabase();
    await helper.close();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('Đăng ký tài khoản hợp lệ: Trả về HTTP 201 và lưu DB dang_ky_cho_xac_thuc + queue email', async () => {
      const registerPayload = {
        username: 'bs_minhtri',
        password: 'P@ssw0rd123!',
        fullName: 'Bác sĩ Nguyễn Minh Trí',
        email: 'bsminhtri@nutritest.com',
        phone: '0987654321',
        gender: 'NAM',
        address: 'Hà Nội',
        dob: '1990-05-15',
      };

      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .send(registerPayload)
        .expect(201);

      // 1. Kiểm tra Response Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.success).toBe(true);
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      // 2. LAYER 3 DB ASSERTION: Kiểm tra bảng dang_ky_cho_xac_thuc
      const pendingRecord = await prisma.dang_ky_cho_xac_thuc.findFirst({
        where: { ten_dang_nhap: 'bs_minhtri' },
      });
      expect(pendingRecord).not.toBeNull();
      expect(pendingRecord?.email).toBe('bsminhtri@nutritest.com');
      expect(pendingRecord?.ho_ten).toBe('Bác sĩ Nguyễn Minh Trí');
      expect(pendingRecord?.token_hash).toBeDefined();
      expect(pendingRecord?.token_hash.length).toBe(64); // SHA256 hex string
      expect(pendingRecord?.mat_khau_ma_hoa.startsWith('$2')).toBe(true); // Bcrypt hash

      // 3. LAYER 3 DB ASSERTION: Kiểm tra hàng đợi gửi email trong _system_jobs
      const emailJob = await prisma.systemJob.findFirst({
        where: { queueName: 'email' },
      });
      expect(emailJob).not.toBeNull();
      expect(emailJob?.status).toBe('PENDING');
      const jobPayload = JSON.parse(emailJob!.payload);
      expect(jobPayload.type).toBe('VERIFY_EMAIL');
      expect(jobPayload.email).toBe('bsminhtri@nutritest.com');
      expect(jobPayload.token).toBe(pendingRecord?.token_hash);
    });

    it('Đăng ký trùng username/email: Bị từ chối với HTTP 409 Conflict', async () => {
      await helper.createTestUser({
        username: 'user_duplicate',
        email: 'duplicate@nutritest.com',
      });

      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .send({
          username: 'user_duplicate',
          password: 'P@ssw0rd123!',
          fullName: 'Người Dùng Trùng Lặp',
          email: 'duplicate@nutritest.com',
          phone: '0987654321',
          gender: 'NAM',
        })
        .expect(409);

      expect(res.body).toHaveProperty('error');
      expect(res.body.meta).toHaveProperty('traceId');
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('Xác thực email qua token: Chuyển dữ liệu sang nguoi_dung & ho_so_ca_nhan, xóa dang_ky_cho_xac_thuc', async () => {
      // Chuẩn bị bản ghi chờ xác thực
      const registerPayload = {
        username: 'bs_verify',
        password: 'P@ssw0rd123!',
        fullName: 'Bác Sĩ Xác Thực',
        email: 'bsverify@nutritest.com',
        phone: '0912345678',
        gender: 'NU',
      };
      await request(httpServer).post('/api/v1/auth/register').send(registerPayload);

      const pending = await prisma.dang_ky_cho_xac_thuc.findFirst({
        where: { ten_dang_nhap: 'bs_verify' },
      });
      expect(pending).not.toBeNull();

      // Thực thi xác thực email
      const verifyRes = await request(httpServer)
        .post('/api/v1/auth/verify-email')
        .send({ token: pending!.token_hash })
        .expect(200);

      expect(verifyRes.body.data.success).toBe(true);

      // LAYER 3 DB ASSERTION:
      // a) Bản ghi chờ xác thực phải bị xóa
      const deletedPending = await prisma.dang_ky_cho_xac_thuc.findUnique({
        where: { token_hash: pending!.token_hash },
      });
      expect(deletedPending).toBeNull();

      // b) Người dùng mới phải được kích hoạt trong bảng nguoi_dung
      const newUser = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: 'bs_verify' },
      });
      expect(newUser).not.toBeNull();
      expect(newUser?.active).toBe(true);
      expect(newUser?.vai_tro).toBe('USER');

      // c) Hồ sơ cá nhân tương ứng được tạo lập
      const profile = await prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: newUser!.id },
      });
      expect(profile).not.toBeNull();
      expect(profile?.email).toBe('bsverify@nutritest.com');
      expect(profile?.ho_ten).toBe('Bác Sĩ Xác Thực');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('Đăng nhập thành công: Nhận Token và ghi nhận lich_su_dang_nhap trong DB', async () => {
      const { user, rawPassword } = await helper.createTestUser({
        username: 'user_login_test',
        password: 'P@ssw0rd123!',
      });

      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          username: 'user_login_test',
          password: rawPassword,
        })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.username).toBe('user_login_test');

      // LAYER 3 DB ASSERTION: Kiểm tra lịch sử đăng nhập
      const loginLog = await prisma.lich_su_dang_nhap.findFirst({
        where: { nguoi_dung_id: user.id },
        orderBy: { login_time: 'desc' },
      });
      expect(loginLog).not.toBeNull();
      expect(loginLog?.session_id).toBeDefined();
    });

    it('Đăng nhập sai mật khẩu: Bị chặn với HTTP 401 Unauthorized', async () => {
      await helper.createTestUser({
        username: 'user_wrong_pw',
        password: 'P@ssw0rd123!',
      });

      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          username: 'user_wrong_pw',
          password: 'IncorrectPassword',
        })
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_001');
    });
  });
});
