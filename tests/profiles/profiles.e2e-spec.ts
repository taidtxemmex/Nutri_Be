import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole, Gender } from '../../src/config/enums';

describe('Profiles E2E & Soft Delete Verification (e2e)', () => {
  const helper = new TestAppHelper();
  let userToken: string;
  let adminToken: string;
  let regularUserId: string;
  let _adminUserId: string;

  beforeAll(async () => {
    await helper.init();
  });

  beforeEach(async () => {
    await helper.cleanDatabase();

    const regular = await helper.createTestUser({
      username: 'doctor_profile',
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Dinh Dưỡng Test',
      email: 'doctor@truenutri.vn',
    });
    userToken = regular.token;
    regularUserId = regular.user.id;

    const admin = await helper.createTestUser({
      username: 'admin_profile',
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
    });
    adminToken = admin.token;
    _adminUserId = admin.user.id;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
  });

  describe('GET /api/v1/profiles/my-profile', () => {
    it('should retrieve current user profile with Layer 3 DB assertion', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/v1/profiles/my-profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('username', 'doctor_profile');
      expect(res.body.data).toHaveProperty('fullName', 'Bác Sĩ Dinh Dưỡng Test');
      expect(res.body.data).toHaveProperty('email', 'doctor@truenutri.vn');

      // Layer 3 Database State Assertion
      const dbProfile = await helper.getPrisma().ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: regularUserId },
      });
      expect(dbProfile).not.toBeNull();
      expect(dbProfile?.ho_ten).toBe('Bác Sĩ Dinh Dưỡng Test');
      expect(dbProfile?.deleted_at).toBeNull();
    });
  });

  describe('PUT /api/v1/profiles/my-profile', () => {
    it('should update profile and reflect immediately in Layer 3 DB state', async () => {
      const updatePayload = {
        fullName: 'Bác Sĩ Dinh Dưỡng Cập Nhật',
        phone: '0912345678',
        address: 'Đà Nẵng',
        gender: Gender.NU,
        dob: '1992-08-20',
      };

      const res = await request(helper.getHttpServer())
        .put('/api/v1/profiles/my-profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.success).toBe(true);

      // Layer 3 Database State Assertion
      const dbProfile = await helper.getPrisma().ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: regularUserId },
      });
      expect(dbProfile).not.toBeNull();
      expect(dbProfile?.ho_ten).toBe('Bác Sĩ Dinh Dưỡng Cập Nhật');
      expect(dbProfile?.phone).toBe('0912345678');
      expect(dbProfile?.dia_chi).toBe('Đà Nẵng');
      expect(dbProfile?.gioi_tinh).toBe(Gender.NU);
    });
  });

  describe('POST /api/v1/profiles/getAll & Soft Delete Filter', () => {
    it('should block regular user from accessing admin profile list', async () => {
      await request(helper.getHttpServer())
        .post('/api/v1/profiles/getAll')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ page: 0, size: 10 })
        .expect(403);
    });

    it('should allow admin to view active profiles, automatically excluding soft-deleted users', async () => {
      // 1. Tạo thêm một user thứ ba bị soft-delete
      const deletedUser = await helper.createTestUser({
        username: 'deleted_user',
        role: UserRole.USER,
        password: 'P@ssw0rd123!',
      });
      await helper.getPrisma().nguoi_dung.update({
        where: { id: deletedUser.user.id },
        data: {
          active: false,
          deleted_at: new Date(),
        },
      });

      // 2. Admin gọi danh sách
      const res = await request(helper.getHttpServer())
        .post('/api/v1/profiles/getAll')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ page: 0, size: 20 })
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      const usernames = res.body.data.items.map((i: any) => i.username);

      // Tài khoản đang sống phải xuất hiện
      expect(usernames).toContain('doctor_profile');
      expect(usernames).toContain('admin_profile');

      // Tài khoản đã bị xóa mềm (deleted_at IS NOT NULL) TUYỆT ĐỐI KHÔNG xuất hiện
      expect(usernames).not.toContain('deleted_user');

      // Layer 3 Database State Verification: tài khoản bị xóa mềm vẫn tồn tại an toàn trong DB
      const dbDeletedUser = await helper.getPrisma().nguoi_dung.findFirst({
        where: { id: deletedUser.user.id, deleted_at: { not: null } },
      });
      expect(dbDeletedUser).not.toBeNull();
      expect(dbDeletedUser?.deleted_at).toBeInstanceOf(Date);
      expect(dbDeletedUser?.active).toBe(false);
    });
  });
});
