import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { PrismaService } from '../../src/core/database/prisma.service';
import { AUTH_ERROR_INACTIVE_ACCOUNT } from '../../src/config/constants/auth.constants';

describe('RBAC Security & State Mutation E2E Tests', () => {
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

  describe('RBAC Guard: GET /api/v1/users (Admin Only)', () => {
    it('Chưa xác thực (Không gửi Token): Trả về HTTP 401 Unauthorized', async () => {
      await request(httpServer).get('/api/v1/users').expect(401);
    });

    it('Xác thực với vai trò USER: Bị chặn với HTTP 403 Forbidden', async () => {
      const { token } = await helper.createTestUser({
        username: 'regular_user',
        role: 'USER',
      });

      await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('Xác thực với vai trò ADMIN: Được truy cập với HTTP 200 và Response Envelope chuẩn phân trang', async () => {
      const { token } = await helper.createTestUser({
        username: 'system_admin',
        role: 'ADMIN',
      });

      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Kiểm định Response Envelope chuẩn cho List (Rule 10)
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('totalItems');
      expect(res.body.meta).toHaveProperty('totalPages');
      expect(res.body.meta).toHaveProperty('hasNextPage');
      expect(res.body.meta).toHaveProperty('hasPreviousPage');
    });
  });

  describe('Cập nhật vai trò (Role Mutation): PUT /api/v1/users/:id/role', () => {
    it('Người dùng thường không được phép thay đổi vai trò người khác (403 Forbidden)', async () => {
      const { token: userToken } = await helper.createTestUser({
        username: 'attacker_user',
        role: 'USER',
      });
      const { user: victim } = await helper.createTestUser({
        username: 'victim_user',
        role: 'USER',
      });

      await request(httpServer)
        .put(`/api/v1/users/${victim.id}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'ADMIN' })
        .expect(403);

      // LAYER 3 DB ASSERTION: Vai trò trong DB không bị thay đổi
      const unchanged = await prisma.nguoi_dung.findUnique({ where: { id: victim.id } });
      expect(unchanged?.vai_tro).toBe('USER');
    });

    it('Admin phân quyền thành công: Cập nhật đúng vai trò trong bảng nguoi_dung', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'legit_admin',
        role: 'ADMIN',
      });
      const { user: targetUser } = await helper.createTestUser({
        username: 'target_for_upgrade',
        role: 'USER',
      });

      await request(httpServer)
        .put(`/api/v1/users/${targetUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newRole: 'USERPRO', role: 'USERPRO' })
        .expect(200);

      // LAYER 3 DB ASSERTION: Khẳng định cập nhật thực tế trong CSDL
      const updatedInDb = await prisma.nguoi_dung.findUnique({
        where: { id: targetUser.id },
      });
      expect(updatedInDb?.vai_tro).toBe('USERPRO');
    });
  });

  describe('Khóa tài khoản (Status Mutation): PUT /api/v1/users/:id/status', () => {
    it('Admin khóa tài khoản người dùng: DB cập nhật active = false và chặn đăng nhập', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'status_admin',
        role: 'ADMIN',
      });
      const { user: targetUser, rawPassword } = await helper.createTestUser({
        username: 'target_to_lock',
        role: 'USER',
        password: 'P@ssw0rd123!',
      });

      // 1. Admin thực hiện khóa tài khoản
      await request(httpServer)
        .put(`/api/v1/users/${targetUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      // 2. LAYER 3 DB ASSERTION: Khẳng định active = false trong MySQL
      const lockedInDb = await prisma.nguoi_dung.findUnique({
        where: { id: targetUser.id },
      });
      expect(lockedInDb?.active).toBe(false);

      // 3. Người dùng bị khóa đăng nhập sẽ bị từ chối với mã lỗi AUTH_INACTIVE_ACCOUNT
      const loginRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ username: 'target_to_lock', password: rawPassword })
        .expect(401);

      expect(loginRes.body.error.code).toBe(AUTH_ERROR_INACTIVE_ACCOUNT);
    });
  });
});
