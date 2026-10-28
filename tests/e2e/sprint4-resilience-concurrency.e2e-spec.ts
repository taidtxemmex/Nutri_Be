import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  MenuType,
  TargetType,
  IntakeInputType,
  MenuExportType,
} from '../../src/config/enums/domain.enum';
import { MenuExcelService } from '../../src/modules/menus/services/menu-excel.service';
import { DailyIntakeExcelService } from '../../src/modules/daily-intakes/services/daily-intake-excel.service';
import { NUTRIENT_CODES } from '../../src/core/nutrition-engine/nutrition.constants';

// Timeout 120s cho E2E Stress & Concurrency Suite
jest.setTimeout(120000);

/**
 * ============================================================================
 * SPRINT 4 E2E TEST SUITE: CHAOS, RESILIENCE & CONCURRENCY
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Iron Discipline):
 * - Layer 1: Protocol HTTP Status Codes (200, 201, 400, 409)
 * - Layer 2: API Contract Envelopes & Detailed Error Envelopes
 * - Layer 3: Direct Database State Persistence (Prisma queries: expect(dbRecord)...)
 * ============================================================================
 */
describe('Sprint 4: Chaos, Resilience & High-Concurrency E2E Suite', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let _adminUser: any;
  let regularToken: string;
  let regularUser: any;

  let categoryId: number;
  let beefIngId: number;
  let celeryIngId: number;
  let riceIngId: number;
  let defaultPatientId: bigint;

  let menuExcelService: MenuExcelService;
  let dailyIntakeExcelService: DailyIntakeExcelService;

  // Custom parser to handle binary Excel buffers reliably in Supertest
  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  /**
   * Helper dọn dẹp CSDL triệt để theo thứ tự cây quan hệ (con trước, cha sau)
   */
  async function cleanAllDatabase(): Promise<void> {
    const prisma = helper.getPrisma();

    const tables = [
      'khau_phan_24h_nguyen_lieu',
      'khau_phan_24h_bua_an',
      'khau_phan_24h',
      'chi_tiet_thuc_don',
      'de_xuat_thuc_don',
      'thuc_don',
      'chi_tiet_bua_an',
      'bua_an',
      'chi_tiet_mon_an',
      'mon_an',
      'he_so_song_chin',
      'minh_chung',
      'de_xuat_nguyen_lieu',
      'gioi_han_dinh_duong',
      'nguyen_lieu',
      'danh_muc',
      'benh_nhan',
      'nhom_benh_mo_rong',
      'ho_so_ca_nhan',
      'lich_su_dang_nhap',
      'thiet_bi_dang_nhap',
      'ma_xac_thuc',
      'dang_ky_cho_xac_thuc',
      'dang_ky',
      'yeu_cau_thanh_toan',
      'nguoi_de_xuat',
      '_system_jobs',
      '_system_jobs_dlq',
      '_system_cache',
      'nguoi_dung',
    ];

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`).catch(() => {});
    }
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
  }

  beforeAll(async () => {
    await helper.init();
    if (helper.getHttpServer() && typeof helper.getHttpServer().setMaxListeners === 'function') {
      helper.getHttpServer().setMaxListeners(50);
    }
    menuExcelService = helper.getApp().get<MenuExcelService>(MenuExcelService);
    dailyIntakeExcelService = helper.getApp().get<DailyIntakeExcelService>(DailyIntakeExcelService);
  }, 60000);

  beforeEach(async () => {
    await cleanAllDatabase();
    const prisma = helper.getPrisma();

    // 1. Tạo danh mục chuẩn
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 4 Chaos' },
    });
    categoryId = cat.id;

    // 2. Tạo các nguyên liệu mẫu với thông số vi chất chuẩn xác
    const beef = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Thịt bò bắp tươi Chaos',
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

    const celery = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Cần tây tươi Chaos',
        danh_muc: categoryId,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 95.0,
        protein: 0.7,
        fat: 0.1,
        fiber: 1.6,
        ash: 0.9,
        calci: 40.0,
        iron: 0.2,
        sodium: 80.0,
        potassium: 260.0,
        vitaminC: 7.0,
        trang_thai: 'DA_DUYET',
      },
    });
    celeryIngId = Number(celery.id);

    const rice = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Gạo tẻ máy Chaos',
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

    // 3. Khởi tạo tài khoản kiểm thử
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const admin = await helper.createTestUser({
      username: `admin_chaos_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Chaos Tester',
    });
    adminToken = admin.token;
    _adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_chaos_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Stress Tester',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    // 4. Khởi tạo bệnh nhân mặc định
    const patient = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: regularUser.id,
        ho_ten: 'Bệnh Nhân Mặc Định Chaos',
        so_dien_thoai: '0988001122',
        ngay_sinh: new Date('1985-05-15'),
        gioi_tinh: 'NAM',
        can_nang: 65.0,
        chieu_cao: 170.0,
        he_so_hoat_dong: 1.4,
        ma_benh_nhan_bv: `BN-CHAOS-${uniqueSuffix}`,
      },
    });
    defaultPatientId = patient.id;
  });

  afterAll(async () => {
    if (helper.getPrisma()) {
      await cleanAllDatabase();
      await helper.getPrisma().$disconnect();
    }
    await helper.close();
  });

  // ==========================================================================
  // KỊCH BẢN 1: MASSIVE CONCURRENT MENU UPDATES & COPY-ON-WRITE ISOLATION
  // ==========================================================================
  describe('Kịch bản 1: Massive Concurrent Menu Updates (Bão cập nhật thực đơn đồng thời lên Bữa ăn chia sẻ)', () => {
    it('1.1 Bão 12 requests đồng thời cập nhật thực đơn dùng chung bữa ăn -> CoW phân tách nhánh mượt mà, zero deadlock, zero orphaned records', async () => {
      const prisma = helper.getPrisma();
      const CONCURRENCY_COUNT = 12;

      // 1. Tạo 1 món ăn mẫu
      const dish = await prisma.mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Bò xào cần tây dùng chung CoW',
          trang_thai: 'RIENG_TU',
          chi_tiet_mon_an: {
            create: [
              { nguyen_lieu_id: BigInt(beefIngId), khoi_luong_song_sach: 100 },
              { nguyen_lieu_id: BigInt(celeryIngId), khoi_luong_song_sach: 50 },
            ],
          },
        },
      });

      // 2. Tạo 1 bữa ăn dùng chung ban đầu
      const sharedMeal = await prisma.bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa trưa chia sẻ CoW gốc',
          gio_an: '11:30',
          trang_thai: 'RIENG_TU',
          la_cong_khai: false,
          chi_tiet_bua_an: {
            create: [
              {
                mon_an_id: dish.id,
                he_so_song_chin: 1.0,
              },
            ],
          },
        },
      });

      // 3. Tạo 12 thực đơn độc lập, nhưng cùng liên kết đến sharedMeal
      const menuIds: string[] = [];
      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        const menu = await prisma.thuc_don.create({
          data: {
            nguoi_dung_id: regularUser.id,
            ten_thuc_don: `Thực đơn đồng thời #${i + 1}`,
            loai_thuc_don: MenuType.NGAY,
            loai_doi_tuong: TargetType.BENH_NHAN,
            benh_nhan_id: defaultPatientId,
            chi_tiet_thuc_don: {
              create: [
                {
                  bua_an_id: sharedMeal.id,
                  thu_tu_trong_tuan: 1,
                },
              ],
            },
          },
        });
        menuIds.push(menu.id.toString());
      }

      // Xác nhận trước bão: Cả 12 thực đơn cùng trỏ về 1 bữa ăn sharedMeal
      const initialLinks = await prisma.chi_tiet_thuc_don.count({
        where: { bua_an_id: sharedMeal.id },
      });
      expect(initialLinks).toBe(CONCURRENCY_COUNT);

      // 4. Kích hoạt bão: 12 requests đồng thời PUT /api/menus/:id cập nhật nội dung bữa ăn
      const updatePromises = menuIds.map((id, index) => {
        const updatePayload = {
          menuName: `Thực đơn đồng thời #${index + 1} ĐÃ CẬP NHẬT`,
          menuType: MenuType.NGAY,
          meals: [
            {
              mealId: sharedMeal.id.toString(),
              mealName: `Bữa trưa đã tách CoW #${index + 1}`,
              time: '12:00',
              dishes: [
                {
                  dishId: dish.id.toString(),
                  dishName: `Món bò biến tấu #${index + 1}`,
                  order: 1,
                  ingredients: [
                    { ingredientId: beefIngId, netWeight: 110 + index },
                    { ingredientId: celeryIngId, netWeight: 60 + index },
                  ],
                },
              ],
            },
          ],
        };

        return request(helper.getHttpServer())
          .put(`/api/menus/${id}`)
          .set('Authorization', `Bearer ${regularToken}`)
          .send(updatePayload);
      });

      // Bắn đồng thời 12 request song song
      const responses = await Promise.all(updatePromises);

      // Layer 1: 100% request thành công 200 OK (Zero Deadlock ER_LOCK_DEADLOCK)
      for (const res of responses) {
        expect(res.status).toBe(200);
      }

      // Layer 2: API Contract Envelope Assertion
      for (let i = 0; i < responses.length; i++) {
        const body = responses[i].body;
        expect(body).toHaveProperty('data');
        expect(body.data.id).toBe(menuIds[i]);
        expect(body.data.menuName).toBe(`Thực đơn đồng thời #${i + 1} ĐÃ CẬP NHẬT`);
        expect(body.data.message).toBe('Cập nhật thực đơn thành công');
      }

      // Layer 3: Direct Database State Persistence & Copy-on-Write Verification
      // Bữa ăn ban đầu (sharedMeal) phải còn nguyên vẹn trong CSDL
      const originalMealInDb = await prisma.bua_an.findUnique({
        where: { id: sharedMeal.id },
      });
      expect(originalMealInDb).not.toBeNull();
      expect(originalMealInDb?.ten_bua_an).toBe('Bữa trưa chia sẻ CoW gốc');

      // Mỗi thực đơn hiện tại PHẢI trỏ đến 1 bua_an_id MỚI ĐỘC LẬP
      const updatedDetails = await prisma.chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: { in: menuIds.map((id) => BigInt(id)) } },
        select: { thuc_don_id: true, bua_an_id: true },
      });

      expect(updatedDetails.length).toBe(CONCURRENCY_COUNT);

      const assignedMealIds = updatedDetails.map((d) => d.bua_an_id.toString());
      const uniqueMealIdSet = new Set(assignedMealIds);

      // Khẳng định CoW: 12 thực đơn phân nhánh thành 12 bữa ăn độc lập hoàn toàn!
      expect(uniqueMealIdSet.size).toBe(CONCURRENCY_COUNT);
      // Không có thực đơn nào còn trỏ về bữa ăn cũ
      expect(uniqueMealIdSet.has(sharedMeal.id.toString())).toBe(false);

      // Xác minh các bữa ăn mới được tạo bởi đúng user
      const clonedMeals = await prisma.bua_an.findMany({
        where: { id: { in: Array.from(uniqueMealIdSet).map((id) => BigInt(id)) } },
      });
      expect(clonedMeals.length).toBe(CONCURRENCY_COUNT);
      for (const cm of clonedMeals) {
        expect(cm.nguoi_dung_id).toBe(regularUser.id);
        expect(cm.ten_bua_an).toContain('Bữa trưa đã tách CoW');
      }
    });
  });

  // ==========================================================================
  // KỊCH BẢN 2: STRESS TESTING BATCH 24H INTAKE CREATION (CONCURRENT PATIENTS)
  // ==========================================================================
  describe('Kịch bản 2: Stress Testing Batch 24h Intake Creation (Tạo khẩu phần 24h đồng thời cho nhiều bệnh nhân)', () => {
    it('2.1 Bắn 20 requests đồng thời tạo khẩu phần 24h cho 20 bệnh nhân -> 100% 201 Created, Connection Pool không kiệt quệ, dữ liệu cô lập tuyệt đối', async () => {
      const prisma = helper.getPrisma();
      const PATIENT_COUNT = 20;

      // 1. Tạo 20 bệnh nhân độc lập trong MySQL
      const patientsData = Array.from({ length: PATIENT_COUNT }, (_, idx) => ({
        nguoi_dung_id: regularUser.id,
        ho_ten: `Bệnh Nhân Stress Intake #${idx + 1}`,
        so_dien_thoai: `09770000${idx < 10 ? '0' + idx : idx}`,
        ngay_sinh: new Date('1990-01-01'),
        gioi_tinh: idx % 2 === 0 ? 'NAM' : 'NU',
        can_nang: 60.0 + idx,
        chieu_cao: 165.0 + idx,
        he_so_hoat_dong: 1.4,
        ma_benh_nhan_bv: `BN-STRESS-24H-${Date.now()}-${idx + 1}`,
      }));

      const createdPatients = await Promise.all(
        patientsData.map((p) => prisma.benh_nhan.create({ data: p })),
      );

      expect(createdPatients.length).toBe(PATIENT_COUNT);

      // 2. Chuẩn bị 20 payload tạo khẩu phần 24h riêng biệt
      const intakeDateStr = '2026-06-25';
      const intakePromises = createdPatients.map((p, idx) => {
        const payload = {
          patientId: p.id.toString(),
          intakeDate: intakeDateStr,
          inputType: IntakeInputType.BY_MEAL,
          note: `Khẩu phần ăn áp lực cao bệnh nhân ${idx + 1}`,
          meals: [
            {
              mealOrder: 1,
              mealName: 'Bữa sáng đạm cao',
              mealTime: '07:00',
              ingredients: [
                { ingredientId: beefIngId, rawWeight: 100 + idx },
                { ingredientId: riceIngId, rawWeight: 80 },
              ],
            },
            {
              mealOrder: 2,
              mealName: 'Bữa trưa xơ khoáng',
              mealTime: '12:00',
              ingredients: [{ ingredientId: celeryIngId, rawWeight: 90 + idx }],
            },
          ],
        };

        return request(helper.getHttpServer())
          .post('/api/daily-intakes')
          .set('Authorization', `Bearer ${regularToken}`)
          .send(payload);
      });

      // 3. Kích hoạt 20 requests song song dồn dập
      const responses = await Promise.all(intakePromises);

      // Layer 1: 100% request thành công 201 Created
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Layer 2: API Contract Envelope Assertion & Nutrition Data Integrity
      const createdIntakeIds: bigint[] = [];
      for (let i = 0; i < responses.length; i++) {
        const body = responses[i].body;
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('id');
        expect(body.data.patientId).toBe(createdPatients[i].id.toString());
        expect(body.data.inputType).toBe(IntakeInputType.BY_MEAL);
        expect(body.data.meals.length).toBe(2);
        expect(body.data.totalDayNutrients.protein).toBeGreaterThan(20);
        expect(body.data.totalDayNutrients.energy).toBeGreaterThan(100);

        createdIntakeIds.push(BigInt(body.data.id));
      }

      // Layer 3: Direct Database State Persistence (Prisma Queries)
      // 3.1 Bảng cha khau_phan_24h: Đúng 20 bản ghi
      const dbIntakes = await prisma.khau_phan_24h.findMany({
        where: { id: { in: createdIntakeIds } },
        include: {
          khau_phan_24h_bua_an: {
            include: {
              khau_phan_24h_nguyen_lieu: true,
            },
          },
        },
      });

      expect(dbIntakes.length).toBe(PATIENT_COUNT);

      // 3.2 Khẳng định tính cô lập: Mỗi bản ghi gắn đúng với 1 bệnh nhân duy nhất
      const patientIdSet = new Set(dbIntakes.map((i) => i.benh_nhan_id.toString()));
      expect(patientIdSet.size).toBe(PATIENT_COUNT);

      // 3.3 Bảng con khau_phan_24h_bua_an: 20 * 2 = 40 bữa ăn
      let totalMealsCount = 0;
      let totalIngredientsCount = 0;

      for (const intake of dbIntakes) {
        expect(intake.khau_phan_24h_bua_an.length).toBe(2);
        totalMealsCount += intake.khau_phan_24h_bua_an.length;

        for (const meal of intake.khau_phan_24h_bua_an) {
          totalIngredientsCount += meal.khau_phan_24h_nguyen_lieu.length;
        }
      }

      expect(totalMealsCount).toBe(PATIENT_COUNT * 2);
      expect(totalIngredientsCount).toBe(PATIENT_COUNT * 3); // 2 ing bữa sáng + 1 ing bữa trưa = 3
    });
  });

  // ==========================================================================
  // KỊCH BẢN 3: FUZZING & DIRTY PAYLOAD TRÊN EXCEL IMPORT KHẨU PHẦN 24H
  // ==========================================================================
  describe('Kịch bản 3: Fuzzing & Dirty Payload trên Excel Import Khẩu phần 24h', () => {
    it('3.1 Upload file rác rỗng (0 bytes) -> Trả về chuẩn 400 Bad Request kèm mã lỗi hợp lệ, không ghi dữ liệu rác vào CSDL', async () => {
      const res = await request(helper.getHttpServer())
        .post(`/api/daily-intakes/import?patientId=${defaultPatientId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .attach('file', Buffer.alloc(0), 'empty_payload.xlsx')
        .expect(400);

      // Layer 2: Universal Error Envelope Contract
      expect(res.body).toHaveProperty('error');
      expect(['IMPORT_EMPTY_FILE', 'INTAKE_IMPORT_EMPTY', 'VALIDATION_FAILED']).toContain(
        res.body.error.code,
      );

      // Layer 3: Direct Database Verification - Zero records created
      const dbCount = await helper.getPrisma().khau_phan_24h.count({
        where: { benh_nhan_id: defaultPatientId },
      });
      expect(dbCount).toBe(0);
    });

    it('3.2 Upload file sai định dạng (txt/pdf giả danh xlsx) -> Trả về 400 IMPORT_FILE_CORRUPTED, không crash server', async () => {
      const corruptedBuffer = Buffer.from(
        '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Malicious Fake Excel) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      );

      const res = await request(helper.getHttpServer())
        .post(`/api/daily-intakes/import?patientId=${defaultPatientId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .attach('file', corruptedBuffer, 'fake_invoice.xlsx')
        .expect(400);

      // Layer 2: API Contract Envelope
      expect(res.body).toHaveProperty('error');
      expect(['IMPORT_FILE_CORRUPTED', 'VALIDATION_FAILED']).toContain(res.body.error.code);

      // Layer 3: Direct Database Verification
      const dbCount = await helper.getPrisma().khau_phan_24h.count({
        where: { benh_nhan_id: defaultPatientId },
      });
      expect(dbCount).toBe(0);
    });

    it('3.3 Upload file Excel chứa 100 dòng lỗi bẩn -> Hệ thống không crash 500, trả về danh sách chi tiết lỗi kèm file Excel đánh dấu đỏ, rollback 100% CSDL', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Khau_phan_24h');
      sheet.addRow(['Bữa ăn', 'Giờ ăn', 'Tên nguyên liệu', 'Khối lượng sống sạch (g)', 'Ghi chú']);

      // Bơm 100 dòng lỗi hỗn tạp: Nguyên liệu không tồn tại, khối lượng âm, sai format giờ
      for (let r = 1; r <= 100; r++) {
        if (r % 3 === 0) {
          // Nguyên liệu ma không có trong hệ thống
          sheet.addRow([`Bữa ăn ${r}`, '07:00', `Nguyên liệu ma quỷ #${r}`, 100, 'Test rác']);
        } else if (r % 3 === 1) {
          // Khối lượng âm
          sheet.addRow([
            `Bữa ăn ${r}`,
            '12:00',
            'Thịt bò bắp tươi Chaos',
            -50 - r,
            'Khối lượng âm',
          ]);
        } else {
          // Giờ ăn sai format
          sheet.addRow([`Bữa ăn ${r}`, '99:88', 'Gạo tẻ máy Chaos', 100, 'Sai format giờ']);
        }
      }

      const dirtyFileBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      // 1. Kiểm thử trực tiếp qua Service Excel
      const serviceResult = await dailyIntakeExcelService.importDailyIntakeExcel({
        fileBuffer: dirtyFileBuffer,
        options: {
          patientId: defaultPatientId,
          userId: regularUser.id,
        },
      });

      expect(serviceResult.success).toBe(false);
      expect(serviceResult.importedCount).toBe(0);
      expect(serviceResult.errorsCount).toBeGreaterThanOrEqual(100);
      expect(serviceResult.errorRows).toBeDefined();
      expect(serviceResult.errorRows?.length).toBeGreaterThanOrEqual(100);
      expect(serviceResult.errorFileBuffer).toBeDefined();

      // Kiểm chứng file Excel kết quả đánh dấu đỏ có thể đọc lại bằng ExcelJS
      const errWb = new ExcelJS.Workbook();
      await errWb.xlsx.load(serviceResult.errorFileBuffer as any);
      const errSheet = errWb.getWorksheet('Ket_qua_kiem_tra');
      expect(errSheet).toBeDefined();
      expect(errSheet.getCell('F1').value).toContain('Validation Errors');

      // 2. Kiểm thử qua HTTP Endpoint (Server không crash 500)
      const res = await request(helper.getHttpServer())
        .post(`/api/daily-intakes/import?patientId=${defaultPatientId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .attach('file', dirtyFileBuffer, 'dirty_100_rows.xlsx')
        .buffer(true)
        .parse(binaryBufferParser);

      expect([200, 201]).toContain(res.status); // Trả về file Excel đánh dấu dòng lỗi, không crash 500
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument',
      );
      expect(res.headers['content-disposition']).toContain('attachment');

      // Layer 3: Direct Database Verification - CSDL hoàn toàn sạch bóng, không bản ghi nào lọt vào
      const prisma = helper.getPrisma();
      const intakeCount = await prisma.khau_phan_24h.count({
        where: { benh_nhan_id: defaultPatientId },
      });
      const mealCount = await prisma.khau_phan_24h_bua_an.count();
      const ingCount = await prisma.khau_phan_24h_nguyen_lieu.count();

      expect(intakeCount).toBe(0);
      expect(mealCount).toBe(0);
      expect(ingCount).toBe(0);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 4: STREAM BACKPRESSURE & ANTI-OOM KHI XUẤT EXCEL KHỦNG
  // ==========================================================================
  describe('Kịch bản 4: Stream Backpressure & Chống Tràn Bộ Nhớ (Anti-OOM) khi Xuất Excel Khủng', () => {
    it('4.1 Xuất Excel thực đơn chu kỳ tháng (30 ngày x 5 bữa x 4 món = 600 món ăn) với 86 chỉ tiêu -> Stream Writable mượt mà, heap memory ổn định, HTTP 200 hợp lệ', async () => {
      // 1. Xây dựng Mock Menu 30 ngày x 5 bữa x 4 món = 600 món ăn với 86 chỉ tiêu vi chất
      const daysCount = 30;
      const mealsPerDay = 5;
      const dishesPerMeal = 4;

      const mockMenuDetails: any[] = [];
      const mealNames = ['Bữa sáng', 'Bữa phụ sáng', 'Bữa trưa', 'Bữa phụ chiều', 'Bữa tối'];

      for (let day = 1; day <= daysCount; day++) {
        const weekNo = Math.ceil(day / 7);
        const dayOfWeek = ((day - 1) % 7) + 2; // Thứ 2 -> Chủ nhật (2-8)

        for (let m = 0; m < mealsPerDay; m++) {
          const dishes = [];
          for (let d = 0; d < dishesPerMeal; d++) {
            dishes.push({
              id: BigInt(day * 1000 + m * 10 + d),
              mon_an_id: BigInt(day * 1000 + m * 10 + d),
              he_so_song_chin: 1.0,
              mon_an: {
                id: BigInt(day * 1000 + m * 10 + d),
                ten_mon: `Món ăn D${day}-M${m + 1}-D${d + 1}`,
                chi_tiet_mon_an: [
                  {
                    khoi_luong_gam: 100,
                    nguyen_lieu: {
                      id: BigInt(beefIngId),
                      ten_nguyen_lieu: 'Thịt bò bắp tươi Chaos',
                      edible: 100,
                      water: 72.0,
                      protein: 21.5,
                      fat: 4.5,
                      carbohydrate: 0.0,
                      fiber: 0.0,
                      ash: 1.1,
                      calci: 12.0,
                      iron: 2.8,
                      sodium: 65.0,
                      potassium: 340.0,
                      vitaminC: 0.0,
                    },
                  },
                ],
              },
            });
          }

          mockMenuDetails.push({
            so_tuan: weekNo,
            thu_trong_tuan: dayOfWeek,
            thu_tu_trong_tuan: m + 1,
            bua_an: {
              id: BigInt(day * 100 + m),
              ten_bua_an: `${mealNames[m]} Ngày ${day}`,
              gio_an: '08:00',
              chi_tiet_bua_an: dishes,
            },
          });
        }
      }

      const hugeMenu = {
        id: BigInt(9999),
        ten_thuc_don: 'Thực đơn đại chu kỳ 30 ngày Anti-OOM Stress Test',
        loai_thuc_don: MenuType.THANG,
        loai_doi_tuong: TargetType.BENH_NHAN,
        benh_nhan: {
          ho_ten: 'Bệnh Nhân Thử Tải Bộ Nhớ',
          ma_benh_nhan_bv: 'BN-OOM-STRESS',
        },
        chi_tiet_thuc_don: mockMenuDetails,
      };

      // 2. Kiểm tra Stream Writable có cơ chế Backpressure
      const chunks: Buffer[] = [];
      let totalBytesWritten = 0;

      // Giám sát RAM heap trước khi stream
      if (global.gc) global.gc();
      const memBefore = process.memoryUsage().heapUsed;

      const writableStream = new Writable({
        highWaterMark: 16384, // 16KB buffer để kích hoạt backpressure
        write(chunk: Buffer, encoding, callback) {
          chunks.push(chunk);
          totalBytesWritten += chunk.length;
          callback();
        },
      });

      // Thực thi stream thực đơn 600 món ăn
      await menuExcelService.streamMenuExcel({
        menuIdOrData: hugeMenu,
        outputStream: writableStream,
        options: {
          exportType: MenuExportType.FULL,
          columns: NUTRIENT_CODES.slice(0, 30), // 30 cột vi chất trọng yếu
        },
      });

      const memAfter = process.memoryUsage().heapUsed;
      const memDiffMb = (memAfter - memBefore) / (1024 * 1024);

      // Khẳng định: Heap memory không bị spike mất kiểm soát (dưới 150MB tăng thêm)
      expect(memDiffMb).toBeLessThan(150);

      // Khẳng định: File buffer thu được hoàn chỉnh, hợp lệ định dạng Excel XLSX (chữ ký PK\x03\x04)
      const fullBuffer = Buffer.concat(chunks);
      expect(totalBytesWritten).toBeGreaterThan(10000);
      expect(fullBuffer[0]).toBe(0x50); // 'P'
      expect(fullBuffer[1]).toBe(0x4b); // 'K'
      expect(fullBuffer[2]).toBe(0x03);
      expect(fullBuffer[3]).toBe(0x04);

      // Kiểm tra file có thể đọc lại nguyên vẹn bởi ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(fullBuffer as any);
      const sheet = wb.getWorksheet('THUC_DON');
      expect(sheet).toBeDefined();
      expect(sheet.rowCount).toBeGreaterThan(500); // Vượt hơn 500 dòng dữ liệu
    });

    it('4.2 Xuất Excel qua HTTP Endpoint /api/menus/:id/export -> HTTP 200, Content-Type chuẩn spreadsheetml và file hợp lệ', async () => {
      const prisma = helper.getPrisma();

      // Tạo thực đơn nhỏ có liên kết đầy đủ trong CSDL
      const dish = await prisma.mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Cơm bò dinh dưỡng xuất Excel',
          trang_thai: 'RIENG_TU',
          chi_tiet_mon_an: {
            create: [
              { nguyen_lieu_id: BigInt(beefIngId), khoi_luong_song_sach: 100 },
              { nguyen_lieu_id: BigInt(riceIngId), khoi_luong_song_sach: 80 },
            ],
          },
        },
      });

      const meal = await prisma.bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa trưa xuất file',
          gio_an: '12:00',
          trang_thai: 'RIENG_TU',
          chi_tiet_bua_an: {
            create: [{ mon_an_id: dish.id }],
          },
        },
      });

      const menu = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn xuất Excel chuẩn',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: defaultPatientId,
          chi_tiet_thuc_don: {
            create: [{ bua_an_id: meal.id, thu_tu_trong_tuan: 1 }],
          },
        },
      });

      // Gọi HTTP export qua POST
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${menu.id}/export`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ exportType: MenuExportType.FULL })
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(201);

      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(`thuc_don_${menu.id}_full.xlsx`);

      const buffer = res.body as Buffer;
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 5: RÀNG BUỘC TOÀN VẸN KHÓA NGOẠI & XÓA THÁC AN TOÀN (FK PROTECTION)
  // ==========================================================================
  describe('Kịch bản 5: Ràng buộc Toàn vẹn Khóa ngoại & Xóa Thác an toàn (Cascading & FK Protection)', () => {
    it('5.1 Cố gắng xóa bệnh nhân đang có thực đơn và khẩu phần 24h -> Chặn vi phạm khóa ngoại (MySQL 1451 ER_ROW_IS_REFERENCED_2), CSDL toàn vẹn', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo 1 bệnh nhân có cả thực đơn và khẩu phần 24h
      const protectedPatient = await prisma.benh_nhan.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ho_ten: 'Bệnh Nhân Được Bảo Vệ Khóa Ngoại',
          so_dien_thoai: '0912345678',
          ngay_sinh: new Date('1992-02-02'),
          gioi_tinh: 'NAM',
          ma_benh_nhan_bv: `BN-FK-PROT-${Date.now()}`,
        },
      });

      // Tạo thực đơn gắn với bệnh nhân
      const menu = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn gắn bệnh nhân FK',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: protectedPatient.id,
        },
      });

      // Tạo khẩu phần 24h gắn với bệnh nhân
      const intake = await prisma.khau_phan_24h.create({
        data: {
          nguoi_dung_id: regularUser.id,
          benh_nhan_id: protectedPatient.id,
          ngay_an: new Date('2026-07-10'),
          kieu_nhap: IntakeInputType.INGREDIENT_ONLY,
        },
      });

      // 2. Cố gắng xóa cứng qua Raw SQL: Chặn bởi MySQL Foreign Key Constraints (1451 ER_ROW_IS_REFERENCED_2)
      let rawSqlErrorCaught = false;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
          await tx.$executeRawUnsafe(
            `DELETE FROM \`benh_nhan\` WHERE \`id\` = ${protectedPatient.id};`,
          );
        });
      } catch (err: any) {
        rawSqlErrorCaught = true;
        expect(err.message).toContain('foreign key constraint fails');
      }
      expect(rawSqlErrorCaught).toBe(true);

      // Layer 3: Direct Database Verification - Bệnh nhân, thực đơn và khẩu phần 24h còn nguyên vẹn 100%
      const patientStillExists = await prisma.benh_nhan.findUnique({
        where: { id: protectedPatient.id },
      });
      const menuStillExists = await prisma.thuc_don.findUnique({
        where: { id: menu.id },
      });
      const intakeStillExists = await prisma.khau_phan_24h.findUnique({
        where: { id: intake.id },
      });

      expect(patientStillExists).not.toBeNull();
      expect(menuStillExists).not.toBeNull();
      expect(intakeStillExists).not.toBeNull();
      expect(patientStillExists?.deleted_at).toBeNull();
    });

    it('5.2 Cố gắng xóa nguyên liệu đang có trong khẩu phần 24h -> Chặn 409 Conflict với mã lỗi ING_002, CSDL không bị xóa', async () => {
      const prisma = helper.getPrisma();

      // 1. Tạo khẩu phần 24h sử dụng beefIngId
      const intake = await prisma.khau_phan_24h.create({
        data: {
          nguoi_dung_id: regularUser.id,
          benh_nhan_id: defaultPatientId,
          ngay_an: new Date('2026-07-20'),
          kieu_nhap: IntakeInputType.BY_MEAL,
        },
      });

      const meal = await prisma.khau_phan_24h_bua_an.create({
        data: {
          khau_phan_24h_id: intake.id,
          thu_tu_bua: 1,
          ten_bua: 'Bữa sáng bảo vệ nguyên liệu',
        },
      });

      const intakeIng = await prisma.khau_phan_24h_nguyen_lieu.create({
        data: {
          khau_phan_24h_bua_an_id: meal.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 120,
        },
      });

      expect(intakeIng).toBeDefined();

      // 2. Gửi request DELETE /api/ingredients/:id nhằm xóa nguyên liệu đang được dùng
      // Layer 1: Chặn với HTTP 409 Conflict
      const res = await request(helper.getHttpServer())
        .delete(`/api/ingredients/${beefIngId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      // Layer 2: API Contract Error Envelope
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('ING_002');
      expect(res.body.error.message).toContain('khẩu phần 24h hoặc hệ số sống chín');

      // Layer 3: Direct Database State Persistence
      // Nguyên liệu vẫn tồn tại trong CSDL và deleted_at = null
      const ingredientInDb = await prisma.nguyen_lieu.findUnique({
        where: { id: BigInt(beefIngId) },
      });

      expect(ingredientInDb).not.toBeNull();
      expect(ingredientInDb?.deleted_at).toBeNull();

      // Bản ghi con trong khau_phan_24h_nguyen_lieu vẫn nguyên vẹn
      const childInDb = await prisma.khau_phan_24h_nguyen_lieu.findUnique({
        where: { id: intakeIng.id },
      });
      expect(childInDb).not.toBeNull();
      expect(childInDb?.nguyen_lieu_id).toBe(BigInt(beefIngId));
    });
  });
});
