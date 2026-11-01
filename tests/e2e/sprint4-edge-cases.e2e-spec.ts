import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { MenuType, TargetType, IntakeInputType } from '../../src/config/enums/domain.enum';
import { IntakeCalculationEngine } from '../../src/modules/daily-intakes/engines/intake-calculation.engine';
import { NutritionEngine } from '../../src/core/nutrition-engine/nutrition.engine';

// Nâng timeout cho E2E suite để chống flaky timeout khi khởi tạo NestJS + Prisma
jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 4 E2E TEST SUITE: DEFENSIVE, BOUNDARY & ADVERSARIAL ATTACKS
 * Module 07: Thuc don, Bua an, De xuat, Khau phan 24h & Bo gioi han dinh duong
 * ============================================================================
 * Ruthless QA Mindset: Hostile Test Assassin & Deep 3-Layer Verification
 * - Layer 1: HTTP Protocol & Status Code Assertions (200, 201, 400, 404, 409)
 * - Layer 2: Payload Schema & Universal API Contract Envelopes
 * - Layer 3: Direct Database Ground Truth Persistence (MySQL nutri_test)
 * ============================================================================
 */
describe('Sprint 4: Edge Cases & Hostile Adversarial E2E Suite (Module 07)', () => {
  const helper = new TestAppHelper();

  let _adminToken: string;
  let _adminUser: any;
  let regularToken: string;
  let regularUser: any;
  let _otherToken: string;
  let _otherUser: any;

  let categoryId: number;
  let beefIngId: number;
  let celeryIngId: number;
  let porkIngId: number;
  let zeroEdibleIngId: number;

  let patientId: bigint;

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();
    // Warm-up connection pool
    await prisma.$queryRawUnsafe('SELECT 1');
  }, 60000);

  beforeEach(async () => {
    const prisma = helper.getPrisma();

    // 1. Dọn dẹp CSDL triệt để với FOREIGN_KEY_CHECKS an toàn (TC-S4-01)
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `gioi_han_dinh_duong`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `he_so_song_chin`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    // 2. Tạo danh mục chuẩn
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 4' },
    });
    categoryId = cat.id;

    // 3. Khởi tạo các nguyên liệu master chuẩn
    // 3.1 Thịt bò bắp (Đạm động vật, 100% ăn được)
    const beef = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Thịt bò bắp Sprint 4',
        danh_muc: categoryId,
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 72.0,
        protein: 21.5,
        fat: 4.5,
        fiber: 0.0,
        ash: 1.1,
        calci: 12.0,
        iron: 2.8,
        sodium: 65.0,
        potassium: 340.0,
        trang_thai: 'DA_DUYET',
      },
    });
    beefIngId = Number(beef.id);

    // 3.2 Cần tây (Chất xơ, 80% ăn được)
    const celery = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Cần tây lá xanh Sprint 4',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 80,
        water: 94.0,
        protein: 1.2,
        fat: 0.2,
        fiber: 1.6,
        ash: 0.9,
        calci: 40.0,
        iron: 0.5,
        sodium: 80.0,
        potassium: 260.0,
        trang_thai: 'DA_DUYET',
      },
    });
    celeryIngId = Number(celery.id);

    // 3.3 Thịt heo nạc (100% ăn được)
    const pork = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Thịt heo nạc Sprint 4',
        danh_muc: categoryId,
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 73.0,
        protein: 19.0,
        fat: 7.0,
        fiber: 0.0,
        ash: 1.0,
        trang_thai: 'DA_DUYET',
      },
    });
    porkIngId = Number(pork.id);

    // 3.4 Nguyên liệu biên: Tỷ lệ ăn được = 0% (Vỏ hạt không ăn được)
    const zeroEdible = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Vỏ hạt không ăn được (Edible 0%)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 0,
        water: 10.0,
        protein: 5.0,
        fat: 2.0,
        fiber: 50.0,
        ash: 3.0,
        trang_thai: 'DA_DUYET',
      },
    });
    zeroEdibleIngId = Number(zeroEdible.id);

    // 4. Tạo các tài khoản kiểm thử
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const admin = await helper.createTestUser({
      username: `admin_s4_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      fullName: 'Quản Trị Viên Sprint 4',
    });
    _adminToken = admin.token;
    _adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_s4_${uniqueSuffix}`,
      role: UserRole.USER,
      fullName: 'Bác Sĩ Dinh Dưỡng Sprint 4',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    const other = await helper.createTestUser({
      username: `other_s4_${uniqueSuffix}`,
      role: UserRole.USER,
      fullName: 'Người Dùng Khác Sprint 4',
    });
    _otherToken = other.token;
    _otherUser = other.user;

    // 5. Tạo hồ sơ bệnh nhân cho regular user
    const patient = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: regularUser.id,
        ho_ten: 'Bệnh Nhân Thử Nghiệm Sprint 4',
        gioi_tinh: 'NAM',
        ngay_sinh: new Date('1990-01-01'),
        can_nang: 68.5,
        chieu_cao: 172.0,
        he_so_hoat_dong: 1.4,
      },
    });
    patientId = patient.id;
  }, 60000);

  afterAll(async () => {
    if (helper) {
      const prisma = helper.getPrisma();
      if (prisma) {
        await prisma.$disconnect();
      }
      await helper.close();
    }
  }, 60000);

  // ==========================================================================
  // KỊCH BẢN 1: COPY-ON-WRITE (CoW) ISOLATION BREACH
  // ==========================================================================
  describe('Kịch bản 1: Copy-on-Write (CoW) Isolation Breach', () => {
    it('Thực đơn A và B dùng chung Bữa ăn M -> Cập nhật B sửa món -> DB khẳng định A vẫn giữ nguyên Bữa M ban đầu không bị đột biến', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo 2 món ăn riêng biệt: Món 1 (Bò xào) và Món 2 (Heo luộc)
      const dish1 = await prisma.mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Thịt bò xào cần tây M1',
          trang_thai: 'RIENG_TU',
          chi_tiet_mon_an: {
            create: [
              { nguyen_lieu_id: BigInt(beefIngId), khoi_luong_song_sach: 150 },
              { nguyen_lieu_id: BigInt(celeryIngId), khoi_luong_song_sach: 80 },
            ],
          },
        },
      });

      const dish2 = await prisma.mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Thịt heo luộc M2',
          trang_thai: 'RIENG_TU',
          chi_tiet_mon_an: {
            create: [{ nguyen_lieu_id: BigInt(porkIngId), khoi_luong_song_sach: 200 }],
          },
        },
      });

      // 2. Tạo Bữa ăn chung M chứa Món 1
      const mealM = await prisma.bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa Trưa Chia Sẻ M',
          gio_an: '12:00',
          trang_thai: 'RIENG_TU',
          chi_tiet_bua_an: {
            create: [{ mon_an_id: dish1.id, he_so_song_chin: 1.0 }],
          },
        },
      });

      // 3. Tạo Thực đơn A gắn Bữa ăn M
      const menuA = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn A - Bệnh nhân phòng 101',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: patientId,
          chi_tiet_thuc_don: {
            create: [{ bua_an_id: mealM.id, thu_tu_trong_tuan: 1 }],
          },
        },
      });

      // 4. Tạo Thực đơn B cũng gắn chung Bữa ăn M
      const menuB = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn B - Bệnh nhân phòng 102',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: patientId,
          chi_tiet_thuc_don: {
            create: [{ bua_an_id: mealM.id, thu_tu_trong_tuan: 1 }],
          },
        },
      });

      // Layer 3 tiền kiểm: Khẳng định trong CSDL, Bữa ăn M đang có đúng 2 thực đơn dùng chung
      const initialUsageCount = await prisma.chi_tiet_thuc_don.count({
        where: { bua_an_id: mealM.id },
      });
      expect(initialUsageCount).toBe(2);

      // 5. TẤN CÔNG BIÊN: Cập nhật Thực đơn B, sửa Bữa ăn M để thay Món 1 thành Món 2
      const updatePayload = {
        menuType: MenuType.NGAY,
        meals: [
          {
            mealId: mealM.id.toString(),
            mealName: 'Bữa Trưa Thực Đơn B Đã Sửa (Thay sang Heo luộc)',
            time: '12:30',
            dishes: [
              {
                dishId: dish2.id.toString(),
                coefficient: 1.15,
              },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Assertion
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/menus/${menuB.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updatePayload)
        .expect(200);

      // Layer 2: API Contract Schema Assertion
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.id).toBe(menuB.id.toString());
      expect(res.body.data.message).toBe('Cập nhật thực đơn thành công');
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      // Layer 3: DIRECT DATABASE GROUND TRUTH ASSERTIONS (BẮT BUỘC THEO LUẬT)
      // 3.1 Khẳng định Thực đơn B đã được chuyển sang trỏ tới một bữa ăn bản sao (cloned meal) mới
      const menuBDetail = await prisma.chi_tiet_thuc_don.findFirst({
        where: { thuc_don_id: menuB.id },
      });
      expect(menuBDetail).not.toBeNull();
      expect(menuBDetail?.bua_an_id).not.toBe(mealM.id);

      const clonedMealId = menuBDetail!.bua_an_id;
      const clonedMeal = await prisma.bua_an.findUnique({
        where: { id: clonedMealId },
        include: { chi_tiet_bua_an: true },
      });
      expect(clonedMeal).not.toBeNull();
      expect(clonedMeal?.chi_tiet_bua_an.length).toBe(1);
      expect(clonedMeal?.chi_tiet_bua_an[0].mon_an_id).toBe(dish2.id);

      // 3.2 KHẲNG ĐỊNH CÔ LẬP TUYỆT ĐỐI CỦA THỰC ĐƠN A:
      // Thực đơn A VẪN LIÊN KẾT với bữa ăn M ban đầu!
      const menuADetail = await prisma.chi_tiet_thuc_don.findFirst({
        where: { thuc_don_id: menuA.id },
      });
      expect(menuADetail).not.toBeNull();
      expect(menuADetail?.bua_an_id).toBe(mealM.id);

      // 3.3 KHẲNG ĐỊNH BỮA ĂN M GỐC HOÀN TOÀN NGUYÊN VẸN, KHÔNG BỊ ĐỘT BIẾN / MẤT MÓN
      const originalMeal = await prisma.bua_an.findUnique({
        where: { id: mealM.id },
        include: { chi_tiet_bua_an: true },
      });
      expect(originalMeal).not.toBeNull();
      expect(originalMeal?.ten_bua_an).toBe('Bữa Trưa Chia Sẻ M');
      expect(originalMeal?.chi_tiet_bua_an.length).toBe(1);
      // Món ăn của M vẫn là Món 1 (Thịt bò xào), tuyệt đối không bị ghi đè thành Món 2!
      expect(originalMeal?.chi_tiet_bua_an[0].mon_an_id).toBe(dish1.id);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 2: ẢO ẢNH SNAPSHOT ĐỀ XUẤT (SNAPSHOT RESILIENCE UNDER DELETION)
  // ==========================================================================
  describe('Kịch bản 2: Ảo ảnh Snapshot Đề Xuất (Snapshot Resilience under Deletion)', () => {
    it('Tạo snapshot đề xuất C -> Xóa món ăn con và nguyên liệu gốc trong CSDL -> API xem đề xuất vẫn đọc snapshot bình thường, TUYỆT ĐỐI KHÔNG CRASH 500', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo thực đơn C hoàn chỉnh qua API
      const createMenuPayload = {
        menuName: 'Thực đơn C để đóng băng Snapshot',
        menuType: MenuType.NGAY,
        targetType: TargetType.BENH_NHAN,
        patientId: patientId.toString(),
        meals: [
          {
            mealName: 'Bữa sáng Snapshot',
            time: '07:00',
            dishes: [
              {
                name: 'Cháo bò bắp dinh dưỡng',
                coefficient: 1.0,
                details: [
                  { ingredientId: beefIngId, netWeight: 100 },
                  { ingredientId: celeryIngId, netWeight: 50 },
                ],
              },
            ],
          },
        ],
      };

      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/menus')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(createMenuPayload)
        .expect(201);

      const menuCId = createRes.body.data.id;

      // 2. Nộp đề xuất thực đơn C (Đóng băng Deep Snapshot JSONB)
      const proposeRes = await request(helper.getHttpServer())
        .post(`/api/v1/menu-proposals/${menuCId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(201);

      // Layer 2: API Contract
      expect(proposeRes.body.data).toHaveProperty('proposalId');
      expect(proposeRes.body.data.success).toBe(true);

      const proposalId = proposeRes.body.data.proposalId;

      // Layer 3: Kiểm tra bản ghi snapshot_json đã được lưu kiên cố trong DB
      const dbProposalBefore = await prisma.de_xuat_thuc_don.findUnique({
        where: { id: BigInt(proposalId) },
      });
      expect(dbProposalBefore).not.toBeNull();
      expect(dbProposalBefore?.snapshot_json).toBeDefined();
      expect(dbProposalBefore?.snapshot_json.length).toBeGreaterThan(50);

      // 3. HÀNH ĐỘNG PHÁ HOẠI (HOSTILE ACT):
      // Xóa mềm món ăn con và đánh dấu xóa thực đơn gốc khỏi CSDL Master
      const menuC = await prisma.thuc_don.findUnique({
        where: { id: BigInt(menuCId) },
        include: {
          chi_tiet_thuc_don: {
            include: {
              bua_an: {
                include: {
                  chi_tiet_bua_an: true,
                },
              },
            },
          },
        },
      });

      const dishIdToDelete = menuC?.chi_tiet_thuc_don[0]?.bua_an?.chi_tiet_bua_an[0]?.mon_an_id;
      expect(dishIdToDelete).toBeDefined();

      // Đánh dấu xóa món ăn con trong bảng mon_an
      await prisma.mon_an.update({
        where: { id: dishIdToDelete },
        data: { deleted_at: new Date() },
      });

      // Xóa mềm thực đơn gốc C
      await prisma.thuc_don.update({
        where: { id: BigInt(menuCId) },
        data: { deleted_at: new Date() },
      });

      // 4. KIỂM CHỨNG LÂM SÀNG: Gọi API xem đề xuất ngày /api/menu-proposals/:id
      // Layer 1: TUYỆT ĐỐI KHÔNG CRASH 500, phải trả về 200 OK!
      const dayRes = await request(helper.getHttpServer())
        .get(`/api/v1/menu-proposals/${proposalId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: Schema Integrity - Dữ liệu vẫn được đọc trọn vẹn từ snapshot
      expect(dayRes.body).toHaveProperty('data');
      expect(dayRes.body.data.id).toBe(proposalId);
      expect(dayRes.body.data.menuName).toBe('Thực đơn C để đóng băng Snapshot');
      expect(dayRes.body.data.meals.length).toBe(1);
      expect(dayRes.body.data.meals[0].mealName).toBe('Bữa sáng Snapshot');
      expect(dayRes.body.data.meals[0].dishes.length).toBe(1);
      expect(dayRes.body.data.meals[0].dishes[0].name).toBe('Cháo bò bắp dinh dưỡng');
      expect(dayRes.body.data.totalDayNutrients).toHaveProperty('energy');
      expect(dayRes.body.data.totalDayNutrients.energy).toBeGreaterThan(0);

      // 5. KIỂM CHỨNG API XEM CHI TIẾT TOÀN BỘ CÂY: /api/menu-proposals/:id/full
      const fullRes = await request(helper.getHttpServer())
        .get(`/api/v1/menu-proposals/${proposalId}/full`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(fullRes.body.data.proposalId).toBe(proposalId);
      expect(fullRes.body.data.weeks.length).toBeGreaterThan(0);
      expect(fullRes.body.data.weeks[0].days[0].meals[0].dishes[0].name).toBe(
        'Cháo bò bắp dinh dưỡng',
      );

      // Layer 3: Assert DB ground truth
      const dbProposalAfter = await prisma.de_xuat_thuc_don.findUnique({
        where: { id: BigInt(proposalId) },
      });
      expect(dbProposalAfter?.snapshot_json).toBe(dbProposalBefore?.snapshot_json);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 3: CHỐNG TRÙNG NGÀY ĂN KHẨU PHẦN 24H (DUPLICATE INTAKE CONFLICT)
  // ==========================================================================
  describe('Kịch bản 3: Chống Trùng Ngày Ăn Khẩu Phần 24h (Duplicate Intake Date Conflict)', () => {
    it('Cùng 1 bệnh nhân, tạo 2 khẩu phần ăn 24h trong cùng 1 ngày -> Phải bị chặn với mã lỗi 409 CONFLICT', async () => {
      const prisma = helper.getPrisma();
      const intakeDate = '2026-06-15';

      const intakePayload1 = {
        patientId: patientId.toString(),
        intakeDate: intakeDate,
        inputType: IntakeInputType.BY_MEAL,
        note: 'Ghi nhận khẩu phần đợt 1',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng',
            mealTime: '07:00',
            ingredients: [{ ingredientId: beefIngId, rawWeight: 100 }],
          },
        ],
      };

      // 1. Tạo khẩu phần lần 1 -> Thành công 201 Created
      const res1 = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(intakePayload1)
        .expect(201);

      // Layer 2
      expect(res1.body).toHaveProperty('data');
      expect(res1.body.data.patientId).toBe(patientId.toString());
      expect(res1.body.data.intakeDate).toBe(intakeDate);

      // Layer 3: DB khẳng định có 1 bản ghi
      const countAfterFirst = await prisma.khau_phan_24h.count({
        where: {
          benh_nhan_id: patientId,
          ngay_an: new Date(intakeDate),
        },
      });
      expect(countAfterFirst).toBe(1);

      // 2. TẤN CÔNG: Cố tình gửi khẩu phần lần 2 vào đúng ngày intakeDate cho cùng bệnh nhân
      const intakePayload2 = {
        patientId: patientId.toString(),
        intakeDate: intakeDate,
        inputType: IntakeInputType.BY_MEAL,
        note: 'Cố tình ghi nhận đè lần 2 gây xung đột ngày',
        meals: [
          {
            mealOrder: 2,
            mealName: 'Bữa trưa',
            mealTime: '12:00',
            ingredients: [{ ingredientId: porkIngId, rawWeight: 150 }],
          },
        ],
      };

      // Layer 1: HTTP 409 CONFLICT
      const res2 = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(intakePayload2)
        .expect(409);

      // Layer 2: Universal Error Envelope Contract Assertion
      expect(res2.body).toHaveProperty('error');
      expect(['DAILY_INTAKE_DUPLICATE', 'DATA_CONFLICT'].includes(res2.body.error.code)).toBe(true);
      expect(res2.body.meta).toHaveProperty('timestamp');
      expect(res2.body.meta).toHaveProperty('traceId');

      // Layer 3: DIRECT DATABASE STATE VERIFICATION
      // Khẳng định số lượng bản ghi khẩu phần ngày này vẫn TUYỆT ĐỐI CHÍNH XÁC LÀ 1!
      const countAfterAttack = await prisma.khau_phan_24h.count({
        where: {
          benh_nhan_id: patientId,
          ngay_an: new Date(intakeDate),
        },
      });
      expect(countAfterAttack).toBe(1);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 4: XÓA BỘ GIỚI HẠN ĐANG DÙNG (FK CONSTRAINT PROTECTION)
  // ==========================================================================
  describe('Kịch bản 4: Xóa Bộ GiỚi Hạn Đang Dùng (FK Constraint Protection)', () => {
    it('Bộ giới hạn dinh dưỡng đang gán cho Thực đơn D -> Gọi DELETE /api/nutrition-limit-sets/:id phải bị chặn với lỗi 409 CONFLICT', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo Bộ giới hạn dinh dưỡng mới
      const limitPayload = {
        name: 'Bộ giới hạn đạm cho bệnh nhân thận S4',
        reusable: true,
        limits: {
          energy: { min: 1500, max: 2000, target: 1800 },
          protein: { min: 40, max: 60, target: 50 },
          sodium: { max: 2000 },
        },
      };

      const limitRes = await request(helper.getHttpServer())
        .post('/api/v1/nutrition-limit-sets')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(limitPayload)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      const limitId = limitRes.body.data.id;

      // Layer 3: Khẳng định đã tồn tại trong CSDL
      const dbLimitBefore = await prisma.gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitId) },
      });
      expect(dbLimitBefore).not.toBeNull();

      // 2. Tạo Thực đơn D và gán bộ giới hạn này vào
      const menuPayload = {
        menuName: 'Thực đơn D áp dụng bộ giới hạn dinh dưỡng',
        menuType: MenuType.NGAY,
        targetType: TargetType.BENH_NHAN,
        patientId: patientId.toString(),
        nutritionLimitSetId: limitId,
        meals: [
          {
            mealName: 'Bữa ăn D',
            time: '18:00',
            dishes: [
              {
                name: 'Thịt heo nạc luộc',
                details: [{ ingredientId: porkIngId, netWeight: 100 }],
              },
            ],
          },
        ],
      };

      const menuRes = await request(helper.getHttpServer())
        .post('/api/v1/menus')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(menuPayload)
        .expect(201);

      // Layer 3: Khẳng định Thực đơn D trong CSDL đã liên kết khóa ngoại với bộ giới hạn
      const dbMenu = await prisma.thuc_don.findUnique({
        where: { id: BigInt(menuRes.body.data.id) },
      });
      expect(dbMenu?.gioi_han_dinh_duong_id).toBe(BigInt(limitId));

      // 3. TẤN CÔNG: Cố tình gọi API xóa bộ giới hạn đang được sử dụng
      // Layer 1: HTTP 409 CONFLICT
      const deleteRes = await request(helper.getHttpServer())
        .delete(`/api/v1/nutrition-limit-sets/${limitId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(409);

      // Layer 2: API Error Envelope Contract Assertion
      expect(deleteRes.body).toHaveProperty('error');
      expect(
        ['NLS_002', 'FOREIGN_KEY_CONSTRAINT_VIOLATION'].includes(deleteRes.body.error.code),
      ).toBe(true);
      expect(deleteRes.body.error.message).toContain('sử dụng');

      // Layer 3: DIRECT DATABASE STATE ASSERTION
      // Khẳng định bộ giới hạn VẪN CÒN NGUYÊN trong DB, không hề bị xóa mất!
      const dbLimitAfter = await prisma.gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitId) },
      });
      expect(dbLimitAfter).not.toBeNull();
      expect(dbLimitAfter?.ten_gioi_han).toBe('Bộ giới hạn đạm cho bệnh nhân thận S4');
    });
  });

  // ==========================================================================
  // KỊCH BẢN 5: EDIBLE RATIO & ZERO DIVISION PROTECTION
  // ==========================================================================
  describe('Kịch bản 5: Edible Ratio & Zero Division Protection', () => {
    it('5.1 Nhập nguyên liệu thô có tỷ lệ edible = 0% -> Hệ thống không bị crash 500, không sinh NaN, dữ liệu hợp lệ', async () => {
      const intakePayload = {
        patientId: patientId.toString(),
        intakeDate: '2026-07-01',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Thử nghiệm nguyên liệu không ăn được (edible 0%)',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa thử nghiệm',
            mealTime: '08:00',
            ingredients: [{ ingredientId: zeroEdibleIngId, rawWeight: 200 }],
          },
        ],
      };

      // Layer 1: HTTP 201 Created (KHÔNG CRASH 500)
      const res = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(intakePayload)
        .expect(201);

      // Layer 2: Khẳng định không phát sinh NaN hoặc Infinity
      expect(res.body.data).toBeDefined();
      const nutrients = res.body.data.totalDayNutrients;
      expect(Number.isNaN(nutrients.energy)).toBe(false);
      expect(Number.isFinite(nutrients.energy)).toBe(true);
      expect(Number.isNaN(nutrients.protein)).toBe(false);
      expect(Number.isNaN(nutrients.fat)).toBe(false);
      expect(Number.isNaN(nutrients.carbohydrate)).toBe(false);

      // Layer 3: Khẳng định dữ liệu lưu trong DB không bị crash
      const dbIntake = await helper.getPrisma().khau_phan_24h.findFirst({
        where: { benh_nhan_id: patientId, ngay_an: new Date('2026-07-01') },
      });
      expect(dbIntake).not.toBeNull();
    });

    it('5.2 Bệnh nhân nhịn ăn (0 calo, 0 gram) -> Hệ thống xử lý mượt mà, tỷ lệ phân bổ P:L:C không bị lỗi NaN (Zero Division Protection)', async () => {
      const fastingPayload = {
        patientId: patientId.toString(),
        intakeDate: '2026-07-02',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bệnh nhân nhịn ăn chuẩn bị phẫu thuật (0 gram)',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng nhịn ăn',
            mealTime: '07:00',
            ingredients: [{ ingredientId: beefIngId, rawWeight: 0 }],
          },
        ],
      };

      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(fastingPayload)
        .expect(201);

      // Layer 2: API Contract Validation
      expect(res.body.data.totalDayNutrients.energy).toBe(0);
      expect(res.body.data.totalDayNutrients.protein).toBe(0);
      expect(res.body.data.totalDayNutrients.fat).toBe(0);
      expect(res.body.data.totalDayNutrients.carbohydrate).toBe(0);

      // Layer 3: DB Verification
      const dbIntake = await helper.getPrisma().khau_phan_24h.findFirst({
        where: { benh_nhan_id: patientId, ngay_an: new Date('2026-07-02') },
      });
      expect(dbIntake).not.toBeNull();
    });

    it('5.3 Pure Mathematical Engine Edge Cases: Tỷ lệ ăn được âm hoặc 0 và năng lượng = 0 không bao giờ sinh NaN', () => {
      // 1. Tỷ lệ ăn được âm (-30%) phải bị clamp về 0%
      const netWeightNeg = IntakeCalculationEngine.calculateNetWeight(100, -30);
      expect(netWeightNeg.toNumber()).toBe(0);

      // 2. Tỷ lệ ăn được 0%
      const netWeightZero = IntakeCalculationEngine.calculateNetWeight(150, 0);
      expect(netWeightZero.toNumber()).toBe(0);

      // 3. Khối lượng thô âm (-50g) phải được đưa về 0
      const netWeightNegRaw = IntakeCalculationEngine.calculateNetWeight(-50, 80);
      expect(netWeightNegRaw.toNumber()).toBe(0);

      // 4. Động cơ dinh dưỡng thuần: Khi năng lượng = 0, phân bổ macro P:L:C % phải trả về 0, không chia cho 0
      const calcResult = IntakeCalculationEngine.calculateIngredient({
        rawWeight: 0,
        edible: 100,
        protein: 0,
        fat: 0,
        water: 100,
      });

      expect(calcResult.nutrients.energy).toBe(0);
      expect(calcResult.nutrients.proteinRatio).toBe(0);
      expect(calcResult.nutrients.lipidRatio).toBe(0);
      expect(calcResult.nutrients.carbohydrateRatio).toBe(0);
      expect(Number.isNaN(calcResult.nutrients.proteinRatio)).toBe(false);

      // 5. Kiểm tra NutritionEngine core
      const coreCalc = NutritionEngine.calculateIngredientNutrients(
        {
          edible: -10,
          protein: 20,
          fat: 10,
        },
        100,
      );
      expect(coreCalc.netWeightGrams.toNumber()).toBe(0);
      expect(coreCalc.nutrients.energy?.toNumber()).toBe(0);
    });
  });

  // ==========================================================================
  // ENEMY PERSONA COVERAGE (THE 3 ADVERSARIAL ACTORS)
  // ==========================================================================
  describe('Adversarial Persona Attacks', () => {
    // ------------------------------------------------------------------------
    // PERSONA 1: THE STUPID BOT
    // ------------------------------------------------------------------------
    it('Persona 1: The Stupid Bot — Bắn 10 request đồng thời tạo khẩu phần 24h cùng 1 ngày -> Đúng 1 request thành công 201, 9 request bị chặn 409 CONFLICT, DB chỉ có đúng 1 record', async () => {
      const conflictDate = '2026-08-20';
      const rapidFirePayload = {
        patientId: patientId.toString(),
        intakeDate: conflictDate,
        inputType: IntakeInputType.BY_MEAL,
        note: 'Stupid Bot Hammering Request',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Hammer Meal',
            time: '08:00',
            ingredients: [{ ingredientId: beefIngId, rawWeight: 100 }],
          },
        ],
      };

      // Bắn 10 requests cùng 1 thời điểm mà không chờ response (Rapid-fire 10 reqs)
      const attackPromises = Array.from({ length: 10 }).map(() =>
        request(helper.getHttpServer())
          .post('/api/v1/daily-intakes')
          .set('Authorization', `Bearer ${regularToken}`)
          .send(rapidFirePayload),
      );

      const responses = await Promise.all(attackPromises);

      const statusCounts = responses.reduce((acc: Record<number, number>, res) => {
        acc[res.status] = (acc[res.status] || 0) + 1;
        return acc;
      }, {});

      // Layer 1: Đúng 1 request 201 Created, 9 request còn lại phải bị chặn với 409 Conflict
      expect(statusCounts[201]).toBe(1);
      expect(statusCounts[409]).toBe(9);

      // Layer 3: Database Ground Truth - Chỉ có đúng duy nhất 1 bản ghi trong MySQL
      const totalCreated = await helper.getPrisma().khau_phan_24h.count({
        where: {
          benh_nhan_id: patientId,
          ngay_an: new Date(conflictDate),
        },
      });
      expect(totalCreated).toBe(1);
    });

    // ------------------------------------------------------------------------
    // PERSONA 2: THE AMATEUR HACKER
    // ------------------------------------------------------------------------
    it('Persona 2: The Amateur Hacker — SQLi / XSS payload injection & Type smashing', async () => {
      // 2.1 SQL Injection trong tên thực đơn: '; DROP TABLE thuc_don; --
      const sqliPayload = {
        menuName: "Thực đơn '; DROP TABLE thuc_don; --",
        menuType: MenuType.NGAY,
        targetType: TargetType.BENH_NHAN,
        patientId: patientId.toString(),
        meals: [
          {
            mealName: 'Bữa sáng an toàn',
            time: '07:00',
            dishes: [
              {
                name: 'Thịt bò xào',
                details: [{ ingredientId: beefIngId, netWeight: 100 }],
              },
            ],
          },
        ],
      };

      const sqliRes = await request(helper.getHttpServer())
        .post('/api/v1/menus')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(sqliPayload)
        .expect(201);

      expect(sqliRes.body.data.menuName).toBe("Thực đơn '; DROP TABLE thuc_don; --");

      // Layer 3: Khẳng định bảng thuc_don vẫn tồn tại nguyên vẹn trong MySQL
      const tableCheck = await helper
        .getPrisma()
        .$queryRawUnsafe<any[]>("SHOW TABLES LIKE 'thuc_don';");
      expect(tableCheck.length).toBe(1);

      // 2.2 XSS Payload trong ghi chú khẩu phần: <script>alert(1)</script>
      const xssPayload = {
        patientId: patientId.toString(),
        intakeDate: '2026-09-01',
        inputType: IntakeInputType.BY_MEAL,
        note: "<script>alert('XSS_ATTACK_VECTOR')</script>",
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa trưa',
            mealTime: '12:00',
            ingredients: [{ ingredientId: porkIngId, rawWeight: 100 }],
          },
        ],
      };

      const xssRes = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(xssPayload)
        .expect(201);

      expect(xssRes.body.data.note).toBe("<script>alert('XSS_ATTACK_VECTOR')</script>");

      // 2.3 Type Smashing: Gửi rawWeight âm (-150) -> Bị CustomValidationPipe chặn với 400 Bad Request
      const typeSmashPayload = {
        patientId: patientId.toString(),
        intakeDate: '2026-09-02',
        inputType: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa trưa',
            ingredients: [{ ingredientId: porkIngId, rawWeight: -150 }],
          },
        ],
      };

      const smashRes = await request(helper.getHttpServer())
        .post('/api/v1/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(typeSmashPayload)
        .expect(400);

      expect(smashRes.body).toHaveProperty('error');
      expect(smashRes.body.error.code).toBe('VALIDATION_FAILED');
    });

    // ------------------------------------------------------------------------
    // PERSONA 3: THE BROKEN CABLE NETWORK
    // ------------------------------------------------------------------------
    it('Persona 3: The Broken Cable Network — Ghost IDs & Boundary Non-Existent Resources', async () => {
      // 3.1 Truy vấn thực đơn với ID hoàn toàn không tồn tại (Ghost ID: 999999999)
      const notFoundMenuRes = await request(helper.getHttpServer())
        .get('/api/v1/menus/999999999')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(notFoundMenuRes.body.error.code).toBe('MENU_001');

      // 3.2 Xóa bộ giới hạn với ID ma: 999999999 -> 404
      const notFoundLimitRes = await request(helper.getHttpServer())
        .delete('/api/v1/nutrition-limit-sets/999999999')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(notFoundLimitRes.body.error.code).toBe('NLS_004');

      // 3.3 Nộp đề xuất thực đơn cho Menu ID ma: 999999999 -> 404
      const notFoundPropRes = await request(helper.getHttpServer())
        .post('/api/v1/menu-proposals/999999999')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(notFoundPropRes.body.error.code).toBe('MENU_NOT_FOUND');
    });
  });
});
