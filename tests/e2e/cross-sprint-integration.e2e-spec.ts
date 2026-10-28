import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  MenuType,
  TargetType,
  DishStatus,
  IntakeInputType,
  DailyIntakeClinicalReportType,
  NutritionLimitWarning,
} from '../../src/config/enums/domain.enum';

// Nâng timeout cho E2E suite xuyên suốt 4 Sprint để đảm bảo tính toán vi chất và ghi CSDL hoàn tất
jest.setTimeout(120000);

/**
 * ============================================================================
 * CROSS-SPRINT E2E INTEGRATION TEST SUITE (SPRINT 1 -> SPRINT 4)
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Iron Discipline):
 * - Layer 1: Protocol HTTP Status Codes (200 OK, 201 Created)
 * - Layer 2: Universal API Contract Schemas & Envelopes ({ data, meta })
 * - Layer 3: Direct Database State Persistence (Prisma direct queries: expect(dbRecord).toBe(...))
 *
 * Scenarios Covered:
 * - Journey 1: Vòng đời Dinh Dưỡng Bệnh Viện Hoàn Chỉnh (Full Hospital Nutrition Lifecycle)
 *   + Bước 1 (Sprint 1): Khởi tạo Bác sĩ dinh dưỡng & Bệnh nhân nội trú. Tạo nguyên liệu y tế đặc thù
 *                        (Sữa chuyên biệt tiểu đường) có edible = 100%, protein cao, GI thấp. Admin duyệt.
 *   + Bước 2 (Sprint 2): Thiết lập Hướng dẫn Dinh dưỡng cho Nhóm Bệnh 'Đái tháo đường biến chứng suy thận'
 *                        (DIABETES_NEPHROPATHY) + Nhóm mở rộng + Bộ giới hạn dinh dưỡng.
 *   + Bước 3 (Sprint 3): Nấu món ăn lâm sàng từ nguyên liệu trên, áp dụng hệ số sống chín (he_so_song_chin),
 *                        sinh recipe_hash 64-ký tự chuẩn xác, tạo Bữa ăn sáng và Bữa ăn trưa.
 *   + Bước 4 (Sprint 4): Lập Thực đơn tuần 5 cấp, gán Nhóm bệnh & Bộ giới hạn, gọi resolve-dish inline,
 *                        nhân bản sâu (clone), nộp đề xuất đóng băng JSONB Snapshot, Admin duyệt thành CONG_KHAI.
 *   + Bước 5 (Sprint 4): Ghi nhận Khẩu phần 24h thực tế của bệnh nhân dựa trên thực đơn này, tính toán vi chất
 *                        chính xác bằng Decimal.js (edible 100%), xuất báo cáo RDA/DRI 5 dải lâm sàng,
 *                        tải file Excel báo cáo lâm sàng tổng hợp (ALL_IN_ONE).
 * - Journey 2: Mô phỏng Khẩu phần 7 Ngày Liên tiếp (7-Day Clinical Intake Trajectory)
 *   + Tạo 7 bản ghi khẩu phần 24h liên tục trong tuần cho cùng 1 bệnh nhân (01 đến 07).
 *   + Kiểm tra API lọc khoảng thời gian (fromDate, toDate), phân trang (page, limit), lọc theo ngày đơn lẻ.
 *   + Kiểm tra thống kê dinh dưỡng tích lũy và xuất báo cáo Excel đa ngày.
 * ============================================================================
 */
describe('Cross-Sprint Integration E2E: Full Clinical Nutrition Lifecycle (Sprint 1 -> 4)', () => {
  const helper = new TestAppHelper();

  // Tokens & Accounts
  let adminToken: string;
  let adminUser: any;
  let doctorToken: string;
  let doctorUser: any;

  // Domain References across Sprints
  let categoryId: number;
  let patientId: string;
  let patientHospitalCode: string;

  // Sprint 1 Ingredients
  let specialMilkIngId: number;
  let oatIngId: number;

  // Sprint 2 Disease Groups & Limits
  let parentDiseaseGroupId: number;
  let extendedDiseaseGroupId: number;
  let nutritionLimitSetId: string;

  // Sprint 3 Cooking Coefficients, Dishes & Meals
  let milkCoeffId: number;
  let dish1Id: number;
  let dish1RecipeHash: string;
  let dish2Id: number;
  let dish2RecipeHash: string;
  let breakfastMealId: number;
  let lunchMealId: number;

  // Sprint 4 Menus & Proposals
  let weeklyMenuId: string;
  let inlineDishId: string;
  let clonedMenuId: string;
  let proposalId: string;

  // Sprint 4 Daily Intakes
  let day1IntakeId: string;
  const trajectoryIntakeIds: string[] = [];

  // Supertest Binary Parser for Excel downloads
  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  /**
   * Helper dọn dẹp CSDL triệt để tôn trọng thứ tự khóa ngoại MySQL
   */
  async function cleanAllDatabaseTables(): Promise<void> {
    const prisma = helper.getPrisma();
    if (!prisma) return;

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    const tables = [
      'khau_phan_24h_nguyen_lieu',
      'khau_phan_24h_bua_an',
      'khau_phan_24h',
      'chi_tiet_thuc_don',
      'de_xuat_thuc_don',
      'thuc_don',
      'gioi_han_dinh_duong',
      'chi_tiet_bua_an',
      'bua_an',
      'chi_tiet_mon_an',
      'mon_an',
      'he_so_song_chin',
      'de_xuat_nguyen_lieu',
      'nguyen_lieu',
      'danh_muc',
      'nhom_benh_mo_rong',
      'nhom_benh',
      'huong_dan_dinh_duong',
      'benh_nhan',
      'minh_chung',
      'yeu_cau_thanh_toan',
      'ho_so_ca_nhan',
      'lich_su_dang_nhap',
      'thiet_bi_dang_nhap',
      'ma_xac_thuc',
      'dang_ky_cho_xac_thuc',
      'dang_ky',
      '_system_jobs_dlq',
      '_system_jobs',
      '_system_cache',
      'nguoi_dung',
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
      } catch {
        // Bỏ qua lỗi nếu bảng trống hoặc không khả dụng
      }
    }
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
  }

  beforeAll(async () => {
    await helper.init();
    await cleanAllDatabaseTables();

    const prisma = helper.getPrisma();

    // 1. Tạo danh mục chuẩn dùng chung cho toàn bộ chu trình lâm sàng
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng y học lâm sàng' },
    });
    categoryId = cat.id;

    // 2. Khởi tạo tài khoản Quản trị viên (Admin) và Bác sĩ dinh dưỡng (Doctor User)
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const admin = await helper.createTestUser({
      username: `admin_cross_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Dinh Dưỡng BV',
      email: `admin_cross_${uniqueSuffix}@nutrihospital.vn`,
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const doctor = await helper.createTestUser({
      username: `doctor_cross_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Trưởng Khoa Lâm Sàng',
      email: `doctor_cross_${uniqueSuffix}@nutrihospital.vn`,
    });
    doctorToken = doctor.token;
    doctorUser = doctor.user;
  }, 90000);

  afterAll(async () => {
    await cleanAllDatabaseTables();
    if (helper.getPrisma()) {
      await helper.getPrisma().$disconnect();
    }
    await helper.close();
  });

  // ==========================================================================
  // JOURNEY 1: VÒNG ĐỜI DINH DƯỠNG BỆNH VIỆN HOÀN CHỈNH (SPRINT 1 -> SPRINT 4)
  // ==========================================================================
  describe('User Journey 1: Vòng đời Dinh Dưỡng Bệnh Viện Hoàn Chỉnh (Full Hospital Nutrition Lifecycle)', () => {
    // ------------------------------------------------------------------------
    // BƯỚC 1 (SPRINT 1): Khởi tạo Bác sĩ dinh dưỡng, Bệnh nhân & Nguyên liệu y tế
    // ------------------------------------------------------------------------
    describe('Bước 1 (Sprint 1): Khởi tạo Bác sĩ, Bệnh nhân nội trú & Tạo/Phê duyệt Nguyên liệu y tế', () => {
      it('1.1 Xác nhận Bác sĩ và Admin tồn tại trong CSDL -> Layer 3 verify nguoi_dung & ho_so_ca_nhan', async () => {
        const prisma = helper.getPrisma();

        const dbDoctor = await prisma.nguoi_dung.findUnique({
          where: { id: doctorUser.id },
          include: { ho_so_ca_nhan: true },
        });
        expect(dbDoctor).not.toBeNull();
        expect(dbDoctor?.vai_tro).toBe('USER');
        expect(dbDoctor?.active).toBe(true);
        expect(dbDoctor?.ho_so_ca_nhan?.ho_ten).toBe('Bác Sĩ Trưởng Khoa Lâm Sàng');

        const dbAdmin = await prisma.nguoi_dung.findUnique({
          where: { id: adminUser.id },
          include: { ho_so_ca_nhan: true },
        });
        expect(dbAdmin).not.toBeNull();
        expect(dbAdmin?.vai_tro).toBe('ADMIN');
      });

      it('1.2 Khởi tạo Bệnh nhân nội trú chỉ định điều trị dinh dưỡng -> Layer 3 verify benh_nhan', async () => {
        const prisma = helper.getPrisma();
        patientHospitalCode = `BN-NEPHRO-${Date.now()}`;

        const patient = await prisma.benh_nhan.create({
          data: {
            nguoi_dung_id: doctorUser.id,
            ho_ten: 'Nguyễn Văn Bệnh Nhân Thận Mạn',
            so_dien_thoai: '0912345678',
            ngay_sinh: new Date('1982-05-10'), // 44 tuổi
            gioi_tinh: 'NAM',
            can_nang: 64.0,
            chieu_cao: 168.0,
            he_so_hoat_dong: 1.3,
            ma_benh_nhan_bv: patientHospitalCode,
          },
        });

        patientId = patient.id.toString();

        // Layer 3 Assertion: Direct DB verification
        const dbPatient = await prisma.benh_nhan.findUnique({
          where: { id: patient.id },
        });
        expect(dbPatient).not.toBeNull();
        expect(dbPatient?.ho_ten).toBe('Nguyễn Văn Bệnh Nhân Thận Mạn');
        expect(dbPatient?.ma_benh_nhan_bv).toBe(patientHospitalCode);
        expect(dbPatient?.nguoi_dung_id).toBe(doctorUser.id);
        expect(Number(dbPatient?.can_nang)).toBe(64.0);
      });

      it('1.3 Bác sĩ tạo Nguyên liệu y tế đặc thù (Sữa chuyên biệt tiểu đường suy thận, edible=100%, protein cao, GI thấp) -> Layer 3 verify nguyen_lieu: CHO_DUYET', async () => {
        const payload = {
          material: 'Sữa chuyên biệt tiểu đường suy thận Glucerna Nepro',
          categoryId: categoryId,
          loaiProtein: 'DONG_VAT',
          edible: 100, // Tỷ lệ ăn được 100%
          water: 78.0,
          protein: 19.5, // Hàm lượng đạm cao đặc thù
          fat: 4.2,
          carbohydrate: 8.5,
          energy: 150.0,
          fiber: 1.2,
          calci: 160.0,
          iron: 2.4,
          sodium: 48.0,
          potassium: 110.0,
          vitaminC: 20.0,
        };

        // Layer 1: HTTP Status Code 200 OK (tạo thành công)
        const res = await request(helper.getHttpServer())
          .post('/api/v1/ingredients')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(200);

        // Layer 2: API Contract Envelope Assertion
        expect(res.body).toHaveProperty('status', 200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.material).toBe('Sữa chuyên biệt tiểu đường suy thận Glucerna Nepro');
        expect(res.body.data.trang_thai).toBe('CHO_DUYET');
        expect(res.body.meta).toHaveProperty('traceId');

        specialMilkIngId = Number(res.body.data.id);

        // Layer 3: Direct Database State Persistence Assertion
        const dbIng = await helper.getPrisma().nguyen_lieu.findUnique({
          where: { id: BigInt(specialMilkIngId) },
        });
        expect(dbIng).not.toBeNull();
        expect(dbIng?.ten_nguyen_lieu).toBe('Sữa chuyên biệt tiểu đường suy thận Glucerna Nepro');
        expect(dbIng?.edible).toBe(100);
        expect(Number(dbIng?.protein)).toBe(19.5);
        expect(dbIng?.trang_thai).toBe('CHO_DUYET');
        expect(dbIng?.tao_boi_id).toBe(doctorUser.id);
      });

      it('1.4 Admin phê duyệt nguyên liệu y tế đặc thù -> Layer 3 verify nguyen_lieu: DA_DUYET', async () => {
        // Layer 1: HTTP Status Code 201 Created (NestJS Post default)
        const res = await request(helper.getHttpServer())
          .post(`/api/v1/ingredients/approve/${specialMilkIngId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data.id).toBe(specialMilkIngId.toString());
        expect(res.body.data.trang_thai).toBe('DA_DUYET');

        // Layer 3: Direct Database State Persistence Assertion
        const dbApproved = await helper.getPrisma().nguyen_lieu.findUnique({
          where: { id: BigInt(specialMilkIngId) },
        });
        expect(dbApproved).not.toBeNull();
        expect(dbApproved?.trang_thai).toBe('DA_DUYET');
      });

      it('1.5 Khởi tạo nguyên liệu bổ trợ thứ hai (Bột yến mạch y tế giàu chất xơ) -> Layer 3 verify nguyen_lieu', async () => {
        const payload = {
          material: 'Bột yến mạch y tế giàu chất xơ Beta-Glucan',
          categoryId: categoryId,
          loaiProtein: 'THUC_VAT',
          edible: 100,
          water: 10.0,
          protein: 13.5,
          fat: 6.8,
          fiber: 10.5,
          carbohydrate: 62.0,
          calci: 54.0,
          iron: 4.7,
          sodium: 2.0,
          potassium: 429.0,
        };

        const res = await request(helper.getHttpServer())
          .post('/api/v1/ingredients')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(200);

        oatIngId = Number(res.body.data.id);

        // Layer 3: DB Verification
        const dbOat = await helper.getPrisma().nguyen_lieu.findUnique({
          where: { id: BigInt(oatIngId) },
        });
        expect(dbOat).not.toBeNull();
        expect(dbOat?.trang_thai).toBe('DA_DUYET');
        expect(dbOat?.edible).toBe(100);
      });
    });

    // ------------------------------------------------------------------------
    // BƯỚC 2 (SPRINT 2): Thiết lập Hướng dẫn Dinh dưỡng cho Nhóm Bệnh
    // ------------------------------------------------------------------------
    describe("Bước 2 (Sprint 2): Thiết lập Nhóm bệnh 'DIABETES_NEPHROPATHY', Nhóm mở rộng & Bộ giới hạn dinh dưỡng", () => {
      it('2.1 Admin tạo danh mục nhóm bệnh cha: DIABETES_NEPHROPATHY (Mã DTD_THAN <= 10 ký tự) -> Layer 3 verify nhom_benh', async () => {
        const payload = {
          code: 'DTD_THAN',
          maNhom: 'DTD_THAN',
          name: 'Đái tháo đường biến chứng suy thận',
          tenNhom: 'Đái tháo đường biến chứng suy thận',
        };

        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .post('/api/v1/disease-groups')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(200);

        // Layer 2: API Contract Envelope
        expect(res.body).toHaveProperty('status', 200);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.code).toBe('DTD_THAN');

        parentDiseaseGroupId = res.body.data.id;

        // Layer 3: Direct Database State Persistence Assertion
        const dbGroup = await helper.getPrisma().nhom_benh.findFirst({
          where: { ma_nhom: 'DTD_THAN' },
        });
        expect(dbGroup).not.toBeNull();
        expect(dbGroup?.ma_nhom).toBe('DTD_THAN');
        expect(dbGroup?.ten_nhom).toBe('Đái tháo đường biến chứng suy thận');
      });

      it('2.2 Bác sĩ tạo Nhóm bệnh mở rộng theo phác đồ cá thể hóa: DN-STAGE3 -> Layer 3 verify nhom_benh_mo_rong', async () => {
        const payload = {
          parentId: parentDiseaseGroupId,
          extendedCode: 'DN-STAGE3',
          displayName: 'Đái tháo đường suy thận giai đoạn 3 - Hạn chế đạm & Natri',
        };

        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .post('/api/v1/extended-disease-groups')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(200);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toMatchObject({
          extendedCode: 'DN-STAGE3',
          displayName: 'Đái tháo đường suy thận giai đoạn 3 - Hạn chế đạm & Natri',
          userId: doctorUser.id,
          parentId: parentDiseaseGroupId,
        });

        extendedDiseaseGroupId = res.body.data.id;

        // Layer 3: Direct Database State Persistence Assertion
        const dbExt = await helper.getPrisma().nhom_benh_mo_rong.findUnique({
          where: { id: extendedDiseaseGroupId },
        });
        expect(dbExt).not.toBeNull();
        expect(dbExt?.ma_nhom_mo_rong).toBe('DN-STAGE3');
        expect(dbExt?.ma_nhom_cha).toBe(parentDiseaseGroupId);
        expect(dbExt?.nguoi_dung_id).toBe(doctorUser.id);
      });

      it('2.3 Bác sĩ tạo Bộ Giới Hạn Dinh Dưỡng áp dụng cho phác đồ lâm sàng -> Layer 3 verify gioi_han_dinh_duong', async () => {
        const payload = {
          name: 'Phác đồ Giới hạn Dinh dưỡng ĐTĐ Suy Thận Độ 3',
          warningRule: NutritionLimitWarning.GTE_5,
          reusable: true,
          limits: {
            energy: 1600,
            protein: 50,
            carbohydrate: 180,
            sodium: 1200,
            potassium: 1800,
          },
        };

        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post('/api/nutrition-limit-sets')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toBe('Phác đồ Giới hạn Dinh dưỡng ĐTĐ Suy Thận Độ 3');
        expect(res.body.data.warningRule).toBe(NutritionLimitWarning.GTE_5);
        expect(res.body.data.reusable).toBe(true);

        nutritionLimitSetId = res.body.data.id.toString();

        // Layer 3: Direct Database State Persistence Assertion
        const dbLimit = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
          where: { id: BigInt(nutritionLimitSetId) },
        });
        expect(dbLimit).not.toBeNull();
        expect(dbLimit?.ten_gioi_han).toBe('Phác đồ Giới hạn Dinh dưỡng ĐTĐ Suy Thận Độ 3');
        expect(dbLimit?.canh_bao).toBe(NutritionLimitWarning.GTE_5);
        expect(dbLimit?.nguoi_dung_id).toBe(doctorUser.id);
      });

      it('2.4 Lưu hướng dẫn phác đồ lâm sàng chi tiết trong CSDL -> Layer 3 verify huong_dan_dinh_duong', async () => {
        const prisma = helper.getPrisma();
        const guideline = await prisma.huong_dan_dinh_duong.create({
          data: {
            ma_ky_hieu: 'DIABETES_NEPHROPATHY',
            ten_benh: 'Đái tháo đường biến chứng suy thận',
            nguyen_tac:
              'Kiểm soát nghiêm ngặt carbohydrate, giảm tải đạm động vật, duy trì Natri dưới 1500mg, kiểm soát Kali và Phospho.',
            luu_y: 'Đo lường chức năng thận eGFR và HbA1c định kỳ mỗi 4 tuần.',
            co_cau_khau_phan: {
              energyKcal: 1600,
              proteinGrams: 50,
              carbohydrateGrams: 180,
              lipidGrams: 40,
            },
            nguoi_dung_id: doctorUser.id,
          },
        });

        // Layer 3 Assertion
        const dbGuideline = await prisma.huong_dan_dinh_duong.findUnique({
          where: { id: guideline.id },
        });
        expect(dbGuideline).not.toBeNull();
        expect(dbGuideline?.ma_ky_hieu).toBe('DIABETES_NEPHROPATHY');
        expect(dbGuideline?.nguoi_dung_id).toBe(doctorUser.id);
      });
    });

    // ------------------------------------------------------------------------
    // BƯỚC 3 (SPRINT 3): Nấu món ăn lâm sàng, hệ số sống chín, recipe_hash & Bữa ăn
    // ------------------------------------------------------------------------
    describe('Bước 3 (Sprint 3): Thiết lập Hệ số sống chín, Nấu món ăn lâm sàng (sinh recipe_hash 64-char) & Tạo Bữa ăn', () => {
      it('3.1 Thiết lập hệ số sống chín công khai cho Sữa chuyên biệt -> Layer 3 verify he_so_song_chin', async () => {
        const payload = {
          ingredientId: specialMilkIngId,
          processingMethod: 'Pha ấm nhiệt độ chuẩn 50°C',
          coefficient: 1.05,
          isPublic: true,
        };

        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .post('/api/v1/coefficients')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(200);

        // Layer 2: API Contract Envelope
        expect(res.body.data.ingredientId).toBe(specialMilkIngId);
        expect(res.body.data.processingMethod).toBe('Pha ấm nhiệt độ chuẩn 50°C');
        expect(res.body.data.coefficient).toBe(1.05);

        milkCoeffId = Number(res.body.data.id);

        // Layer 3: Direct Database State Persistence Assertion
        const dbCoeff = await helper.getPrisma().he_so_song_chin.findUnique({
          where: { id: BigInt(milkCoeffId) },
        });
        expect(dbCoeff).not.toBeNull();
        expect(Number(dbCoeff?.nguyen_lieu_id)).toBe(specialMilkIngId);
        expect(Number(dbCoeff?.he_so)).toBe(1.05);
        expect(dbCoeff?.is_public).toBe(true);
      });

      it('3.2 Bác sĩ nấu Món ăn 1 (Súp sữa y học kiểm soát đường huyết) -> Layer 3 verify mon_an với recipe_hash chuẩn 64 ký tự SHA-256', async () => {
        const payload = {
          name: 'Súp sữa y học kiểm soát đường huyết',
          details: [{ ingredientId: specialMilkIngId, netWeight: 180 }],
        };

        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .post('/api/v1/dishes')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(200);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toBe('Súp sữa y học kiểm soát đường huyết');
        expect(res.body.data.status).toBe(DishStatus.RIENG_TU);
        expect(res.body.data).toHaveProperty('recipeHash');
        expect(res.body.data.recipeHash).toHaveLength(64); // Chuỗi băm SHA-256 chính xác 64 ký tự Hex
        expect(res.body.data.totalNutrients.protein).toBeGreaterThan(0);

        dish1Id = Number(res.body.data.id);
        dish1RecipeHash = res.body.data.recipeHash;

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbDish = await prisma.mon_an.findUnique({
          where: { id: BigInt(dish1Id) },
          include: { chi_tiet_mon_an: true },
        });
        expect(dbDish).not.toBeNull();
        expect(dbDish?.ten_mon).toBe('Súp sữa y học kiểm soát đường huyết');
        expect(dbDish?.recipe_hash).toBe(dish1RecipeHash);
        expect(dbDish?.recipe_hash?.length).toBe(64);
        expect(dbDish?.nguoi_dung_id).toBe(doctorUser.id);
        expect(dbDish?.chi_tiet_mon_an.length).toBe(1);
        expect(Number(dbDish?.chi_tiet_mon_an[0].khoi_luong_song_sach)).toBe(180);
      });

      it('3.3 Bác sĩ nấu Món ăn 2 kết hợp (Cháo yến mạch dinh dưỡng giảm muối) -> Layer 3 verify mon_an & chi_tiet_mon_an', async () => {
        const payload = {
          name: 'Cháo yến mạch dinh dưỡng giảm muối',
          details: [
            { ingredientId: oatIngId, netWeight: 80 },
            { ingredientId: specialMilkIngId, netWeight: 50 },
          ],
        };

        const res = await request(helper.getHttpServer())
          .post('/api/v1/dishes')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(200);

        dish2Id = Number(res.body.data.id);
        dish2RecipeHash = res.body.data.recipeHash;
        expect(dish2RecipeHash).toHaveLength(64);

        // Layer 3: DB Verification
        const dbDish2 = await helper.getPrisma().mon_an.findUnique({
          where: { id: BigInt(dish2Id) },
          include: { chi_tiet_mon_an: true },
        });
        expect(dbDish2).not.toBeNull();
        expect(dbDish2?.chi_tiet_mon_an.length).toBe(2);
      });

      it('3.4 Bác sĩ tạo Bữa ăn sáng lâm sàng và Bữa ăn trưa lâm sàng -> Layer 3 verify bua_an & chi_tiet_bua_an', async () => {
        // Tạo Bữa sáng
        const breakfastPayload = {
          mealName: 'Bữa sáng lâm sàng đái tháo đường',
          time: '07:00',
          dishes: [{ dishId: dish1Id, coefficient: 1.05 }],
        };

        const resBreakfast = await request(helper.getHttpServer())
          .post('/api/v1/meal')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(breakfastPayload)
          .expect(200);

        expect(resBreakfast.body.data.mealName).toBe('Bữa sáng lâm sàng đái tháo đường');
        expect(resBreakfast.body.data.totalMealNutrients).toBeDefined();
        breakfastMealId = Number(resBreakfast.body.data.id);

        // Tạo Bữa trưa
        const lunchPayload = {
          mealName: 'Bữa trưa hồi phục thận mạn',
          time: '11:30',
          dishes: [{ dishId: dish2Id, coefficient: 1.1 }],
        };

        const resLunch = await request(helper.getHttpServer())
          .post('/api/v1/meal')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(lunchPayload)
          .expect(200);

        expect(resLunch.body.data.mealName).toBe('Bữa trưa hồi phục thận mạn');
        lunchMealId = Number(resLunch.body.data.id);

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbBreakfast = await prisma.bua_an.findUnique({
          where: { id: BigInt(breakfastMealId) },
          include: { chi_tiet_bua_an: true },
        });
        expect(dbBreakfast).not.toBeNull();
        expect(dbBreakfast?.ten_bua_an).toBe('Bữa sáng lâm sàng đái tháo đường');
        expect(dbBreakfast?.gio_an).toBe('07:00');
        expect(dbBreakfast?.chi_tiet_bua_an.length).toBe(1);
        expect(Number(dbBreakfast?.chi_tiet_bua_an[0].he_so_song_chin)).toBe(1.05);

        const dbLunch = await prisma.bua_an.findUnique({
          where: { id: BigInt(lunchMealId) },
          include: { chi_tiet_bua_an: true },
        });
        expect(dbLunch).not.toBeNull();
        expect(dbLunch?.ten_bua_an).toBe('Bữa trưa hồi phục thận mạn');
      });
    });

    // ------------------------------------------------------------------------
    // BƯỚC 4 (SPRINT 4): Thực đơn tuần 5 cấp, resolve-dish, clone, propose & approve
    // ------------------------------------------------------------------------
    describe('Bước 4 (Sprint 4): Lập Thực đơn tuần 5 cấp, resolve-dish inline, Clone sâu, Nộp đề xuất đóng băng & Admin duyệt', () => {
      it('4.1 Bác sĩ lập Thực đơn tuần 5 cấp gán Bệnh nhân + Nhóm bệnh + Bộ giới hạn -> Layer 3 verify thuc_don qua 5 cấp', async () => {
        const payload = {
          menuName: 'Thực đơn tuần điều trị ĐTĐ biến chứng thận',
          menuType: MenuType.TUAN,
          targetType: TargetType.BENH_NHAN,
          patientId: patientId,
          diseaseGroupId: extendedDiseaseGroupId,
          nutritionLimitSetId: nutritionLimitSetId,
          weeks: [
            {
              weekNo: 1,
              days: [
                {
                  dayOfWeek: 2, // Thứ 2
                  meals: [
                    {
                      mealName: 'Bữa sáng tuần 1',
                      time: '07:00',
                      dishes: [
                        {
                          name: 'Súp sữa y học kiểm soát đường huyết',
                          coefficient: 1.05,
                          details: [{ ingredientId: specialMilkIngId, netWeight: 180 }],
                        },
                      ],
                    },
                    {
                      mealName: 'Bữa trưa tuần 1',
                      time: '11:30',
                      dishes: [
                        {
                          name: 'Cháo yến mạch dinh dưỡng giảm muối',
                          coefficient: 1.1,
                          details: [
                            { ingredientId: oatIngId, netWeight: 80 },
                            { ingredientId: specialMilkIngId, netWeight: 50 },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };

        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post('/api/menus')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.menuName).toBe('Thực đơn tuần điều trị ĐTĐ biến chứng thận');
        expect(res.body.data.menuType).toBe(MenuType.TUAN);

        weeklyMenuId = res.body.data.id.toString();

        // Layer 3: Direct Database State Persistence Assertion Across All 5 Levels
        const prisma = helper.getPrisma();

        // Cấp 1: thuc_don
        const dbMenu = await prisma.thuc_don.findUnique({
          where: { id: BigInt(weeklyMenuId) },
        });
        expect(dbMenu).not.toBeNull();
        expect(dbMenu?.ten_thuc_don).toBe('Thực đơn tuần điều trị ĐTĐ biến chứng thận');
        expect(dbMenu?.benh_nhan_id).toBe(BigInt(patientId));
        expect(dbMenu?.nhom_benh_id).toBe(extendedDiseaseGroupId);
        expect(dbMenu?.gioi_han_dinh_duong_id).toBe(BigInt(nutritionLimitSetId));
        expect(dbMenu?.nguoi_dung_id).toBe(doctorUser.id);

        // Cấp 2 & 3: chi_tiet_thuc_don (Tuần 1, Thứ 2)
        const dbDetails = await prisma.chi_tiet_thuc_don.findMany({
          where: { thuc_don_id: BigInt(weeklyMenuId) },
        });
        expect(dbDetails.length).toBe(2);
        expect(dbDetails[0].so_tuan).toBe(1);
        expect(dbDetails[0].thu_trong_tuan).toBe(2);

        // Cấp 4 & 5: bua_an, chi_tiet_bua_an, mon_an
        const firstMealId = dbDetails[0].bua_an_id;
        const dbMeal = await prisma.bua_an.findUnique({
          where: { id: firstMealId },
          include: { chi_tiet_bua_an: { include: { mon_an: true } } },
        });
        expect(dbMeal).not.toBeNull();
        expect(dbMeal?.chi_tiet_bua_an.length).toBeGreaterThan(0);
        expect(dbMeal?.chi_tiet_bua_an[0].mon_an.recipe_hash).toBeDefined();
      });

      it('4.2 Gọi resolve-dish inline tạo nhanh món tráng miệng bổ sung -> Layer 3 verify mon_an với recipe_hash', async () => {
        const payload = {
          name: 'Sữa dinh dưỡng y học pha nhanh inline',
          coefficient: 1.0,
          details: [{ ingredientId: specialMilkIngId, netWeight: 100 }],
        };

        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post(`/api/menus/${weeklyMenuId}/resolve-dish`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('dishId');
        expect(res.body.data.name).toBe('Sữa dinh dưỡng y học pha nhanh inline');
        expect(res.body.data.recipeHash).toHaveLength(64);

        inlineDishId = res.body.data.dishId;

        // Layer 3: Direct Database State Persistence Assertion
        const dbInlineDish = await helper.getPrisma().mon_an.findUnique({
          where: { id: BigInt(inlineDishId) },
        });
        expect(dbInlineDish).not.toBeNull();
        expect(dbInlineDish?.ten_mon).toBe('Sữa dinh dưỡng y học pha nhanh inline');
        expect(dbInlineDish?.recipe_hash).toBe(res.body.data.recipeHash);
      });

      it('4.3 Bác sĩ nhân bản thực đơn sâu (Deep Clone) -> Layer 3 verify thuc_don [Bản sao] và bản sao bữa ăn độc lập', async () => {
        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post(`/api/menus/${weeklyMenuId}/clone`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data.id).not.toBe(weeklyMenuId);
        expect(res.body.data.menuName).toContain('[Bản sao]');

        clonedMenuId = res.body.data.id;

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbCloned = await prisma.thuc_don.findUnique({
          where: { id: BigInt(clonedMenuId) },
        });
        expect(dbCloned).not.toBeNull();
        expect(dbCloned?.ten_thuc_don).toBe('[Bản sao] Thực đơn tuần điều trị ĐTĐ biến chứng thận');
        expect(dbCloned?.nguoi_dung_id).toBe(doctorUser.id);

        const clonedDetails = await prisma.chi_tiet_thuc_don.findMany({
          where: { thuc_don_id: BigInt(clonedMenuId) },
        });
        expect(clonedDetails.length).toBe(2);

        // Bữa ăn của bản sao phải có ID mới, không trỏ ngược vào bữa ăn thực đơn gốc
        const originalDetails = await prisma.chi_tiet_thuc_don.findMany({
          where: { thuc_don_id: BigInt(weeklyMenuId) },
        });
        const originalMealIds = originalDetails.map((d) => d.bua_an_id.toString());
        expect(originalMealIds).not.toContain(clonedDetails[0].bua_an_id.toString());
      });

      it('4.4 Nộp đề xuất thực đơn cho Admin duyệt (đóng băng Deep JSONB Snapshot) -> Layer 3 verify de_xuat_thuc_don', async () => {
        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post(`/api/menu-proposals/${weeklyMenuId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data.success).toBe(true);
        expect(res.body.data).toHaveProperty('proposalId');

        proposalId = res.body.data.proposalId;

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbProposal = await prisma.de_xuat_thuc_don.findUnique({
          where: { id: BigInt(proposalId) },
        });
        expect(dbProposal).not.toBeNull();
        expect(dbProposal?.menu_goc_id).toBe(BigInt(weeklyMenuId));
        expect(dbProposal?.nguoi_de_xuat_id).toBe(doctorUser.id);
        expect(dbProposal?.trang_thai).toBe('CHO_DUYET');

        // Khẳng định snapshot_json đã đóng băng toàn bộ cấu trúc cây thực đơn tĩnh
        expect(dbProposal?.snapshot_json).toBeDefined();
        const snapshot = JSON.parse(dbProposal!.snapshot_json);
        expect(snapshot.menuName).toBe('Thực đơn tuần điều trị ĐTĐ biến chứng thận');
        expect(Array.isArray(snapshot.weeks)).toBe(true);
        expect(snapshot.weeks.length).toBeGreaterThan(0);
        expect(JSON.stringify(snapshot)).toContain('Súp sữa y học kiểm soát đường huyết');
      });

      it('4.5 Admin phê duyệt đề xuất thực đơn -> Layer 3 verify de_xuat_thuc_don: DA_DUYET và thuc_don gốc: CONG_KHAI', async () => {
        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .put(`/api/menu-proposals/${proposalId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Layer 2: API Contract Envelope
        expect(res.body.data.success).toBe(true);

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbApprovedProp = await prisma.de_xuat_thuc_don.findUnique({
          where: { id: BigInt(proposalId) },
        });
        expect(dbApprovedProp).not.toBeNull();
        expect(dbApprovedProp?.trang_thai).toBe('DA_DUYET');
        expect(dbApprovedProp?.nguoi_phe_duyet_id).toBe(adminUser.id);
        expect(dbApprovedProp?.ngay_phe_duyet).toBeDefined();

        const dbPublicMenu = await prisma.thuc_don.findUnique({
          where: { id: BigInt(weeklyMenuId) },
        });
        expect(dbPublicMenu).not.toBeNull();
        expect(dbPublicMenu?.loai_thuc_don).toBe('CONG_KHAI');
      });
    });

    // ------------------------------------------------------------------------
    // BƯỚC 5 (SPRINT 4): Khẩu phần 24h thực tế, tính toán 86 vi chất, RDA/DRI & Excel
    // ------------------------------------------------------------------------
    describe('Bước 5 (Sprint 4): Ghi nhận Khẩu phần 24h thực tế, Tính toán 86 vi chất (Decimal.js, edible=100%), Báo cáo RDA/DRI & Xuất Excel ALL_IN_ONE', () => {
      it('5.1 Ghi nhận Khẩu phần 24h ngày đầu tiên (2026-06-01) chế độ BY_MEAL -> Layer 3 verify khau_phan_24h, bua_an, nguyen_lieu', async () => {
        const payload = {
          patientId: patientId,
          intakeDate: '2026-06-01',
          inputType: IntakeInputType.BY_MEAL,
          note: 'Khẩu phần thực tế Ngày 1 áp dụng theo phác đồ ĐTĐ suy thận',
          meals: [
            {
              mealOrder: 1,
              mealName: 'Bữa sáng lâm sàng',
              mealTime: '07:00',
              ingredients: [
                { ingredientId: specialMilkIngId, rawWeight: 200 }, // edible 100% -> net = 200g
              ],
            },
            {
              mealOrder: 2,
              mealName: 'Bữa trưa lâm sàng',
              mealTime: '11:30',
              ingredients: [
                { ingredientId: oatIngId, rawWeight: 100 }, // edible 100% -> net = 100g
                { ingredientId: specialMilkIngId, rawWeight: 50 },
              ],
            },
          ],
        };

        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post('/api/daily-intakes')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.patientId).toBe(patientId);
        expect(res.body.data.inputType).toBe(IntakeInputType.BY_MEAL);
        expect(res.body.data.totalDayNutrients).toBeDefined();
        expect(res.body.data.totalDayNutrients.protein).toBeGreaterThan(0);
        expect(res.body.data.totalDayNutrients.energy).toBeGreaterThan(0);
        expect(res.body.data.meals.length).toBe(2);

        day1IntakeId = res.body.data.id;
        trajectoryIntakeIds.push(day1IntakeId);

        // Layer 3: Direct Database State Persistence Assertion
        const prisma = helper.getPrisma();
        const dbIntake = await prisma.khau_phan_24h.findUnique({
          where: { id: BigInt(day1IntakeId) },
        });
        expect(dbIntake).not.toBeNull();
        expect(dbIntake?.benh_nhan_id).toBe(BigInt(patientId));
        expect(dbIntake?.nguoi_dung_id).toBe(doctorUser.id);
        expect(dbIntake?.kieu_nhap).toBe(IntakeInputType.BY_MEAL);

        const dbMeals = await prisma.khau_phan_24h_bua_an.findMany({
          where: { khau_phan_24h_id: BigInt(day1IntakeId) },
          include: { khau_phan_24h_nguyen_lieu: true },
        });
        expect(dbMeals.length).toBe(2);

        // Khẳng định công thức edible = 100%: khoi_luong_song_sach = rawWeight * edible / 100 = 200
        const milkInBreakfast = dbMeals[0].khau_phan_24h_nguyen_lieu[0];
        expect(Number(milkInBreakfast.khoi_luong_song_sach)).toBe(200);
      });

      it('5.2 Xuất Báo cáo đối chiếu RDA/DRI lâm sàng 5 dải đánh giá -> Layer 3 verify thông số nhân khẩu học', async () => {
        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .get(`/api/daily-intakes/${day1IntakeId}/rda-report`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .expect(200);

        // Layer 2: API Contract Envelope
        const rdaData = res.body.data;
        expect(rdaData).toHaveProperty('demographic');
        expect(rdaData.demographic.gender).toBe('NAM');
        expect(rdaData.demographic.ageYears).toBeGreaterThanOrEqual(40);
        expect(Array.isArray(rdaData.nutrients)).toBe(true);
        expect(rdaData.nutrients.length).toBeGreaterThan(0);

        // Kiểm tra phân loại dải lâm sàng (alertLevel, fulfillmentPercent, status)
        const proteinNutrient = rdaData.nutrients.find((n: any) => n.code === 'protein');
        expect(proteinNutrient).toBeDefined();
        expect(proteinNutrient).toHaveProperty('fulfillmentPercent');
        expect(proteinNutrient).toHaveProperty('status');

        // Layer 3: Direct Database State Persistence Assertion
        const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
          where: { id: BigInt(patientId) },
        });
        expect(dbPatient).not.toBeNull();
        expect(dbPatient?.gioi_tinh).toBe('NAM');
      });

      it('5.3 Tải file Excel báo cáo lâm sàng tổng hợp (ALL_IN_ONE) -> Layer 3 verify', async () => {
        // Layer 1: HTTP Status Code 200 OK
        const res = await request(helper.getHttpServer())
          .get(
            `/api/daily-intakes/${day1IntakeId}/export?reportType=${DailyIntakeClinicalReportType.ALL_IN_ONE}`,
          )
          .set('Authorization', `Bearer ${doctorToken}`)
          .buffer(true)
          .parse(binaryBufferParser)
          .expect(200);

        // Layer 2: Binary Headers & Buffer Content
        expect(res.headers['content-type']).toContain(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(res.headers['content-disposition']).toContain(
          `attachment; filename="bao_cao_lam_sang_24h_${day1IntakeId}`,
        );
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        // Zip magic number 'PK'
        expect(res.body[0]).toBe(0x50);
        expect(res.body[1]).toBe(0x4b);

        // Layer 3: Direct Database State Persistence Assertion
        const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
          where: { id: BigInt(day1IntakeId) },
        });
        expect(dbIntake).not.toBeNull();
      });
    });
  });

  // ==========================================================================
  // JOURNEY 2: MÔ PHỎNG KHẨU PHẦN 7 NGÀY LIÊN TIẾP (7-DAY CLINICAL TRAJECTORY)
  // ==========================================================================
  describe('User Journey 2: Mô phỏng Khẩu phần 7 Ngày Liên tiếp (7-Day Clinical Intake Trajectory)', () => {
    it('2.1 Ghi nhận liên tiếp các ngày còn lại (từ 2026-06-02 đến 2026-06-07) tạo chuỗi 7 ngày liên tục -> Layer 3 count = 7', async () => {
      const remainingDays = [
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
        '2026-06-07',
      ];

      for (const intakeDate of remainingDays) {
        const payload = {
          patientId: patientId,
          intakeDate: intakeDate,
          inputType: IntakeInputType.BY_MEAL,
          note: `Khẩu phần theo dõi lâm sàng ngày ${intakeDate}`,
          meals: [
            {
              mealOrder: 1,
              mealName: 'Bữa sáng theo dõi',
              mealTime: '07:00',
              ingredients: [{ ingredientId: specialMilkIngId, rawWeight: 180 }],
            },
            {
              mealOrder: 2,
              mealName: 'Bữa trưa theo dõi',
              mealTime: '11:45',
              ingredients: [{ ingredientId: oatIngId, rawWeight: 90 }],
            },
          ],
        };

        // Layer 1: HTTP Status Code 201 Created
        const res = await request(helper.getHttpServer())
          .post('/api/daily-intakes')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        // Layer 2: API Contract Envelope
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.patientId).toBe(patientId);

        trajectoryIntakeIds.push(res.body.data.id);
      }

      // Khẳng định đã ghi nhận đủ 7 ngày liên tiếp
      expect(trajectoryIntakeIds.length).toBe(7);

      // Layer 3: Direct Database State Persistence Assertion
      const totalIntakesInDb = await helper.getPrisma().khau_phan_24h.count({
        where: { benh_nhan_id: BigInt(patientId) },
      });
      expect(totalIntakesInDb).toBe(7);
    });

    it('2.2 Kiểm tra API lọc theo khoảng thời gian (fromDate=2026-06-01, toDate=2026-06-07) và phân trang Page 1 (limit=4) -> Layer 3 verify', async () => {
      // Layer 1: HTTP Status Code 200 OK
      const res = await request(helper.getHttpServer())
        .get(
          `/api/daily-intakes?patientId=${patientId}&fromDate=2026-06-01&toDate=2026-06-07&page=1&limit=4`,
        )
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Layer 2: API Paginated Envelope Validation
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(4); // Page 1 limit 4
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 4,
        totalItems: 7,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });

      // Layer 3: Direct Database State Persistence Assertion
      const dbCountInRange = await helper.getPrisma().khau_phan_24h.count({
        where: {
          benh_nhan_id: BigInt(patientId),
          ngay_an: {
            gte: new Date('2026-06-01'),
            lte: new Date('2026-06-07'),
          },
        },
      });
      expect(dbCountInRange).toBe(7);
    });

    it('2.3 Kiểm tra phân trang Page 2 (limit=4) nhận 3 bản ghi còn lại -> Layer 3 verify', async () => {
      // Layer 1: HTTP Status Code 200 OK
      const res = await request(helper.getHttpServer())
        .get(
          `/api/daily-intakes?patientId=${patientId}&fromDate=2026-06-01&toDate=2026-06-07&page=2&limit=4`,
        )
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Layer 2: API Paginated Envelope Validation
      expect(res.body.data.length).toBe(3); // 7 - 4 = 3 bản ghi còn lại
      expect(res.body.meta).toMatchObject({
        page: 2,
        limit: 4,
        totalItems: 7,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      });

      // Layer 3: DB Assertion
      const dbAllPatientIntakes = await helper.getPrisma().khau_phan_24h.findMany({
        where: { benh_nhan_id: BigInt(patientId) },
        select: { id: true, ngay_an: true },
        orderBy: { ngay_an: 'desc' },
      });
      expect(dbAllPatientIntakes.length).toBe(7);
    });

    it('2.4 Kiểm tra lọc theo ngày cụ thể đơn lẻ (date=2026-06-04) -> Layer 3 verify', async () => {
      // Layer 1: HTTP Status Code 200 OK
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes?patientId=${patientId}&date=2026-06-04`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].intakeDate).toBe('2026-06-04');

      // Layer 3: Direct Database State Persistence Assertion
      const dbSingle = await helper.getPrisma().khau_phan_24h.findFirst({
        where: {
          benh_nhan_id: BigInt(patientId),
          ngay_an: new Date('2026-06-04'),
        },
      });
      expect(dbSingle).not.toBeNull();
      expect(dbSingle?.ghi_chu).toContain('2026-06-04');
    });

    it('2.5 Xuất báo cáo lâm sàng RDA_COMPARISON cho ngày thứ 7 của chuỗi (2026-06-07) -> Layer 3 verify', async () => {
      const day7IntakeId = trajectoryIntakeIds[6];

      // Layer 1: HTTP Status Code 200 OK
      const res = await request(helper.getHttpServer())
        .get(
          `/api/daily-intakes/${day7IntakeId}/export?reportType=${DailyIntakeClinicalReportType.RDA_COMPARISON}`,
        )
        .set('Authorization', `Bearer ${doctorToken}`)
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      // Layer 2: Binary Headers & Buffer Content
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(
        `attachment; filename="bao_cao_lam_sang_24h_${day7IntakeId}`,
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Layer 3: Direct Database State Persistence Assertion
      const dbDay7 = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: BigInt(day7IntakeId) },
      });
      expect(dbDay7).not.toBeNull();
    });

    it('2.6 Xuất báo cáo lâm sàng qua POST /api/daily-intakes/export xác nhận đa định tuyến -> Layer 3 verify', async () => {
      const day7IntakeId = trajectoryIntakeIds[6];

      // Layer 1: HTTP Status Code 200 hoặc 201
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          id: day7IntakeId,
          reportType: DailyIntakeClinicalReportType.ALL_IN_ONE,
        })
        .buffer(true)
        .parse(binaryBufferParser);

      expect([200, 201]).toContain(res.status);

      // Layer 2: Binary Excel
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Layer 3: DB Verification
      const dbConfirm = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: BigInt(day7IntakeId) },
      });
      expect(dbConfirm).not.toBeNull();
    });
  });
});
