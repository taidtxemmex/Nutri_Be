import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { PrismaService } from '../../src/core/database/prisma.service';

describe('Users IDOR Defense & PII Protection - E2E Tests', () => {
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

  describe('IDOR Defense: POST /api/v1/users/getInfo', () => {
    it('Chủ tài khoản (Owner) được phép lấy thông tin của chính mình', async () => {
      const { user, token } = await helper.createTestUser({
        username: 'alice_owner',
        fullName: 'Alice In Wonderland',
      });

      const res = await request(httpServer)
        .post('/api/v1/users/getInfo')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: user.id })
        .expect(200);

      expect(res.body.data).toHaveProperty('viewUser');
      expect(res.body.data.viewUser.fullName).toBe('Alice In Wonderland');
      expect(res.body.meta).toHaveProperty('traceId');

      // LAYER 3 DB ASSERTION
      const profile = await prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(profile?.ho_ten).toBe(res.body.data.viewUser.fullName);
    });

    it('IDOR Attack: User A cố tình truy cập PII của User B sẽ bị chặn với HTTP 403', async () => {
      const { token: aliceToken } = await helper.createTestUser({
        username: 'alice_attacker',
      });
      const { user: bobVictim } = await helper.createTestUser({
        username: 'bob_victim',
        fullName: 'Bob Secure Information',
        email: 'bob_confidential@nutritest.com',
      });

      const res = await request(httpServer)
        .post('/api/v1/users/getInfo')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: bobVictim.id })
        .expect(403);

      expect(res.body.error.code).toBe('ERR_IDOR_VIOLATION');
      expect(res.body.error.message).toMatch(
        /(Không được phép truy cập dữ liệu của người dùng khác|Bạn không có quyền truy cập dữ liệu của người dùng khác)/,
      );
    });

    it('Admin được quyền xem thông tin của bất kỳ người dùng nào phục vụ kiểm toán', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'audit_admin',
        role: 'ADMIN',
      });
      const { user: bobVictim } = await helper.createTestUser({
        username: 'bob_inspected',
        fullName: 'Bob Inspected Profile',
      });

      const res = await request(httpServer)
        .post('/api/v1/users/getInfo')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: bobVictim.id })
        .expect(200);

      expect(res.body.data.viewUser.fullName).toBe('Bob Inspected Profile');
    });
  });

  describe('IDOR Defense: PUT /api/v1/users/update-info', () => {
    it('IDOR Attack: Cố tình cập nhật hồ sơ người dùng khác sẽ bị chặn và DB giữ nguyên trạng thái gốc', async () => {
      const { token: attackerToken } = await helper.createTestUser({
        username: 'mallory_hacker',
      });
      const { user: victimUser } = await helper.createTestUser({
        username: 'victim_profile',
        fullName: 'Original Name Innocent',
        email: 'innocent@nutritest.com',
      });

      // Kẻ tấn công gửi lệnh sửa tên của nạn nhân
      const res = await request(httpServer)
        .put('/api/v1/users/update-info')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          userId: victimUser.id,
          fullName: 'HACKED BY MALLORY',
          phone: '0988888888',
        })
        .expect(403);

      expect(res.body.error.code).toBe('ERR_IDOR_VIOLATION');

      // LAYER 3 DB ASSERTION: Khẳng định dữ liệu trong bảng ho_so_ca_nhan KHÔNG hề bị ghi đè!
      const victimProfileInDb = await prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: victimUser.id },
      });
      expect(victimProfileInDb?.ho_ten).toBe('Original Name Innocent');
      expect(victimProfileInDb?.ho_ten).not.toBe('HACKED BY MALLORY');
    });

    it('Chủ tài khoản cập nhật thông tin chính mình: Thành công và phản ánh đúng vào CSDL', async () => {
      const { user, token } = await helper.createTestUser({
        username: 'self_updater',
        fullName: 'Before Update Name',
      });

      await request(httpServer)
        .put('/api/v1/users/update-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: user.id,
          fullName: 'After Update Official Name',
          address: 'TP. Hồ Chí Minh',
        })
        .expect(200);

      // LAYER 3 DB ASSERTION: Khẳng định MySQL được cập nhật chính xác
      const updatedProfile = await prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: user.id },
      });
      expect(updatedProfile?.ho_ten).toBe('After Update Official Name');
      expect(updatedProfile?.dia_chi).toBe('TP. Hồ Chí Minh');
    });
  });

  describe('Batch Operations: DELETE /api/v1/users/batch & PUT /api/v1/users/batch-status (Rule 20)', () => {
    it('Admin thực hiện xóa mềm hàng loạt người dùng: Chạy updateMany đơn lệnh và cập nhật DB Layer 3', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'batch_admin_deleter',
        role: 'ADMIN',
      });

      const { user: userA } = await helper.createTestUser({ username: 'batch_target_a' });
      const { user: userB } = await helper.createTestUser({ username: 'batch_target_b' });

      const res = await request(httpServer)
        .delete('/api/v1/users/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userA.id, userB.id] })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(2);

      // LAYER 3 DB ASSERTION: Khẳng định trực tiếp trong MySQL cả 2 users đều bị xóa mềm
      // (Do findMany mặc định lọc deleted_at: null, cần chỉ định deleted_at: { not: null } để đọc thùng rác)
      const dbUsers = await prisma.nguoi_dung.findMany({
        where: { id: { in: [userA.id, userB.id] }, deleted_at: { not: null } },
      });

      expect(dbUsers).toHaveLength(2);
      for (const u of dbUsers) {
        expect(u.active).toBe(false);
        expect(u.deleted_at).not.toBeNull();
      }
    });

    it('Admin cập nhật trạng thái hàng loạt bằng batch: Chạy updateMany đơn lệnh và kiểm tra DB Layer 3', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'batch_admin_status',
        role: 'ADMIN',
      });

      const { user: user1 } = await helper.createTestUser({
        username: 'status_target_1',
        active: true,
      });
      const { user: user2 } = await helper.createTestUser({
        username: 'status_target_2',
        active: true,
      });

      const res = await request(httpServer)
        .put('/api/v1/users/batch-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [user1.id, user2.id], isActive: false })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(2);

      // LAYER 3 DB ASSERTION: Cả 2 users đều chuyển thành active = false trong CSDL
      const dbUsers = await prisma.nguoi_dung.findMany({
        where: { id: { in: [user1.id, user2.id] } },
      });

      expect(dbUsers).toHaveLength(2);
      for (const u of dbUsers) {
        expect(u.active).toBe(false);
      }
    });

    it('Admin tạo hàng loạt người dùng bằng Batch Transaction (Rule 20): Tạo atomic và kiểm tra DB Layer 3', async () => {
      const { token: adminToken } = await helper.createTestUser({
        username: 'batch_admin_creator',
        role: 'ADMIN',
      });

      const payload = {
        users: [
          {
            username: 'bulk_created_user_1',
            fullName: 'Bác sĩ Đoàn Văn Một',
            email: 'bsmot@nutritest.com',
            role: 'BAC_SI',
            phone: '0981111111',
          },
          {
            username: 'bulk_created_user_2',
            fullName: 'Chuyên gia Lê Thị Hai',
            email: 'chuyengiahai@nutritest.com',
            role: 'EXPERT',
            phone: '0982222222',
          },
        ],
      };

      const res = await request(httpServer)
        .post('/api/v1/users/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.data.createdCount).toBe(2);

      // LAYER 3 DB ASSERTION: Khẳng định cả 2 users và hồ sơ cá nhân đã nằm trong CSDL MySQL
      const dbUsers = await prisma.nguoi_dung.findMany({
        where: { ten_dang_nhap: { in: ['bulk_created_user_1', 'bulk_created_user_2'] } },
        include: { ho_so_ca_nhan: true },
      });

      expect(dbUsers).toHaveLength(2);
      const user1 = dbUsers.find((u) => u.ten_dang_nhap === 'bulk_created_user_1');
      const user2 = dbUsers.find((u) => u.ten_dang_nhap === 'bulk_created_user_2');

      expect(user1).toBeDefined();
      expect(user1?.vai_tro).toBe('BAC_SI');
      expect(user1?.active).toBe(true);
      expect(user1?.deleted_at).toBeNull();
      expect(user1?.ho_so_ca_nhan?.ho_ten).toBe('Bác sĩ Đoàn Văn Một');

      expect(user2).toBeDefined();
      expect(user2?.vai_tro).toBe('EXPERT');
      expect(user2?.active).toBe(true);
      expect(user2?.deleted_at).toBeNull();
      expect(user2?.ho_so_ca_nhan?.ho_ten).toBe('Chuyên gia Lê Thị Hai');
    });
  });
});
