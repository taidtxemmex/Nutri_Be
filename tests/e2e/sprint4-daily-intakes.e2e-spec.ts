import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  IntakeInputType,
  DailyIntakeClinicalReportType,
  NutritionLimitWarning,
} from '../../src/config/enums/domain.enum';

// Nâng timeout cho E2E suite để chống flaky timeout khi khởi tạo NestJS + Prisma
jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 4 E2E TEST SUITE: DAILY INTAKES & NUTRITION LIMIT SETS
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Rule 2 & Iron Discipline):
 * - Layer 1: Protocol HTTP Status Codes (200 OK, 201 Created)
 * - Layer 2: Complete Payload Response Schemas & API Envelopes ({ data, meta })
 * - Layer 3: Direct Database State Persistence (Prisma queries: expect(dbRecord).toBe(...))
 * ============================================================================
 */
describe('Sprint 4: Daily Intakes & Nutrition Limit Sets (3-Layer E2E Suite)', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let adminUser: any;
  let regularToken: string;
  let regularUser: any;

  let categoryId: number;
  let beefIngId: number;
  let celeryIngId: number;
  let riceIngId: number;
  let testPatientId: string;

  // Custom parser to handle binary Excel buffers reliably in Supertest
  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    await helper.init();
  }, 60000);

  beforeEach(async () => {
    const prisma = helper.getPrisma();

    // 1. Dọn dẹp CSDL theo thứ tự khóa ngoại từ bảng con đến bảng cha
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `gioi_han_dinh_duong`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    await helper.cleanDatabase();

    // 2. Tạo danh mục chuẩn
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 4 Khẩu phần' },
    });
    categoryId = cat.id;

    // 3. Tạo các nguyên liệu mẫu với thông số vi chất chuẩn xác
    // 3.1 Thịt bò bắp tươi (edible = 100%)
    const beef = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Thịt bò bắp tươi',
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
        vitaminC: 0.0,
        trang_thai: 'DA_DUYET',
      },
    });
    beefIngId = Number(beef.id);

    // 3.2 Cần tây lá xanh (edible = 80%)
    const celery = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Cần tây lá xanh',
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
        vitaminC: 7.0,
        trang_thai: 'DA_DUYET',
      },
    });
    celeryIngId = Number(celery.id);

    // 3.3 Gạo tẻ máy
    const rice = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Gạo tẻ máy',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 13.8,
        protein: 7.9,
        fat: 0.7,
        fiber: 0.4,
        ash: 0.6,
        calci: 30.0,
        iron: 1.2,
        sodium: 3.0,
        potassium: 110.0,
        vitaminC: 0.0,
        trang_thai: 'DA_DUYET',
      },
    });
    riceIngId = Number(rice.id);

    // 4. Khởi tạo tài khoản kiểm thử
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const admin = await helper.createTestUser({
      username: `admin_di4_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Intake Sprint 4',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_di4_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Dinh Dưỡng Intake Sprint 4',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    // 5. Khởi tạo bệnh nhân mẫu với thông tin nhân khẩu học chuẩn phục vụ RDA
    const patient = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: regularUser.id,
        ho_ten: 'Trần Văn Bệnh Nhân RDA',
        so_dien_thoai: '0988776655',
        ngay_sinh: new Date('1986-04-12'), // 40 tuổi
        gioi_tinh: 'NAM',
        can_nang: 68.0,
        chieu_cao: 172.0,
        he_so_hoat_dong: 1.5,
        ma_benh_nhan_bv: `BN-DI-${uniqueSuffix}`,
      },
    });
    testPatientId = patient.id.toString();
  });

  afterAll(async () => {
    if (helper.getPrisma()) {
      await helper.getPrisma().$disconnect();
    }
    await helper.close();
  });

  // ==========================================================================
  // KỊCH BẢN 1: GHI NHẬN KHẨU PHẦN ĂN 24H CHẾ ĐỘ BY_MEAL
  // ==========================================================================
  describe('Kịch bản 1: Ghi nhận khẩu phần 24h chế độ BY_MEAL (Theo từng bữa ăn)', () => {
    it('1.1 Tạo khẩu phần 24h chế độ BY_MEAL -> Layer 3 verify khau_phan_24h, khau_phan_24h_bua_an, khau_phan_24h_nguyen_lieu', async () => {
      const payload = {
        patientId: testPatientId,
        intakeDate: '2026-05-01',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bệnh nhân ăn đầy đủ 2 bữa sáng và trưa',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng',
            mealTime: '07:00',
            ingredients: [
              { ingredientId: beefIngId, rawWeight: 100 },
              { ingredientId: riceIngId, rawWeight: 50 },
            ],
          },
          {
            mealOrder: 2,
            mealName: 'Bữa trưa',
            mealTime: '12:00',
            ingredients: [{ ingredientId: celeryIngId, rawWeight: 80 }],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Response Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patientId).toBe(testPatientId);
      expect(res.body.data.inputType).toBe(IntakeInputType.BY_MEAL);
      expect(res.body.data.note).toBe('Bệnh nhân ăn đầy đủ 2 bữa sáng và trưa');
      expect(Array.isArray(res.body.data.meals)).toBe(true);
      expect(res.body.data.meals.length).toBe(2);
      expect(res.body.data.totalDayNutrients).toBeDefined();
      expect(res.body.data.totalDayNutrients.protein).toBeGreaterThan(0);
      expect(res.body.data.totalDayNutrients.energy).toBeGreaterThan(0);

      const intakeId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const prisma = helper.getPrisma();

      // Bảng cha: khau_phan_24h
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeId) },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.benh_nhan_id).toBe(BigInt(testPatientId));
      expect(dbIntake?.nguoi_dung_id).toBe(regularUser.id);
      expect(dbIntake?.kieu_nhap).toBe(IntakeInputType.BY_MEAL);
      expect(dbIntake?.ghi_chu).toBe('Bệnh nhân ăn đầy đủ 2 bữa sáng và trưa');

      // Bảng con: khau_phan_24h_bua_an
      const dbMeals = await prisma.khau_phan_24h_bua_an.findMany({
        where: { khau_phan_24h_id: BigInt(intakeId) },
        orderBy: { thu_tu_bua: 'asc' },
      });
      expect(dbMeals.length).toBe(2);
      expect(dbMeals[0].ten_bua).toBe('Bữa sáng');
      expect(dbMeals[0].gio_an).toBe('07:00');
      expect(dbMeals[1].ten_bua).toBe('Bữa trưa');
      expect(dbMeals[1].gio_an).toBe('12:00');

      // Bảng cháu: khau_phan_24h_nguyen_lieu
      const dbIngs = await prisma.khau_phan_24h_nguyen_lieu.findMany({
        where: { khau_phan_24h_bua_an_id: { in: dbMeals.map((m) => m.id) } },
      });
      expect(dbIngs.length).toBe(3);

      const beefItem = dbIngs.find((i) => Number(i.nguyen_lieu_id) === beefIngId);
      expect(beefItem).toBeDefined();
      expect(beefItem?.khoi_luong_song_sach).toBe(100);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 2: GHI NHẬN KHẨU PHẦN ĂN 24H CHẾ ĐỘ INGREDIENT_ONLY
  // ==========================================================================
  describe('Kịch bản 2: Ghi nhận khẩu phần 24h chế độ INGREDIENT_ONLY (Gom toàn ngày)', () => {
    it('2.1 Tạo khẩu phần chế độ INGREDIENT_ONLY -> Layer 3 verify kieu_nhap = INGREDIENT_ONLY', async () => {
      const payload = {
        patientId: testPatientId,
        intakeDate: '2026-05-02',
        inputType: IntakeInputType.INGREDIENT_ONLY,
        note: 'Bệnh nhân ghi nhận tổng hợp nguyên liệu cả ngày',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Toàn ngày',
            ingredients: [
              { ingredientId: beefIngId, rawWeight: 150 },
              { ingredientId: celeryIngId, rawWeight: 100 },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data.inputType).toBe(IntakeInputType.INGREDIENT_ONLY);
      expect(res.body.data.meals.length).toBe(1);

      const intakeId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: BigInt(intakeId) },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.kieu_nhap).toBe(IntakeInputType.INGREDIENT_ONLY);
      expect(dbIntake?.benh_nhan_id).toBe(BigInt(testPatientId));
    });
  });

  // ==========================================================================
  // KỊCH BẢN 3: KHẲNG ĐỊNH TÍNH TOÁN DINH DƯỠNG CHÍNH XÁC (NETWEIGHT & VI CHẤT)
  // ==========================================================================
  describe('Kịch bản 3: Khẳng định tính toán dinh dưỡng chính xác', () => {
    it('3.1 Tính toán vi chất dinh dưỡng chính xác từ nguyên liệu đã trừ vỏ -> Layer 3 verify khoi_luong_song_sach', async () => {
      // 100g Thịt bò tươi (edible=100%): 21.5g đạm, 4.5g béo
      // 100g Cần tây lá xanh (edible=80%): 1.2g đạm, 0.2g béo, 1.6g xơ
      const payload = {
        patientId: testPatientId,
        intakeDate: '2026-05-03',
        inputType: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa trưa tính toán',
            ingredients: [
              { ingredientId: beefIngId, rawWeight: 100 },
              { ingredientId: celeryIngId, rawWeight: 100 },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: Kiểm tra tổng đạm và năng lượng được tính toán chính xác
      // Cần tây có edible = 80%: Đạm = 21.5 (bò) + (1.2 * 80% = 0.96 cần tây) = 22.46g
      const nutrients = res.body.data.totalDayNutrients;
      expect(nutrients.protein).toBeCloseTo(22.46, 1);
      expect(nutrients.fat).toBeCloseTo(4.7, 1);
      expect(nutrients.energy).toBeGreaterThan(120);

      // Layer 3: Direct Database State Persistence Assertion
      const dbIngs = await helper.getPrisma().khau_phan_24h_nguyen_lieu.findMany({
        where: {
          khau_phan_24h_bua_an: {
            khau_phan_24h_id: BigInt(res.body.data.id),
          },
        },
      });
      expect(dbIngs.length).toBe(2);
      expect(dbIngs.every((i) => i.khoi_luong_song_sach === 100)).toBe(true);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 4: BÁO CÁO RDA/DRI LÂM SÀNG (GET /api/daily-intakes/:id/rda-report)
  // ==========================================================================
  describe('Kịch bản 4: Báo cáo đối chiếu RDA/DRI lâm sàng', () => {
    it('4.1 Lấy báo cáo RDA/DRI kiểm tra demographic, % RDA và cảnh báo lâm sàng -> Layer 3 verify', async () => {
      // 1. Tạo khẩu phần ăn trước
      const intake = await helper.getPrisma().khau_phan_24h.create({
        data: {
          benh_nhan_id: BigInt(testPatientId),
          nguoi_dung_id: regularUser.id,
          ngay_an: new Date('2026-05-04'),
          kieu_nhap: IntakeInputType.BY_MEAL,
        },
      });

      const meal = await helper.getPrisma().khau_phan_24h_bua_an.create({
        data: {
          khau_phan_24h_id: intake.id,
          thu_tu_bua: 1,
          ten_bua: 'Bữa sáng RDA',
        },
      });

      await helper.getPrisma().khau_phan_24h_nguyen_lieu.create({
        data: {
          khau_phan_24h_bua_an_id: meal.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 200,
        },
      });

      // Layer 1: HTTP Status Code 200
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes/${intake.id}/rda-report`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: API Contract Response Envelope
      expect(res.body).toHaveProperty('data');
      const rdaData = res.body.data;

      // Kiểm tra demographic phản ánh đúng bệnh nhân
      expect(rdaData.demographic.gender).toBe('NAM');
      expect(rdaData.demographic.ageYears).toBeGreaterThanOrEqual(35);

      // Kiểm tra summary và danh sách chỉ tiêu nutrients
      expect(rdaData.summary).toBeDefined();
      expect(Array.isArray(rdaData.summary.criticalWarnings)).toBe(true);
      expect(Array.isArray(rdaData.nutrients)).toBe(true);
      expect(rdaData.nutrients.length).toBeGreaterThan(0);

      // Kiểm tra từng vi chất có các trường lâm sàng: fulfillmentPercent, status, clinicalNote, alertLevel
      const proteinNutrient = rdaData.nutrients.find((n: any) => n.code === 'protein');
      expect(proteinNutrient).toBeDefined();
      expect(proteinNutrient.fulfillmentPercent).toBeDefined();
      expect(proteinNutrient.status).toBeDefined();

      // Layer 3: Direct Database State Persistence Assertion
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(testPatientId) },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.gioi_tinh).toBe('NAM');
    });
  });

  // ==========================================================================
  // KỊCH BẢN 5: TẢI TEMPLATE EXCEL NHẬP LIỆU (GET /api/daily-intakes/template)
  // ==========================================================================
  describe('Kịch bản 5: Tải file Excel mẫu nhập liệu khẩu phần 24h', () => {
    it('5.1 Tải template Excel đầy đủ 3 sheets -> Layer 3 verify', async () => {
      // Layer 1: HTTP Status Code 200
      const res = await request(helper.getHttpServer())
        .get('/api/daily-intakes/template')
        .set('Authorization', `Bearer ${regularToken}`)
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      // Layer 2: Binary Headers & Buffer Content
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(
        'attachment; filename="Template_nhap_lieu_khau_phan_24h.xlsx"',
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Layer 3: Direct Database State Assertion
      const totalIngredients = await helper.getPrisma().nguyen_lieu.count();
      expect(totalIngredients).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 6: XUẤT BÁO CÁO LÂM SÀNG EXCEL (POST /api/daily-intakes/:id/export)
  // ==========================================================================
  describe('Kịch bản 6: Xuất 4 mẫu báo cáo lâm sàng Excel khẩu phần 24h', () => {
    let exportIntakeId: bigint;

    beforeEach(async () => {
      const intake = await helper.getPrisma().khau_phan_24h.create({
        data: {
          benh_nhan_id: BigInt(testPatientId),
          nguoi_dung_id: regularUser.id,
          ngay_an: new Date('2026-05-05'),
          kieu_nhap: IntakeInputType.BY_MEAL,
        },
      });
      exportIntakeId = intake.id;

      const meal = await helper.getPrisma().khau_phan_24h_bua_an.create({
        data: {
          khau_phan_24h_id: intake.id,
          thu_tu_bua: 1,
          ten_bua: 'Bữa sáng lâm sàng',
        },
      });

      await helper.getPrisma().khau_phan_24h_nguyen_lieu.create({
        data: {
          khau_phan_24h_bua_an_id: meal.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 100,
        },
      });
    });

    const reportModes = [
      DailyIntakeClinicalReportType.ALL_IN_ONE,
      DailyIntakeClinicalReportType.RDA_COMPARISON,
      DailyIntakeClinicalReportType.PLC_STRUCTURE,
      DailyIntakeClinicalReportType.MEAL_DISTRIBUTION,
    ];

    for (const mode of reportModes) {
      it(`6.1 Xuất báo cáo lâm sàng mẫu ${mode} (GET /api/daily-intakes/:id/export) -> Layer 3 verify`, async () => {
        // Layer 1: HTTP Status Code 200 (GET /api/daily-intakes/:id/export)
        const res = await request(helper.getHttpServer())
          .get(`/api/daily-intakes/${exportIntakeId}/export?reportType=${mode}`)
          .set('Authorization', `Bearer ${regularToken}`)
          .buffer(true)
          .parse(binaryBufferParser)
          .expect(200);

        // Layer 2: Binary Headers & Buffer Content
        expect(res.headers['content-type']).toContain(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(res.headers['content-disposition']).toContain(
          `attachment; filename="bao_cao_lam_sang_24h_${exportIntakeId}`,
        );
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        // Layer 3: Direct Database State Persistence Assertion
        const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
          where: { id: exportIntakeId },
        });
        expect(dbIntake).not.toBeNull();
      });
    }

    it('6.2 Xuất báo cáo lâm sàng qua POST /api/daily-intakes/export với reportType cụ thể -> Layer 3 verify', async () => {
      // Layer 1: HTTP Status Code 201/200 qua POST /api/daily-intakes/export
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          id: exportIntakeId.toString(),
          reportType: DailyIntakeClinicalReportType.RDA_COMPARISON,
        })
        .buffer(true)
        .parse(binaryBufferParser);

      expect([200, 201]).toContain(res.status);

      // Layer 2: Binary Headers
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(
        `attachment; filename="bao_cao_lam_sang_24h_${exportIntakeId}_rda_comparison.xlsx"`,
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Layer 3: DB Verification
      const dbCheck = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: exportIntakeId },
      });
      expect(dbCheck).not.toBeNull();
    });
  });

  // ==========================================================================
  // KỊCH BẢN 7: CRUD BỘ GIỚI HẠN DINH DƯỠNG (/api/nutrition-limit-sets)
  // ==========================================================================
  describe('Kịch bản 7: CRUD Bộ giới hạn dinh dưỡng (/api/nutrition-limit-sets)', () => {
    it('7.1 Trọn vẹn vòng đời CRUD Bộ giới hạn dinh dưỡng (Create -> List -> GetDetail -> Update -> Delete) với 3-Layer Assertion ở từng bước', async () => {
      // BƯỚC 1: CREATE (POST /api/nutrition-limit-sets)
      const createPayload = {
        name: 'Giới hạn tiểu đường Sprint 4',
        warningRule: NutritionLimitWarning.GTE_5,
        reusable: true,
        limits: {
          energy: 1800,
          carbohydrate: 200,
          protein: 70,
          sodium: 1500,
        },
      };

      const resCreate = await request(helper.getHttpServer())
        .post('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(createPayload)
        .expect(201);

      expect(resCreate.body.data).toHaveProperty('id');
      expect(resCreate.body.data.name).toBe('Giới hạn tiểu đường Sprint 4');
      expect(resCreate.body.data.warningRule).toBe(NutritionLimitWarning.GTE_5);
      expect(resCreate.body.data.reusable).toBe(true);

      const limitId = resCreate.body.data.id;

      // Layer 3 Check Create
      const dbLimit = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitId) },
      });
      expect(dbLimit).not.toBeNull();
      expect(dbLimit?.ten_gioi_han).toBe('Giới hạn tiểu đường Sprint 4');
      expect(dbLimit?.canh_bao).toBe(NutritionLimitWarning.GTE_5);
      expect(dbLimit?.nguoi_dung_id).toBe(regularUser.id);

      // BƯỚC 2: LIST (GET /api/nutrition-limit-sets)
      const resList = await request(helper.getHttpServer())
        .get('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(Array.isArray(resList.body.data)).toBe(true);
      const foundInList = resList.body.data.find((item: any) => item.id === limitId);
      expect(foundInList).toBeDefined();

      const dbCount = await helper.getPrisma().gioi_han_dinh_duong.count({
        where: { nguoi_dung_id: regularUser.id },
      });
      expect(resList.body.data.length).toBeGreaterThanOrEqual(dbCount);

      // BƯỚC 3: GET DETAIL (GET /api/nutrition-limit-sets/:id)
      const resDetail = await request(helper.getHttpServer())
        .get(`/api/nutrition-limit-sets/${limitId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(resDetail.body.data.id).toBe(limitId);
      expect(resDetail.body.data.name).toBe('Giới hạn tiểu đường Sprint 4');
      expect(resDetail.body.data.warningRule).toBe(NutritionLimitWarning.GTE_5);

      // BƯỚC 4: UPDATE (PUT /api/nutrition-limit-sets/:id)
      const updatePayload = {
        name: 'Giới hạn ĐTĐ Type 2 Nâng Cao',
        warningRule: NutritionLimitWarning.GTE_10,
      };

      const resUpdate = await request(helper.getHttpServer())
        .put(`/api/nutrition-limit-sets/${limitId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updatePayload)
        .expect(200);

      expect(resUpdate.body.data.name).toBe('Giới hạn ĐTĐ Type 2 Nâng Cao');
      expect(resUpdate.body.data.warningRule).toBe(NutritionLimitWarning.GTE_10);

      // Layer 3 Check Update
      const dbUpdated = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitId) },
      });
      expect(dbUpdated?.ten_gioi_han).toBe('Giới hạn ĐTĐ Type 2 Nâng Cao');
      expect(dbUpdated?.canh_bao).toBe(NutritionLimitWarning.GTE_10);

      // BƯỚC 5: DELETE (DELETE /api/nutrition-limit-sets/:id)
      const resDelete = await request(helper.getHttpServer())
        .delete(`/api/nutrition-limit-sets/${limitId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(resDelete.body.data.success).toBe(true);

      // Layer 3 Check Delete (Row must be null in DB)
      const dbDeleted = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitId) },
      });
      expect(dbDeleted).toBeNull();
    });
  });
});
