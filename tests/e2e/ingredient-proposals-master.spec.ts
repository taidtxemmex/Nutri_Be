import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';

describe('Ingredient Proposals Master E2E & IDOR / 3-Layer Persistence Validation', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let adminUser: any;
  let userAToken: string;
  let userAUser: any;
  let userBToken: string;
  let _userBUser: any;
  let categoryId: number;

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();
  });

  beforeEach(async () => {
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Hạt dinh dưỡng cao cấp' },
    });
    categoryId = cat.id;

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_prop_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Dinh Dưỡng',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const userA = await helper.createTestUser({
      username: `user_a_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng A',
    });
    userAToken = userA.token;
    userAUser = userA.user;

    const userB = await helper.createTestUser({
      username: `user_b_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng B',
    });
    userBToken = userB.token;
    _userBUser = userB.user;
  });

  afterAll(async () => {
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();
    await helper.close();
  });

  describe('Scenario 1: Nộp đề xuất nguyên liệu mới kèm minh chứng', () => {
    it('1.1 User A nộp đề xuất -> Trả về 201, trạng thái CHO_DUYET, lưu DB minh_chung & de_xuat_nguyen_lieu', async () => {
      const payload = {
        ingredientName: 'Hạt chia đen hữu cơ',
        categoryId,
        loaiProtein: 'THUC_VAT',
        edible: 100,
        note: 'Bổ sung Omega-3 tự nhiên',
        nutrients: {
          protein: 16.5,
          fat: 30.7,
          fiber: 34.4,
          energy: 486.0,
          calci: 631.0,
          iron: 7.7,
        },
        evidences: [
          {
            objectKey: 'evidence/chia_coa.pdf',
            originalFileName: 'chia_coa.pdf',
            mimeType: 'application/pdf',
            fileSize: 204800,
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/ingredient-proposals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.ingredientName).toBe('Hạt chia đen hữu cơ');
      expect(res.body.data.status).toBe('CHO_DUYET');

      const proposalId = BigInt(res.body.data.id);

      // Layer 3: Direct Database State Persistence Assertion
      const prisma = helper.getPrisma();
      const dbProposal = await prisma.de_xuat_nguyen_lieu.findUnique({
        where: { id: proposalId },
        include: { minh_chung: true },
      });

      expect(dbProposal).not.toBeNull();
      expect(dbProposal?.ten_nguyen_lieu).toBe('Hạt chia đen hữu cơ');
      expect(dbProposal?.trang_thai).toBe('CHO_DUYET');
      expect(dbProposal?.nguoi_tao_id).toBe(userAUser.id);
      expect(dbProposal?.minh_chung.length).toBe(1);
      expect(dbProposal?.minh_chung[0].object_key).toBe('evidence/chia_coa.pdf');
    });
  });

  describe('Scenario 2: IDOR Defense Guard', () => {
    it('2.1 User B không thể xem chi tiết đề xuất của User A (403 AUTH_002)', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Đề xuất riêng tư User A',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/ingredient-proposals/${proposal.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('AUTH_002');
    });

    it('2.2 Quản trị viên (Admin) xem được chi tiết đề xuất của bất kỳ User nào', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Đề xuất chờ duyệt Admin',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/ingredient-proposals/${proposal.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(proposal.id.toString());
      expect(res.body.data.ingredientName).toBe('Đề xuất chờ duyệt Admin');
    });
  });

  describe('Scenario 3: Admin phê duyệt đề xuất (PUT /api/ingredient-proposals/:id/approve)', () => {
    it('3.1 Admin duyệt đề xuất -> Chuyển trạng thái DA_DUYET và tự động tạo bản ghi nguyen_lieu master', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Hạt lanh vàng hữu cơ',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          loai_protein: 'THUC_VAT',
          edible: 100,
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: userAUser.id,
          gia_tri_dinh_duong_json: JSON.stringify({
            protein: 18.3,
            fat: 42.2,
            fiber: 27.3,
            calci: 255.0,
            sodium: 30.0,
          }),
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .put(`/api/ingredient-proposals/${proposal.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data).toHaveProperty('ingredientId');

      const masterIngId = BigInt(res.body.data.ingredientId);

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();

      // a) Bản ghi đề xuất cập nhật DA_DUYET
      const dbProp = await prisma.de_xuat_nguyen_lieu.findUnique({
        where: { id: proposal.id },
      });
      expect(dbProp?.trang_thai).toBe('DA_DUYET');
      expect(dbProp?.nguoi_duyet_id).toBe(adminUser.id);
      expect(dbProp?.nguyen_lieu_id).toBe(masterIngId);

      // b) Bảng nguyen_lieu có nguyên liệu mới được kích hoạt
      const dbMaster = await prisma.nguyen_lieu.findUnique({
        where: { id: masterIngId },
      });
      expect(dbMaster).not.toBeNull();
      expect(dbMaster?.ten_nguyen_lieu).toBe('Hạt lanh vàng hữu cơ');
      expect(dbMaster?.trang_thai).toBe('DA_DUYET');
      expect(Number(dbMaster?.protein)).toBe(18.3);
      expect(Number(dbMaster?.fat)).toBe(42.2);
    });

    it('3.2 User thường gọi approve bị chặn với 403 Forbidden', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Đề xuất không cho user tự duyệt',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      await request(helper.getHttpServer())
        .put(`/api/ingredient-proposals/${proposal.id}/approve`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });
  });

  describe('Scenario 4: Admin từ chối đề xuất (PUT /api/ingredient-proposals/:id/reject)', () => {
    it('4.1 Admin từ chối kèm lý do -> Cập nhật TU_CHOI và ly_do_tu_choi trong DB', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Nguyên liệu không đạt chuẩn kiểm định',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .put(`/api/ingredient-proposals/${proposal.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Thiếu kết quả kiểm nghiệm kim loại nặng COA' })
        .expect(200);

      expect(res.body.data.success).toBe(true);

      // Layer 3: Direct Database Verification
      const dbProp = await helper.getPrisma().de_xuat_nguyen_lieu.findUnique({
        where: { id: proposal.id },
      });
      expect(dbProp?.trang_thai).toBe('TU_CHOI');
      expect(dbProp?.ly_do_tu_choi).toBe('Thiếu kết quả kiểm nghiệm kim loại nặng COA');
      expect(dbProp?.nguoi_duyet_id).toBe(adminUser.id);
    });
  });

  describe('Scenario 5: Chặn xử lý trùng lặp (Double Processing Protection)', () => {
    it('5.1 Đề xuất đã duyệt không thể duyệt lại (400 PROPOSAL_ALREADY_PROCESSED)', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Đề xuất đã duyệt trước đó',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'DA_DUYET',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .put(`/api/ingredient-proposals/${proposal.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('PROPOSAL_ALREADY_PROCESSED');
    });

    it('5.2 Đề xuất đã từ chối không thể từ chối lại (400 PROPOSAL_ALREADY_PROCESSED)', async () => {
      const proposal = await helper.getPrisma().de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Đề xuất đã từ chối trước đó',
          danh_muc: categoryId,
          loai_de_xuat: 'THEM_MOI',
          gia_tri_dinh_duong_json: '{}',
          trang_thai: 'TU_CHOI',
          nguoi_tao_id: userAUser.id,
          ngay_tao: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .put(`/api/ingredient-proposals/${proposal.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Từ chối lần 2' })
        .expect(400);

      expect(res.body.error.code).toBe('PROPOSAL_ALREADY_PROCESSED');
    });
  });
});
