import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { IntakeInputType, NutritionLimitWarning } from '../../src/config/enums/domain.enum';
import { IntakeCalculationEngine } from '../../src/modules/daily-intakes/engines/intake-calculation.engine';
import {
  RdaComparisonEngine,
  RdaComplianceStatus,
} from '../../src/modules/daily-intakes/engines/rda-comparison.engine';
import {
  DemographicProfile,
  RdaTargetMap,
} from '../../src/modules/daily-intakes/engines/rda-reference-data';

// Nâng timeout E2E suite để chống flaky khi khởi tạo NestJS + MariaDB/MySQL
jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 4 E2E CLINICAL SUITE: DEEP CLINICAL PATHOLOGY SCENARIOS & ADVERSARIAL VERIFICATION
 * Module 07: Khẩu phần ăn 24h & Bộ giới hạn dinh dưỡng lâm sàng
 * ============================================================================
 * Mandatory 3-Layer Assertion Law (@Role_Ruthless_QA Iron Discipline):
 * - Layer 1: HTTP Protocol & Status Code Assertions (200, 201, 400, 404, 409)
 * - Layer 2: Complete Payload Schema & Precision Verification (Available Carb < 0.1g error, P:L:C %, RDA %)
 * - Layer 3: Direct Database State Persistence (MySQL `nutri_test` Prisma Ground Truth)
 * ============================================================================
 */
describe('Sprint 4: Deep Clinical Pathology E2E Scenarios (3-Layer Assertion Law)', () => {
  const helper = new TestAppHelper();

  let doctorToken: string;
  let doctorUser: any;
  let categoryId: number;

  // Master ingredients
  let bananaIngId: number;
  let watermelonIngId: number;
  let orangeIngId: number;
  let potatoIngId: number;
  let shrimpIngId: number;
  let tofuIngId: number;
  let fatOilIngId: number;
  let waterIngId: number;

  // Clinical Patients
  let t2dPatientId: string;
  let ckdPatientId: string;
  let pregnantPatientId: string;
  let goutPatientId: string;

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();
    await prisma.$queryRawUnsafe('SELECT 1');
  }, 60000);

  beforeEach(async () => {
    const prisma = helper.getPrisma();

    // 1. Dọn dẹp sạch CSDL cô lập 100%
    await helper.cleanDatabase();

    // 2. Tạo danh mục thực phẩm lâm sàng
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng lâm sàng Sprint 4' },
    });
    categoryId = cat.id;

    // 3. Khởi tạo nguyên liệu lâm sàng chính xác theo Viện Dinh Dưỡng Quốc Gia (NIN)
    // 3.1 Chuối tiêu: edible = 75% (bỏ 25% vỏ)
    const banana = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Chuối tiêu chín (edible 75%)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 75,
        water: 74.91,
        protein: 1.09,
        fat: 0.33,
        fiber: 2.6,
        ash: 0.82,
        potassium: 358.0,
        sodium: 1.0,
        calci: 5.0,
        iron: 0.26,
        trang_thai: 'DA_DUYET',
      },
    });
    bananaIngId = Number(banana.id);

    // 3.2 Dưa hấu: edible = 54% (bỏ 46% vỏ & cùi trắng)
    const watermelon = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Dưa hấu tươi (edible 54%)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 54,
        water: 91.45,
        protein: 0.61,
        fat: 0.15,
        fiber: 0.4,
        ash: 0.26,
        potassium: 112.0,
        sodium: 1.0,
        calci: 7.0,
        iron: 0.24,
        trang_thai: 'DA_DUYET',
      },
    });
    watermelonIngId = Number(watermelon.id);

    // 3.3 Cam tươi: edible = 70% (bỏ 30% vỏ & xơ)
    const orange = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Cam tươi sành (edible 70%)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 70,
        water: 86.75,
        protein: 0.94,
        fat: 0.12,
        fiber: 2.4,
        ash: 0.44,
        potassium: 181.0,
        sodium: 0.0,
        calci: 40.0,
        iron: 0.1,
        vitaminC: 53.2,
        trang_thai: 'DA_DUYET',
      },
    });
    orangeIngId = Number(orange.id);

    // 3.4 Khoai tây luộc (giàu Kali cho ca CKD Stage 4): edible = 100%
    const potato = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Khoai tây luộc chín',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 77.0,
        protein: 2.0,
        fat: 0.1,
        fiber: 2.2,
        ash: 0.9,
        potassium: 420.0,
        sodium: 6.0,
        calci: 12.0,
        iron: 0.8,
        trang_thai: 'DA_DUYET',
      },
    });
    potatoIngId = Number(potato.id);

    // 3.5 Tôm sú biển nguyên con (Đạm động vật purine cao, bỏ vỏ: edible = 60%)
    const shrimp = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Tôm sú biển tươi nguyên con (edible 60%)',
        danh_muc: categoryId,
        loai_protein: 'DONG_VAT',
        edible: 60,
        water: 78.0,
        protein: 19.0,
        fat: 1.5,
        fiber: 0.0,
        ash: 1.5,
        potassium: 220.0,
        sodium: 140.0,
        calci: 29.0,
        iron: 1.8,
        trang_thai: 'DA_DUYET',
      },
    });
    shrimpIngId = Number(shrimp.id);

    // 3.6 Đậu phụ mơ (Đạm thực vật không purine động vật: edible = 100%)
    const tofu = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Đậu phụ mơ tươi (edible 100%)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 82.0,
        protein: 10.9,
        fat: 5.4,
        fiber: 0.5,
        ash: 1.2,
        potassium: 121.0,
        sodium: 7.0,
        calci: 120.0,
        iron: 1.5,
        trang_thai: 'DA_DUYET',
      },
    });
    tofuIngId = Number(tofu.id);

    // 3.7 Mỡ heo / Dầu ô liu (Keto Fat > 99%)
    const fatOil = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Mỡ heo tinh luyện (Keto Fat)',
        danh_muc: categoryId,
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 0.2,
        protein: 0.1,
        fat: 99.5,
        fiber: 0.0,
        ash: 0.2,
        potassium: 0.0,
        sodium: 0.0,
        trang_thai: 'DA_DUYET',
      },
    });
    fatOilIngId = Number(fatOil.id);

    // 3.8 Nước lọc tinh khiết (Fasting 0 kcal)
    const water = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Nước lọc tinh khiết (0 kcal)',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 100.0,
        protein: 0.0,
        fat: 0.0,
        fiber: 0.0,
        ash: 0.0,
        trang_thai: 'DA_DUYET',
      },
    });
    waterIngId = Number(water.id);

    // 4. Tạo Bác sĩ / Chuyên gia dinh dưỡng
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const doctor = await helper.createTestUser({
      username: `bs_lam_sang_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'BS. CKII Nguyễn Văn Lâm Sàng',
    });
    doctorToken = doctor.token;
    doctorUser = doctor.user;

    // 5. Khởi tạo 4 hồ sơ bệnh nhân bệnh học phức tạp
    // 5.1 Bệnh nhân Đái tháo đường Type 2 phụ thuộc Insulin
    const p1 = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorUser.id,
        ho_ten: 'Nguyễn Văn Đái Tháo Đường T2D',
        ngay_sinh: new Date('1974-05-15'), // 52 tuổi
        gioi_tinh: 'NAM',
        can_nang: 65.0,
        chieu_cao: 168.0,
        he_so_hoat_dong: 1.3,
        ma_benh_nhan_bv: `BN-T2D-${uniqueSuffix}`,
      },
    });
    t2dPatientId = p1.id.toString();

    // 5.2 Bệnh nhân Suy thận mạn giai đoạn 4 (CKD Stage 4)
    const p2 = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorUser.id,
        ho_ten: 'Lê Văn Suy Thận CKD4',
        ngay_sinh: new Date('1966-08-20'), // 60 tuổi
        gioi_tinh: 'NAM',
        can_nang: 60.0,
        chieu_cao: 165.0,
        he_so_hoat_dong: 1.2,
        ma_benh_nhan_bv: `BN-CKD4-${uniqueSuffix}`,
      },
    });
    ckdPatientId = p2.id.toString();

    // 5.3 Phụ nữ mang thai 3 tháng cuối (PREGNANT_T3) kèm ĐTĐ thai kỳ
    const p3 = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorUser.id,
        ho_ten: 'Trần Thị Thai Kỳ T3',
        ngay_sinh: new Date('1998-03-10'), // 28 tuổi
        gioi_tinh: 'NU',
        can_nang: 58.0,
        chieu_cao: 160.0,
        he_so_hoat_dong: 1.3,
        ma_benh_nhan_bv: `BN-PREG3-${uniqueSuffix}`,
      },
    });
    pregnantPatientId = p3.id.toString();

    // 5.4 Bệnh nhân Gout & Hội chứng Chuyển hóa
    const p4 = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorUser.id,
        ho_ten: 'Vũ Văn Gout Chuyển Hóa',
        ngay_sinh: new Date('1981-11-25'), // 45 tuổi
        gioi_tinh: 'NAM',
        can_nang: 78.0,
        chieu_cao: 170.0,
        he_so_hoat_dong: 1.4,
        ma_benh_nhan_bv: `BN-GOUT-${uniqueSuffix}`,
      },
    });
    goutPatientId = p4.id.toString();
  });

  afterAll(async () => {
    if (helper.getPrisma()) {
      await helper.getPrisma().$disconnect();
    }
    await helper.close();
  });

  // ==========================================================================
  // CA 1: BỆNH NHÂN ĐÁI THÁO ĐƯỜNG TYPE 2 PHỤ THUỘC INSULIN
  // ==========================================================================
  describe('Ca 1: Bệnh nhân Đái tháo đường Type 2 phụ thuộc Insulin (Intensive Insulin Therapy)', () => {
    it('1.1 Khẩu phần thực phẩm thải bỏ cao (Chuối 75%, Dưa hấu 54%, Cam 70%) -> Tính Available Carb & Calories theo Net Weight, sai lệch < 0.1g, an toàn liều Insulin', async () => {
      // Bệnh nhân ăn tráng miệng: 200g Chuối tiêu, 300g Dưa hấu, 200g Cam tươi (cân cả vỏ)
      // Ground truth calculations:
      // Chuối 200g thô * 75% = 150g sạch -> Carb 100g = 100 - (74.91+1.09+0.33+2.6+0.82) = 20.25g. Net Carb = 20.25 * 1.5 = 30.38g.
      // Dưa hấu 300g thô * 54% = 162g sạch -> Carb 100g = 100 - (91.45+0.61+0.15+0.4+0.26) = 7.13g. Net Carb = 7.13 * 1.62 = 11.55g.
      // Cam 200g thô * 70% = 140g sạch -> Carb 100g = 100 - (86.75+0.94+0.12+2.4+0.44) = 9.35g. Net Carb = 9.35 * 1.40 = 13.09g.
      // Tổng Carb Net thực tế = 30.38 + 11.55 + 13.09 = 55.02g (±0.1g)
      // NẾU TÍNH KHỐNG THEO JAVA CŨ (rawWeight 700g):
      // Carb cũ = (20.25 * 2) + (7.13 * 3) + (9.35 * 2) = 40.50 + 21.39 + 18.70 = 80.59g!
      // Sai lệch Carb nếu dùng Java cũ: 80.59 - 55.02 = 25.57g! (Khiến tiêm quá 2.5 đơn vị Insulin -> Hạ đường huyết cấp gây hôn mê!)
      const payload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-01',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bệnh nhân ĐTĐ Type 2 tiêm Insulin trước bữa tráng miệng trái cây',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa phụ tráng miệng trái cây',
            mealTime: '14:30',
            ingredients: [
              { ingredientId: bananaIngId, rawWeight: 200 },
              { ingredientId: watermelonIngId, rawWeight: 300 },
              { ingredientId: orangeIngId, rawWeight: 200 },
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

      // Layer 2: Schema & Value Precision Assertions
      expect(res.body).toHaveProperty('data');
      const intakeData = res.body.data;
      expect(intakeData.patientId).toBe(t2dPatientId);
      expect(intakeData.meals.length).toBe(1);

      const items = intakeData.meals[0].ingredients;
      expect(items.length).toBe(3);

      const bananaItem = items.find((i: any) => i.ingredientId === String(bananaIngId));
      const watermelonItem = items.find((i: any) => i.ingredientId === String(watermelonIngId));
      const orangeItem = items.find((i: any) => i.ingredientId === String(orangeIngId));

      expect(bananaItem).toBeDefined();
      expect(watermelonItem).toBeDefined();
      expect(orangeItem).toBeDefined();

      // Kiểm tra Available Carbohydrate cho từng loại quả (sai lệch < 0.1g)
      expect(bananaItem.nutrients.carbohydrate).toBeCloseTo(30.38, 1);
      expect(watermelonItem.nutrients.carbohydrate).toBeCloseTo(11.55, 1);
      expect(orangeItem.nutrients.carbohydrate).toBeCloseTo(13.09, 1);

      // Tổng Available Carbohydrate cả ngày
      const totalCarb = intakeData.totalDayNutrients.carbohydrate;
      expect(totalCarb).toBeCloseTo(55.02, 1);

      // KHẲNG ĐỊNH: Tuyệt đối không được tính khống theo Java cũ (80.59g)
      expect(totalCarb).toBeLessThan(60.0);
      expect(Math.abs(totalCarb - 80.59)).toBeGreaterThan(20.0);

      // Layer 3: Direct Database State Persistence
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeData.id) },
        include: {
          khau_phan_24h_bua_an: {
            include: {
              khau_phan_24h_nguyen_lieu: {
                include: { nguyen_lieu: true },
              },
            },
          },
        },
      });

      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.benh_nhan_id.toString()).toBe(t2dPatientId);
      const dbItems = dbIntake?.khau_phan_24h_bua_an[0]?.khau_phan_24h_nguyen_lieu || [];
      expect(dbItems.length).toBe(3);

      const dbBanana = dbItems.find((d) => d.nguyen_lieu_id === BigInt(bananaIngId));
      expect(dbBanana).toBeDefined();
      expect(Number(dbBanana?.khoi_luong_song_sach)).toBe(200);
      expect(Number(dbBanana?.nguyen_lieu?.edible)).toBe(75);
    });
  });

  // ==========================================================================
  // CA 2: BỆNH NHÂN SUY THẬN MẠN GIAI ĐOẠN 4 (CKD STAGE 4 - NON-DIALYSIS)
  // ==========================================================================
  describe('Ca 2: Bệnh nhân Suy thận mạn giai đoạn 4 (CKD Stage 4 - Non-dialysis)', () => {
    let ckdLimitSetId: string;

    it('2.1 Tạo Bộ giới hạn dinh dưỡng cho CKD-4 (Kali < 1500mg, Natri < 2000mg, Đạm < 36g) với cảnh báo GTE_5 và GTE_10 -> Layer 3 verify', async () => {
      const limitPayload = {
        name: 'Giới hạn nghiêm ngặt Suy thận CKD-4 (GTE_5)',
        warningRule: NutritionLimitWarning.GTE_5,
        reusable: true,
        limits: {
          potassium: 1500, // mg (chống tăng kali máu loạn nhịp tim)
          sodium: 2000, // mg (chống ứ trệ dịch, phù phổi)
          protein: 36, // g (0.6g/kg cho bệnh nhân 60kg)
        },
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(limitPayload)
        .expect(201);

      // Layer 2: Payload Schema Assertions
      expect(res.body).toHaveProperty('data');
      ckdLimitSetId = res.body.data.id;
      expect(res.body.data.name).toBe('Giới hạn nghiêm ngặt Suy thận CKD-4 (GTE_5)');
      expect(res.body.data.warningRule).toBe(NutritionLimitWarning.GTE_5);
      expect(res.body.data.limits.potassium).toBe(1500);

      // Layer 3: Direct DB assertion trên gioi_han_dinh_duong
      const prisma = helper.getPrisma();
      const dbLimit = await prisma.gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(ckdLimitSetId) },
      });
      expect(dbLimit).not.toBeNull();
      expect(dbLimit?.canh_bao).toBe('GTE_5');
      expect(dbLimit?.tai_su_dung).toBe(true);

      // Kiểm tra chuyển sang GTE_10
      const updateRes = await request(helper.getHttpServer())
        .put(`/api/nutrition-limit-sets/${ckdLimitSetId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ warningRule: NutritionLimitWarning.GTE_10 })
        .expect(200);

      expect(updateRes.body.data.warningRule).toBe(NutritionLimitWarning.GTE_10);
      const dbUpdated = await prisma.gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(ckdLimitSetId) },
      });
      expect(dbUpdated?.canh_bao).toBe('GTE_10');
    });

    it('2.2 Khẩu phần ăn vi phạm ngưỡng Kali nguy kịch (ăn 400g khoai tây luộc + 300g chuối) -> Cảnh báo WARNING_TOXIC_OR_UL_EXCEEDED nguy cơ loạn nhịp tim', async () => {
      // 400g Khoai tây luộc (420mg/100g) = 1680mg Kali
      // 300g Chuối tiêu (75% edible -> 225g sạch * 358mg/100g) = 805.5mg Kali
      // Tổng Kali nạp = 1680 + 805.5 = 2485.5mg Kali (Vượt xa ngưỡng 1500mg của CKD-4!)
      const intakePayload = {
        patientId: ckdPatientId,
        intakeDate: '2026-07-02',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bệnh nhân CKD4 ăn nhiều khoai tây và chuối gây tăng kali máu cấp',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa trưa thừa kali',
            mealTime: '11:30',
            ingredients: [
              { ingredientId: potatoIngId, rawWeight: 400 },
              { ingredientId: bananaIngId, rawWeight: 300 },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(intakePayload)
        .expect(201);

      // Layer 2: Assert tổng lượng Kali thực nạp
      const intakeData = res.body.data;
      const actualPotassium = intakeData.totalDayNutrients.potassium;
      expect(actualPotassium).toBeGreaterThan(2400); // 2485.5mg

      // Đối chiếu lâm sàng qua RdaComparisonEngine với Custom Targets bệnh lý CKD-4
      const ckdCustomTargets: RdaTargetMap = {
        potassium: {
          rda: 1500, // Mục tiêu tối đa bệnh nhân CKD-4
          ul: 2000, // Ngưỡng trần tối đa gây loạn nhịp tim
          unit: 'mg',
          nameVi: 'Kali',
          nameEn: 'Potassium',
        },
      };

      const ckdDemographic: DemographicProfile = {
        gender: 'NAM',
        ageYears: 60,
        activityLevel: 'SEDENTARY',
      };

      const rdaResult = RdaComparisonEngine.compare(
        intakeData.totalDayNutrients,
        ckdDemographic,
        ckdCustomTargets,
      );

      const potassiumEval = rdaResult.nutrients.find((n) => n.code === 'potassium');
      expect(potassiumEval).toBeDefined();
      expect(potassiumEval?.actualIntake).toBeGreaterThan(2400);
      expect(potassiumEval?.fulfillmentPercent).toBeGreaterThan(150); // > 160%
      expect(potassiumEval?.status).toBe(RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED);
      expect(potassiumEval?.alertLevel).toBe('DANGER');
      expect(potassiumEval?.clinicalNote).toContain(
        'Cần cắt giảm ngay để tránh biến chứng/ngộ độc',
      );

      // Layer 3: Assert DB persistence
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeData.id) },
        include: { khau_phan_24h_bua_an: true },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.benh_nhan_id.toString()).toBe(ckdPatientId);
    });
  });

  // ==========================================================================
  // CA 3: PHỤ NỮ MANG THAI 3 THÁNG CUỐI KÈM ĐÁI THÁO ĐƯỜNG THAI KỲ
  // ==========================================================================
  describe('Ca 3: Phụ nữ Mang thai 3 tháng cuối (PREGNANT_T3) kèm ĐTĐ thai kỳ', () => {
    it('3.1 Đối chiếu RDA chuẩn Bộ Y Tế / NIN cho PREGNANT_T3: Năng lượng (+450 kcal), Sắt (30mg), Axit Folic (600µg), Canxi (1200mg)', () => {
      const pregnantProfile: DemographicProfile = {
        gender: 'NU',
        ageYears: 28,
        physiologicalStatus: 'PREGNANT_T3',
        activityLevel: 'LIGHT',
      };

      // Giả lập khẩu phần nghèo vi chất (chỉ nạp 4.5mg sắt, 90µg folate, 350mg calci)
      const deficientIntake = {
        energy: 1800,
        protein: 50,
        iron: 4.5,
        folicAcid: 90,
        folate: 90,
        calci: 350,
        sodium: 1200,
        potassium: 2000,
      };

      const comparison = RdaComparisonEngine.compare(deficientIntake, pregnantProfile);

      // 1. Kiểm tra chuẩn RDA cho thai phụ tháng cuối
      const ironTarget = comparison.nutrients.find((n) => n.code === 'iron');
      const folateTarget = comparison.nutrients.find((n) => n.code === 'folate');
      const calciumTarget = comparison.nutrients.find((n) => n.code === 'calci');

      expect(ironTarget?.recommendedRda).toBe(30); // 30mg Sắt
      expect(folateTarget?.recommendedRda).toBe(600); // 600µg Folate
      expect(calciumTarget?.recommendedRda).toBe(1200); // 1200mg Canxi

      // 2. Nhu cầu năng lượng tăng thêm +450 kcal (1800 + 450 = 2250 kcal)
      expect(comparison.summary.energyBalance.recommendedKcal).toBe(2250);

      // 3. Khẳng định phát hiện cảnh báo thiếu máu thiếu sắt nghiêm trọng (SEVERE_DEFICIENCY)
      expect(ironTarget?.fulfillmentPercent).toBeCloseTo(15.0, 1); // 4.5 / 30 = 15%
      expect(ironTarget?.status).toBe(RdaComplianceStatus.SEVERE_DEFICIENCY);
      expect(ironTarget?.alertLevel).toBe('DANGER');

      expect(folateTarget?.fulfillmentPercent).toBeCloseTo(15.0, 1); // 90 / 600 = 15%
      expect(folateTarget?.status).toBe(RdaComplianceStatus.SEVERE_DEFICIENCY);
      expect(folateTarget?.alertLevel).toBe('DANGER');

      // Summary critical warnings
      const ironWarn = comparison.summary.criticalWarnings.find((w) => w.code === 'iron');
      expect(ironWarn).toBeDefined();
      expect(ironWarn?.type).toBe('SEVERE_DEFICIENCY');
    });

    it('3.2 Ghi nhận khẩu phần thai phụ qua API -> Layer 3 verify benh_nhan, khau_phan_24h', async () => {
      const payload = {
        patientId: pregnantPatientId,
        intakeDate: '2026-07-03',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Thai phụ 34 tuần khám dinh dưỡng định kỳ',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa chính',
            ingredients: [
              { ingredientId: orangeIngId, rawWeight: 150 },
              { ingredientId: tofuIngId, rawWeight: 200 },
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

      // Layer 2: API Contract response
      expect(res.body.data.patientId).toBe(pregnantPatientId);
      expect(res.body.data.totalDayNutrients.calci).toBeGreaterThan(0);

      // Layer 3: Direct Database State Persistence
      const prisma = helper.getPrisma();
      const patient = await prisma.benh_nhan.findUnique({
        where: { id: BigInt(pregnantPatientId) },
      });
      expect(patient?.gioi_tinh).toBe('NU');

      const intake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(res.body.data.id) },
      });
      expect(intake).not.toBeNull();
      expect(intake?.benh_nhan_id.toString()).toBe(pregnantPatientId);
    });
  });

  // ==========================================================================
  // CA 4: BỆNH NHÂN GOUT & HỘI CHỨNG CHUYỂN HÓA (METABOLIC SYNDROME)
  // ==========================================================================
  describe('Ca 4: Bệnh nhân Gout & Hội chứng Chuyển hóa (Metabolic Syndrome)', () => {
    it('4.1 Tách biệt hoàn toàn Đạm Động vật & Đạm Thực vật; Tôm sú (edible 60%) tính đúng trên 60% thịt ăn được -> Layer 3 verify', async () => {
      // Bệnh nhân ăn 200g Tôm sú nguyên con (edible = 60% -> 120g thịt ăn được)
      // Tôm sú: 19.0g đạm/100g thịt.
      // Net Protein Animal = (19.0 * 120) / 100 = 22.80g đạm động vật.
      // NẾU TÍNH JAVA CŨ (bỏ qua edible, tính trên 200g): Đạm = 38.00g! Sai lệch 15.2g đạm purine!
      // Bệnh nhân ăn kèm 150g Đậu phụ mơ (edible = 100%, loai_protein: 'THUC_VAT'):
      // Net Protein Plant = (10.9 * 150) / 100 = 16.35g đạm thực vật.
      // Tổng đạm = 22.80 + 16.35 = 39.15g.
      const payload = {
        patientId: goutPatientId,
        intakeDate: '2026-07-04',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Kiểm soát nghiêm ngặt purine đạm động vật cho bệnh nhân Gout mạn tính',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa trưa tôm hấp và đậu phụ',
            mealTime: '12:00',
            ingredients: [
              { ingredientId: shrimpIngId, rawWeight: 200 },
              { ingredientId: tofuIngId, rawWeight: 150 },
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

      // Layer 2: Assert tách biệt đạm động vật và đạm thực vật
      const intakeData = res.body.data;
      const totalNutrients = intakeData.totalDayNutrients;

      expect(totalNutrients.protein).toBeCloseTo(39.15, 1);
      expect(totalNutrients.proteinAnimal).toBeCloseTo(22.8, 1);
      expect(totalNutrients.proteinPlant).toBeCloseTo(16.35, 1);

      // Khẳng định đạm động vật KHÔNG bị tính khống theo 200g nguyên con (38g)
      expect(totalNutrients.proteinAnimal).toBeLessThan(25.0);
      expect(Math.abs(totalNutrients.proteinAnimal - 38.0)).toBeGreaterThan(14.0);

      // Layer 3: Direct DB assertion trên khau_phan_24h_nguyen_lieu và nguyen_lieu
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeData.id) },
        include: {
          khau_phan_24h_bua_an: {
            include: {
              khau_phan_24h_nguyen_lieu: {
                include: { nguyen_lieu: true },
              },
            },
          },
        },
      });

      const dbIngredients = dbIntake?.khau_phan_24h_bua_an[0]?.khau_phan_24h_nguyen_lieu || [];
      expect(dbIngredients.length).toBe(2);

      const dbShrimp = dbIngredients.find((i) => i.nguyen_lieu_id === BigInt(shrimpIngId));
      expect(dbShrimp).toBeDefined();
      expect(Number(dbShrimp?.khoi_luong_song_sach)).toBe(200);
      expect(dbShrimp?.nguyen_lieu?.loai_protein).toBe('DONG_VAT');
      expect(Number(dbShrimp?.nguyen_lieu?.edible)).toBe(60);

      const dbTofu = dbIngredients.find((i) => i.nguyen_lieu_id === BigInt(tofuIngId));
      expect(dbTofu).toBeDefined();
      expect(dbTofu?.nguyen_lieu?.loai_protein).toBe('THUC_VAT');
      expect(Number(dbTofu?.nguyen_lieu?.edible)).toBe(100);
    });
  });

  // ==========================================================================
  // CA 5: CƠ CẤU NĂNG LƯỢNG P:L:C BẤT THƯỜNG (KETO CỰC ĐOAN & FASTING)
  // ==========================================================================
  describe('Ca 5: Cơ cấu Năng lượng P:L:C Bất Thường', () => {
    it('5.1 Khẩu phần Keto cực đoan (Chất béo > 70%, Carb < 5%) -> Hệ thống không lỗi, tính đúng tỷ lệ Lipid & Carb', async () => {
      // 100g Mỡ heo (99.5g fat -> 895.5 kcal) + 20g Chuối tiêu (0.07g fat, 0.22g protein, 3.04g carb -> 13.7 kcal)
      // Tổng năng lượng ~ 910 kcal
      // Tỷ lệ Fat > 90% (vượt xa ngưỡng 70% Keto)
      // Tỷ lệ Carb < 3% (dưới ngưỡng 5% Keto)
      const ketoPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-05',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Khẩu phần Keto cực đoan nhằm khảo sát nguy cơ nhiễm toan ceton',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa Keto dầu mỡ cao',
            mealTime: '08:00',
            ingredients: [
              { ingredientId: fatOilIngId, rawWeight: 100 },
              { ingredientId: bananaIngId, rawWeight: 20 },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(ketoPayload)
        .expect(201);

      // Layer 2: Assert P:L:C Distribution
      const intakeData = res.body.data;
      const nutrients = intakeData.totalDayNutrients;

      expect(nutrients.energy).toBeGreaterThan(800);
      expect(nutrients.fat).toBeGreaterThan(95);

      // Tính toán chi tiết qua IntakeCalculationEngine để khẳng định Macro Ratios
      const pureCalc = IntakeCalculationEngine.calculateDailyIntake({
        mode: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa Keto',
            items: [
              {
                type: 'INGREDIENT',
                ingredient: {
                  rawWeight: 100,
                  fat: 99.5,
                  water: 0.2,
                  protein: 0.1,
                  edible: 100,
                },
              },
              {
                type: 'INGREDIENT',
                ingredient: {
                  rawWeight: 20,
                  edible: 75,
                  water: 74.91,
                  protein: 1.09,
                  fat: 0.33,
                  fiber: 2.6,
                  ash: 0.82,
                },
              },
            ],
          },
        ],
      });

      expect(pureCalc.macroRatios.lipidPercent).toBeGreaterThan(70.0);
      expect(pureCalc.macroRatios.carbohydratePercent).toBeLessThan(5.0);
      expect(Number.isNaN(pureCalc.macroRatios.lipidPercent)).toBe(false);
      expect(Number.isNaN(pureCalc.macroRatios.carbohydratePercent)).toBe(false);

      // Layer 3: DB assertion
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeData.id) },
      });
      expect(dbIntake).not.toBeNull();
    });

    it('5.2 Khẩu phần nhịn đói hoàn toàn (Fasting: 0 kcal, 0g Protein, 0g Lipid, 0g Carb) -> Không crash chia cho 0 (Zero Division Protection), tỷ lệ P:L:C = 0%', async () => {
      // Bệnh nhân chỉ uống 500g nước lọc tinh khiết (0 kcal, 0 protein, 0 lipid, 0 carb)
      const fastingPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-06',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bệnh nhân nhịn ăn xét nghiệm đường huyết lúc đói',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Nhịn đói chỉ uống nước lọc',
            mealTime: '07:00',
            ingredients: [{ ingredientId: waterIngId, rawWeight: 500 }],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(fastingPayload)
        .expect(201);

      // Layer 2: API Contract Assertions
      const intakeData = res.body.data;
      const nutrients = intakeData.totalDayNutrients;

      expect(nutrients.energy).toBe(0);
      expect(nutrients.protein).toBe(0);
      expect(nutrients.fat).toBe(0);
      expect(nutrients.carbohydrate).toBe(0);

      // Chống crash chia cho 0: Kiểm tra tỷ lệ P:L:C trong Pure Engine
      const pureCalc = IntakeCalculationEngine.calculateDailyIntake({
        mode: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            mealName: 'Nhịn đói',
            items: [
              {
                type: 'INGREDIENT',
                ingredient: {
                  rawWeight: 500,
                  water: 100,
                  protein: 0,
                  fat: 0,
                  fiber: 0,
                  ash: 0,
                  edible: 100,
                },
              },
            ],
          },
        ],
      });

      expect(pureCalc.totalEnergyKcal).toBe(0);
      expect(pureCalc.macroRatios.proteinPercent).toBe(0);
      expect(pureCalc.macroRatios.lipidPercent).toBe(0);
      expect(pureCalc.macroRatios.carbohydratePercent).toBe(0);
      expect(Number.isNaN(pureCalc.macroRatios.proteinPercent)).toBe(false);
      expect(Number.isNaN(pureCalc.macroRatios.lipidPercent)).toBe(false);
      expect(Number.isNaN(pureCalc.macroRatios.carbohydratePercent)).toBe(false);

      // Layer 3: Direct DB assertion
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(intakeData.id) },
        include: {
          khau_phan_24h_bua_an: {
            include: { khau_phan_24h_nguyen_lieu: true },
          },
        },
      });
      expect(dbIntake).not.toBeNull();
      expect(
        dbIntake?.khau_phan_24h_bua_an[0]?.khau_phan_24h_nguyen_lieu[0]?.khoi_luong_song_sach,
      ).toBe(500);
    });
  });

  // ==========================================================================
  // ADVERSARIAL PERSONA ATTACKS (@Role_Ruthless_QA Mandate)
  // ==========================================================================
  describe('Hostile Adversarial Persona Simulations', () => {
    it('Persona 1: The Stupid Bot — Bắn 15 request đồng thời tạo khẩu phần 24h cùng 1 ngày -> Đúng 1 request thành công 201, các request khác bị chặn 409 CONFLICT, DB chỉ có đúng 1 record', async () => {
      const targetDate = '2026-07-20';
      const botPayload = {
        patientId: t2dPatientId,
        intakeDate: targetDate,
        inputType: IntakeInputType.BY_MEAL,
        note: 'Stupid Bot hyperactive burst traffic simulation',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng bot',
            ingredients: [{ ingredientId: bananaIngId, rawWeight: 100 }],
          },
        ],
      };

      // Bắn 15 requests đồng thời không chờ đợi
      const burstRequests = Array.from({ length: 15 }, () =>
        request(helper.getHttpServer())
          .post('/api/daily-intakes')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(botPayload),
      );

      const responses = await Promise.all(burstRequests);

      const successResponses = responses.filter((r) => r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      // Layer 1: Đúng 1 request thành công, còn lại 14 request bị xung đột 409
      expect(successResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(14);

      // Layer 3: Direct DB assertion xác nhận chỉ có DUY NHẤT 1 bản ghi được tạo
      const prisma = helper.getPrisma();
      const records = await prisma.khau_phan_24h.findMany({
        where: {
          benh_nhan_id: BigInt(t2dPatientId),
          ngay_an: new Date(targetDate),
        },
      });
      expect(records.length).toBe(1);
    });

    it('Persona 2: The Amateur Hacker — SQLi / XSS injection tags & Type smashing -> Parameterized query bảo vệ an toàn CSDL, type smashing trả về 400', async () => {
      // 1. SQL Injection trong chuỗi ghi chú và tên bữa
      const sqliPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-21',
        inputType: IntakeInputType.BY_MEAL,
        note: "Bệnh nhân '; DROP TABLE khau_phan_24h; --",
        meals: [
          {
            mealOrder: 1,
            mealName: "' OR '1'='1",
            ingredients: [{ ingredientId: bananaIngId, rawWeight: 100 }],
          },
        ],
      };

      const sqliRes = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(sqliPayload)
        .expect(201);

      expect(sqliRes.body.data.note).toBe("Bệnh nhân '; DROP TABLE khau_phan_24h; --");

      // Layer 3: Khẳng định bảng khau_phan_24h KHÔNG bị DROP, dữ liệu toàn vẹn
      const prisma = helper.getPrisma();
      const count = await prisma.khau_phan_24h.count();
      expect(count).toBeGreaterThan(0);

      // 2. XSS Script Injection
      const xssPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-22',
        inputType: IntakeInputType.BY_MEAL,
        note: '<script>alert("pwned")</script><img src=x onerror=alert(1)>',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa XSS',
            ingredients: [{ ingredientId: bananaIngId, rawWeight: 100 }],
          },
        ],
      };

      const xssRes = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(xssPayload)
        .expect(201);

      expect(xssRes.body.data.note).toContain('<script>alert("pwned")</script>');

      // 3. Type Smashing: Truyền string vào numeric rawWeight
      const typeSmashPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-23',
        inputType: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            ingredients: [{ ingredientId: bananaIngId, rawWeight: 'invalid-string-weight' }],
          },
        ],
      };

      await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(typeSmashPayload)
        .expect(400);
    });

    it('Persona 3: The Broken Cable Network — Ghost IDs & Negative Boundary Values -> Phản hồi 400/404, không crash 500, không sinh orphan DB records', async () => {
      // 1. Ghost patient ID không tồn tại
      const ghostPatientPayload = {
        patientId: '9999999999',
        intakeDate: '2026-07-24',
        inputType: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            ingredients: [{ ingredientId: bananaIngId, rawWeight: 100 }],
          },
        ],
      };

      await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(ghostPatientPayload)
        .expect(404);

      // 2. Negative raw weight (rawWeight: -100)
      const negativeWeightPayload = {
        patientId: t2dPatientId,
        intakeDate: '2026-07-25',
        inputType: IntakeInputType.BY_MEAL,
        meals: [
          {
            mealOrder: 1,
            ingredients: [{ ingredientId: bananaIngId, rawWeight: -100 }],
          },
        ],
      };

      await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(negativeWeightPayload)
        .expect(400);

      // Layer 3: Assert không có bản ghi mồ côi nào cho ngày 2026-07-24 và 2026-07-25
      const prisma = helper.getPrisma();
      const ghostRecords = await prisma.khau_phan_24h.findMany({
        where: {
          ngay_an: {
            in: [new Date('2026-07-24'), new Date('2026-07-25')],
          },
        },
      });
      expect(ghostRecords.length).toBe(0);
    });
  });
});
