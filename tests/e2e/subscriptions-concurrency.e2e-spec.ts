import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { CacheService } from '../../src/core/cache/cache.service';
import { HttpStatus } from '@nestjs/common';

describe('Subscriptions & Plans E2E (Task 7.1: Cumulative Extension & Transaction Uniqueness)', () => {
  const helper = new TestAppHelper();
  let adminToken: string;
  let adminUserId: string;
  let userToken: string;
  let userId: string;
  let _cacheService: CacheService;

  beforeAll(async () => {
    await helper.init();
    _cacheService = helper.getApp().get<CacheService>(CacheService);
  });

  afterAll(async () => {
    if (helper.getApp()) {
      await helper.getApp().close();
    }
  });

  beforeEach(async () => {
    const prisma = helper.getPrisma();

    // 1. Dọn dẹp dữ liệu kiểm thử
    await prisma.$executeRawUnsafe('DELETE FROM `dang_ky`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `yeu_cau_thanh_toan`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `goi`;').catch(() => {});
    await helper.cleanDatabase();

    // 2. Khởi tạo tài khoản Admin và User
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_sub_${suffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Subscription',
    });
    adminToken = admin.token;
    adminUserId = admin.user.id;

    const user = await helper.createTestUser({
      username: `user_sub_${suffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Nguyễn Thử Nghiệm',
    });
    userToken = user.token;
    userId = user.user.id;
  });

  describe('Plans CRUD & Parity Aliases', () => {
    it('Admin creates plan via POST /api/v1/plans, user gets active plans via GET /api/package/getAll', async () => {
      // 1. Admin tạo gói cước
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ma_goi: 'PRO_1M',
          ten_goi: 'Gói Pro 1 Tháng',
          so_ngay_su_dung: 30,
          gia_tien: 199000,
          mo_ta: 'Gói thử nghiệm Pro',
          trang_thai: 'ACTIVE',
        });

      expect(createRes.status).toBe(HttpStatus.OK);
      expect(createRes.body.data).toBeDefined();
      expect(createRes.body.data.ma_goi).toBe('PRO_1M');
      expect(createRes.body.data.packageCode).toBe('PRO_1M');
      expect(createRes.body.data.gia_tien).toBe(199000);

      const planId = createRes.body.data.id;

      // 2. Public truy cập lấy danh sách qua GET /api/package/getAll
      const listRes1 = await request(helper.getHttpServer()).get('/api/package/getAll');
      expect(listRes1.status).toBe(HttpStatus.OK);
      expect(Array.isArray(listRes1.body.data)).toBe(true);
      expect(listRes1.body.data.some((p: any) => p.ma_goi === 'PRO_1M')).toBe(true);

      // 3. Public truy cập qua GET /api/v1/plans
      const listRes2 = await request(helper.getHttpServer()).get('/api/v1/plans');
      expect(listRes2.status).toBe(HttpStatus.OK);
      expect(listRes2.body.data.some((p: any) => p.packageCode === 'PRO_1M')).toBe(true);

      // 4. Lấy chi tiết qua GET /api/package/:id
      const detailRes = await request(helper.getHttpServer()).get(`/api/package/${planId}`);
      expect(detailRes.status).toBe(HttpStatus.OK);
      expect(detailRes.body.data.id).toBe(planId);
      expect(detailRes.body.data.so_ngay_su_dung).toBe(30);

      // 5. Admin cập nhật qua PUT /api/v1/plans/:id
      const updateRes = await request(helper.getHttpServer())
        .put(`/api/v1/plans/${planId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ten_goi: 'Gói Pro 1 Tháng Siêu Khuyến Mãi',
          gia_tien: 149000,
        });

      expect(updateRes.status).toBe(HttpStatus.OK);
      expect(updateRes.body.data.gia_tien).toBe(149000);

      // 6. Admin xóa mềm qua DELETE /api/package/delete/:id
      const deleteRes = await request(helper.getHttpServer())
        .delete(`/api/package/delete/${planId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(HttpStatus.OK);

      // Layer 3 Assertion: Bản ghi trong CSDL có deleted_at và trang_thai = INACTIVE
      const prisma = helper.getPrisma();
      const [dbPlan]: any[] = await prisma.$queryRawUnsafe(
        'SELECT id, ma_goi, trang_thai, deleted_at FROM goi WHERE id = ?',
        BigInt(planId),
      );
      expect(dbPlan).toBeDefined();
      expect(dbPlan.deleted_at).not.toBeNull();
      expect(dbPlan.trang_thai).toBe('INACTIVE');
    });
  });

  describe('Subscription Payment Request & Birthday Paradox Fix', () => {
    it('User creates payment request -> generates unique TX-yyMMdd-XXXXXX code', async () => {
      const prisma = helper.getPrisma();

      // Seed 1 active plan
      await prisma.goi.create({
        data: {
          ma_goi: 'PRO_3M',
          ten_goi: 'Gói Pro 3 Tháng',
          so_ngay_su_dung: 90,
          gia_tien: 499000,
          trang_thai: 'ACTIVE',
        },
      });

      // User gửi yêu cầu đăng ký gói
      const reqRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ma_goi: 'PRO_3M',
        });

      expect(reqRes.status).toBe(HttpStatus.OK);
      expect(reqRes.body.data).toBeDefined();
      expect(reqRes.body.data.ma_giao_dich).toMatch(/^TX-\d{6}-[A-F0-9]{6}$/);
      expect(reqRes.body.data.so_tien).toBe(499000);
      expect(reqRes.body.data.trang_thai).toBe('PENDING');

      // Layer 3 DB verification
      const dbPr = await prisma.yeu_cau_thanh_toan.findUnique({
        where: { ma_giao_dich: reqRes.body.data.ma_giao_dich },
      });
      expect(dbPr).not.toBeNull();
      expect(dbPr?.nguoi_dung_id).toBe(userId);
    });
  });

  describe('Approval with Cumulative Extension (Khắc phục mất ngày sử dụng cũ)', () => {
    it('Scenario: User has active PRO until 15 days in future -> Admin approves 30-day package -> Expiry extends by +30 days from existing expiry', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo gói cước 30 ngày
      const _pkg = await prisma.goi.create({
        data: {
          ma_goi: 'PRO_30D',
          ten_goi: 'Gói Pro 30 Ngày',
          so_ngay_su_dung: 30,
          gia_tien: 199000,
          trang_thai: 'ACTIVE',
        },
      });

      // 2. Thiết lập user hiện tại đang là USERPRO còn hạn đúng 15 ngày tính từ bây giờ
      const now = new Date();
      const existingExpiry = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      await prisma.nguoi_dung.update({
        where: { id: userId },
        data: {
          vai_tro: 'USERPRO',
          pro_expired_at: existingExpiry,
        },
      });

      // 3. User tạo yêu cầu mua thêm gói 30 ngày
      const reqRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ma_goi: 'PRO_30D',
        });

      const paymentRequestId = reqRes.body.data.id;

      // 4. Admin duyệt yêu cầu qua POST /api/v1/admin/subscriptions/:id/approve
      const approveRes = await request(helper.getHttpServer())
        .post(`/api/v1/admin/subscriptions/${paymentRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(HttpStatus.OK);
      expect(approveRes.body.data.trang_thai).toBe('APPROVED');

      // 5. LAYER 3 PERSISTENCE ASSERTIONS:
      // A. Kiểm tra bảng nguoi_dung:
      const updatedUser = await prisma.nguoi_dung.findUnique({
        where: { id: userId },
      });
      expect(updatedUser?.vai_tro).toBe('USERPRO');
      expect(updatedUser?.pro_expired_at).not.toBeNull();

      // KHẲNG ĐỊNH: Thời hạn mới = existingExpiry + 30 ngày (tổng cộng 45 ngày từ now), KHÔNG PHẢI now + 30 ngày!
      const newExpiryTime = updatedUser!.pro_expired_at!.getTime();
      const expectedExpiryTime = existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000;
      // Sai số không quá 5 giây do quá trình thực thi
      expect(Math.abs(newExpiryTime - expectedExpiryTime)).toBeLessThan(5000);

      // B. Kiểm tra bảng dang_ky có bản ghi kích hoạt
      const dangKyRecord = await prisma.dang_ky.findFirst({
        where: {
          nguoi_dung_id: userId,
          thanh_toan_id: BigInt(paymentRequestId),
        },
      });
      expect(dangKyRecord).not.toBeNull();
      expect(dangKyRecord?.ma_goi).toBe('PRO_30D');
      expect(dangKyRecord?.trang_thai).toBe('ACTIVE');

      // C. Kiểm tra trạng thái yêu cầu thanh toán là APPROVED và có nguoi_phe_duyet_id
      const dbPayment = await prisma.yeu_cau_thanh_toan.findUnique({
        where: { id: BigInt(paymentRequestId) },
      });
      expect(dbPayment?.trang_thai).toBe('APPROVED');
      expect(dbPayment?.nguoi_phe_duyet_id).toBe(adminUserId);
      expect(dbPayment?.ngay_phe_duyet).not.toBeNull();
    });

    it('Layer 3 DB Assertion: Payment request with payment slip document creates record in prisma.minh_chung', async () => {
      const prisma = helper.getPrisma();

      await prisma.goi.create({
        data: {
          ma_goi: 'PRO_SLIP',
          ten_goi: 'Gói Có Đính Kèm Ủy Nhiệm Chi',
          so_ngay_su_dung: 60,
          gia_tien: 299000,
          trang_thai: 'ACTIVE',
        },
      });

      const reqRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ma_goi: 'PRO_SLIP',
          documents: [
            {
              objectKey: '2026/10/bank_slip_proof.jpg',
              originalFileName: 'bank_slip_proof.jpg',
              mimeType: 'image/jpeg',
            },
          ],
        });

      expect(reqRes.status).toBe(HttpStatus.OK);
      expect(reqRes.body.data).toBeDefined();
      const paymentId = reqRes.body.data.id;

      // Layer 3 Assertion on prisma.minh_chung
      const dbMinhChung = await prisma.minh_chung.findFirst({
        where: { yeu_cau_id: BigInt(paymentId) },
      });
      expect(dbMinhChung).not.toBeNull();
      expect(dbMinhChung?.ten_file_goc).toBe('bank_slip_proof.jpg');
      expect(dbMinhChung?.object_key).toBe('2026/10/bank_slip_proof.jpg');
      expect(dbMinhChung?.nguoi_upload_id).toBe(userId);
    });
  });

  describe('Adversarial Enemy Persona Injections (The Assassin Matrix)', () => {
    it('Persona 1 — The Stupid Bot: Burst 10 concurrent requests to request plan without collisions', async () => {
      const prisma = helper.getPrisma();

      await prisma.goi.create({
        data: {
          ma_goi: 'PRO_BOT',
          ten_goi: 'Gói Bot Burst Test',
          so_ngay_su_dung: 30,
          gia_tien: 100000,
          trang_thai: 'ACTIVE',
        },
      });

      // Rapid-fire 10 concurrent requests
      const requests = Array.from({ length: 10 }).map(() =>
        request(helper.getHttpServer())
          .post('/api/v1/subscriptions/request')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ma_goi: 'PRO_BOT' }),
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(HttpStatus.OK);
        expect(res.body.data.ma_giao_dich).toMatch(/^TX-\d{6}-[A-F0-9]{6}$/);
      }

      // Layer 3 Assertions: 10 distinct records with 10 distinct transaction codes
      const codes = responses.map((r) => r.body.data.ma_giao_dich);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);

      const dbCount = await prisma.yeu_cau_thanh_toan.count({
        where: {
          ma_giao_dich: { in: codes },
          nguoi_dung_id: userId,
        },
      });
      expect(dbCount).toBe(10);
    });

    it('Persona 2 — The Amateur Hacker: SQL Injection & XSS payload injection in plan operations', async () => {
      // 1. SQL Injection attempt in package code
      const sqliPayload = "PRO_INJECT'; DROP TABLE goi; --";
      const sqliRes = await request(helper.getHttpServer())
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ma_goi: sqliPayload,
          ten_goi: '<script>alert("XSS")</script>',
          so_ngay_su_dung: 30,
          gia_tien: 50000,
          trang_thai: 'ACTIVE',
        });

      // Prisma uses parameterized queries so table is NOT dropped
      const prisma = helper.getPrisma();
      const goiCount = await prisma.goi.count();
      expect(goiCount).toBeGreaterThanOrEqual(1);

      // Clean up injected plan
      if (sqliRes.body?.data?.id) {
        await prisma.goi.delete({ where: { id: BigInt(sqliRes.body.data.id) } }).catch(() => {});
      }
    });

    it('Persona 3 — The Broken Cable Network: Malformed inputs, missing tokens, and unauthenticated access', async () => {
      // 1. Unauthenticated request -> 401
      const unauthRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .send({ ma_goi: 'PRO_1M' });
      expect(unauthRes.status).toBe(HttpStatus.UNAUTHORIZED);

      // 2. Corrupted Bearer token -> 401
      const badTokenRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .set('Authorization', 'Bearer invalid.corrupted.token')
        .send({ ma_goi: 'PRO_1M' });
      expect(badTokenRes.status).toBe(HttpStatus.UNAUTHORIZED);

      // 3. Non-existent package code -> 404
      const notFoundRes = await request(helper.getHttpServer())
        .post('/api/v1/subscriptions/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ma_goi: 'NON_EXISTENT_PACKAGE_999' });
      expect(notFoundRes.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
