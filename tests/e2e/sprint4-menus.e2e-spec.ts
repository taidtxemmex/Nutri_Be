import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { MenuType, TargetType, MenuExportType } from '../../src/config/enums/domain.enum';

// Nâng timeout cho E2E suite để chống flaky timeout khi khởi tạo NestJS + Prisma
jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 4 E2E TEST SUITE: MENUS & MENU PROPOSALS (3-LAYER E2E SUITE)
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Rule 2 & Iron Discipline):
 * - Layer 1: Protocol HTTP Status Codes (200 OK, 201 Created)
 * - Layer 2: Complete Payload Response Schemas & API Envelopes ({ data, meta })
 * - Layer 3: Direct Database State Persistence (Prisma queries: expect(dbRecord).toBe(...))
 * ============================================================================
 */
describe('Sprint 4: Menus & Menu Proposals (3-Layer E2E Suite)', () => {
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
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 4' },
    });
    categoryId = cat.id;

    // 3. Tạo các nguyên liệu mẫu
    // 3.1 Thịt bò bắp
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

    // 3.2 Cần tây tươi
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

    // 3.3 Gạo tẻ
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
      username: `admin_m4_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Menu Sprint 4',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_m4_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Dinh Dưỡng Sprint 4',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    // 5. Khởi tạo bệnh nhân mẫu
    const patient = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: regularUser.id,
        ho_ten: 'Nguyễn Văn Bệnh Nhân',
        so_dien_thoai: '0912345678',
        ngay_sinh: new Date('1985-06-15'),
        gioi_tinh: 'NAM',
        can_nang: 65.0,
        chieu_cao: 170.0,
        he_so_hoat_dong: 1.4,
        ma_benh_nhan_bv: `BN-${uniqueSuffix}`,
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
  // KỊCH BẢN 1: QUY TRÌNH TẠO THỰC ĐƠN 5 CẤP & ĐỊNH TUYẾN KÉP (/api/menus & /api/menu)
  // ==========================================================================
  describe('Kịch bản 1: Quy trình tạo thực đơn 5 cấp & Định tuyến kép (/api/menus & /api/menu)', () => {
    it('1.1 Tạo thực đơn 5 cấp hoàn chỉnh qua /api/menus -> Layer 3 verify thuc_don, chi_tiet_thuc_don, bua_an, chi_tiet_bua_an, mon_an, chi_tiet_mon_an', async () => {
      const payload = {
        menuName: 'Thực đơn tuần điều trị cao huyết áp',
        menuType: MenuType.TUAN,
        targetType: TargetType.BENH_NHAN,
        patientId: testPatientId,
        weeks: [
          {
            weekNo: 1,
            days: [
              {
                dayOfWeek: 2, // Thứ 2
                meals: [
                  {
                    mealName: 'Bữa sáng dinh dưỡng',
                    time: '07:30',
                    dishes: [
                      {
                        name: 'Cháo thịt bò cần tây',
                        coefficient: 1.0,
                        details: [
                          { ingredientId: beefIngId, netWeight: 60 },
                          { ingredientId: celeryIngId, netWeight: 30 },
                          { ingredientId: riceIngId, netWeight: 40 },
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

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/menus')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.menuName).toBe('Thực đơn tuần điều trị cao huyết áp');
      expect(res.body.data.menuType).toBe(MenuType.TUAN);
      expect(res.body.data.message).toBe('Tạo thực đơn thành công');
      expect(res.body.data.totalEnergy).toBeDefined();

      const createdMenuId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const prisma = helper.getPrisma();

      // Cấp 1: Bảng thuc_don
      const dbMenu = await prisma.thuc_don.findUnique({
        where: { id: BigInt(createdMenuId) },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.ten_thuc_don).toBe('Thực đơn tuần điều trị cao huyết áp');
      expect(dbMenu?.loai_thuc_don).toBe(MenuType.TUAN);
      expect(dbMenu?.loai_doi_tuong).toBe(TargetType.BENH_NHAN);
      expect(dbMenu?.benh_nhan_id).toBe(BigInt(testPatientId));
      expect(dbMenu?.nguoi_dung_id).toBe(regularUser.id);

      // Cấp 2 & Cấp 3: Bảng chi_tiet_thuc_don (Tuần 1, Thứ 2)
      const dbDetails = await prisma.chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: BigInt(createdMenuId) },
      });
      expect(dbDetails.length).toBe(1);
      expect(dbDetails[0].so_tuan).toBe(1);
      expect(dbDetails[0].thu_trong_tuan).toBe(2);

      // Cấp 4: Bảng bua_an
      const dbMeal = await prisma.bua_an.findUnique({
        where: { id: dbDetails[0].bua_an_id },
      });
      expect(dbMeal).not.toBeNull();
      expect(dbMeal?.ten_bua_an).toBe('Bữa sáng dinh dưỡng');
      expect(dbMeal?.gio_an).toBe('07:30');

      // Cấp 5: Bảng chi_tiet_bua_an & mon_an & chi_tiet_mon_an
      const dbMealDishes = await prisma.chi_tiet_bua_an.findMany({
        where: { bua_an_id: dbMeal!.id },
      });
      expect(dbMealDishes.length).toBe(1);
      expect(dbMealDishes[0].he_so_song_chin).toBe(1.0);

      const dbDish = await prisma.mon_an.findUnique({
        where: { id: dbMealDishes[0].mon_an_id },
      });
      expect(dbDish).not.toBeNull();
      expect(dbDish?.ten_mon).toBe('Cháo thịt bò cần tây');

      const dbDishIngredients = await prisma.chi_tiet_mon_an.findMany({
        where: { mon_an_id: dbDish!.id },
      });
      expect(dbDishIngredients.length).toBe(3);
    });

    it('1.2 Định tuyến kép: Tạo thực đơn ngày qua /api/menu (POST) -> Layer 3 verify thuc_don', async () => {
      const payload = {
        menuName: 'Thực đơn ngày năng lượng cao',
        menuType: MenuType.NGAY,
        targetType: TargetType.BENH_NHAN,
        patientId: testPatientId,
        meals: [
          {
            mealName: 'Bữa trưa hồi phục',
            time: '12:00',
            dishes: [
              {
                name: 'Thịt bò xào',
                coefficient: 1.0,
                details: [{ ingredientId: beefIngId, netWeight: 120 }],
              },
            ],
          },
        ],
      };

      // Layer 1: HTTP Status Code qua route /api/menu (định tuyến kép)
      const res = await request(helper.getHttpServer())
        .post('/api/menu')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.menuName).toBe('Thực đơn ngày năng lượng cao');
      expect(res.body.data.menuType).toBe(MenuType.NGAY);

      // Layer 3: Direct Database Assertion
      const dbMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: BigInt(res.body.data.id) },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.ten_thuc_don).toBe('Thực đơn ngày năng lượng cao');
      expect(dbMenu?.loai_thuc_don).toBe(MenuType.NGAY);
    });

    it('1.3 Lấy danh sách thực đơn qua cả hai định tuyến /api/menus và /api/menu (GET)', async () => {
      // Tạo trước 1 thực đơn
      await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn lấy danh sách',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(testPatientId),
          ngay_tao: new Date(),
        },
      });

      // Gọi qua /api/menus
      const resPlural = await request(helper.getHttpServer())
        .get('/api/menus?page=1&limit=10')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(resPlural.body).toHaveProperty('data');
      expect(Array.isArray(resPlural.body.data)).toBe(true);
      expect(resPlural.body.meta.totalItems).toBeGreaterThanOrEqual(1);

      // Gọi qua /api/menu
      const resSingular = await request(helper.getHttpServer())
        .get('/api/menu?page=1&limit=10')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(resSingular.body).toHaveProperty('data');
      expect(Array.isArray(resSingular.body.data)).toBe(true);
      expect(resSingular.body.meta.totalItems).toBeGreaterThanOrEqual(1);

      // Layer 3 DB State
      const count = await helper.getPrisma().thuc_don.count({
        where: { nguoi_dung_id: regularUser.id },
      });
      expect(resPlural.body.meta.totalItems).toBe(count);
    });

    it('1.4 Lấy chi tiết cây thực đơn 5 cấp qua /api/menus/:id/full -> Layer 3 verify', async () => {
      // Tạo thực đơn có món
      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn chi tiết full',
          loai_thuc_don: MenuType.TUAN,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(testPatientId),
        },
      });

      const meal = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa trưa',
          gio_an: '12:00',
        },
      });

      await helper.getPrisma().chi_tiet_thuc_don.create({
        data: {
          thuc_don_id: menu.id,
          bua_an_id: meal.id,
          so_tuan: 1,
          thu_trong_tuan: 3,
          thu_tu_trong_tuan: 1,
        },
      });

      // Layer 1: HTTP 200
      const res = await request(helper.getHttpServer())
        .get(`/api/menus/${menu.id}/full`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: Schema Payload
      expect(res.body.data.id).toBe(menu.id.toString());
      expect(res.body.data.menuName).toBe('Thực đơn chi tiết full');
      expect(res.body.data.weeks.length).toBe(1);
      expect(res.body.data.weeks[0].weekNo).toBe(1);
      expect(res.body.data.weeks[0].days[0].dayOfWeek).toBe(3);

      // Layer 3: DB Assertion
      const dbCheck = await helper.getPrisma().chi_tiet_thuc_don.findFirst({
        where: { thuc_don_id: menu.id, so_tuan: 1, thu_trong_tuan: 3 },
      });
      expect(dbCheck).not.toBeNull();
    });
  });

  // ==========================================================================
  // KỊCH BẢN 2: API RESOLVE-DISH (POST /api/menus/:id/resolve-dish & /api/menu/:id/resolve-dish)
  // ==========================================================================
  describe('Kịch bản 2: API resolve-dish inline & liên kết món ăn', () => {
    it('2.1 Tạo món ăn inline nhanh theo recipe -> Layer 3 verify mon_an với recipe_hash và chi_tiet_mon_an', async () => {
      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn thử nghiệm resolve-dish',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      const payload = {
        name: 'Thịt bò xào cần tây đặc biệt',
        coefficient: 1.0,
        details: [
          { ingredientId: beefIngId, netWeight: 150 },
          { ingredientId: celeryIngId, netWeight: 50 },
        ],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${menu.id}/resolve-dish`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: Contract Response
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('dishId');
      expect(res.body.data.name).toBe('Thịt bò xào cần tây đặc biệt');
      expect(res.body.data.recipeHash).toBeDefined();

      const createdDishId = res.body.data.dishId;

      // Layer 3: Direct Database State Persistence Assertion
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(createdDishId) },
      });
      expect(dbDish).not.toBeNull();
      expect(dbDish?.ten_mon).toBe('Thịt bò xào cần tây đặc biệt');
      expect(dbDish?.recipe_hash).toBe(res.body.data.recipeHash);

      const dbDetails = await helper.getPrisma().chi_tiet_mon_an.findMany({
        where: { mon_an_id: BigInt(createdDishId) },
      });
      expect(dbDetails.length).toBe(2);
    });

    it('2.2 Định tuyến kép /api/menu/:id/resolve-dish với dishId có sẵn -> Layer 3 verify tái sử dụng món ăn', async () => {
      // Tạo trước 1 món ăn
      const existingDish = await helper.getPrisma().mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Món ăn có sẵn',
          trang_thai: 'HE_THONG',
        },
      });

      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn liên kết món',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      // Layer 1: Gọi qua định tuyến /api/menu/:id/resolve-dish
      const res = await request(helper.getHttpServer())
        .post(`/api/menu/${menu.id}/resolve-dish`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ dishId: existingDish.id.toString() })
        .expect(201);

      // Layer 2: API Envelope
      expect(res.body.data.dishId).toBe(existingDish.id.toString());
      expect(res.body.data.name).toBe('Món ăn có sẵn');

      // Layer 3: Database Verification - không tạo thêm món ăn mới
      const totalDishes = await helper.getPrisma().mon_an.count({
        where: { ten_mon: 'Món ăn có sẵn' },
      });
      expect(totalDishes).toBe(1);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 3: CLONE THỰC ĐƠN (POST /api/menus/:id/clone)
  // ==========================================================================
  describe('Kịch bản 3: Clone thực đơn sâu (Deep Copy)', () => {
    it('3.1 Nhân bản sâu toàn bộ thực đơn sang ID mới -> Layer 3 verify [Bản sao] và các bản sao bữa ăn độc lập', async () => {
      // 1. Tạo thực đơn gốc gồm bữa ăn và món ăn
      const originalMenu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn gốc cần clone',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(testPatientId),
        },
      });

      const originalMeal = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa sáng gốc',
          gio_an: '07:00',
        },
      });

      await helper.getPrisma().chi_tiet_thuc_don.create({
        data: {
          thuc_don_id: originalMenu.id,
          bua_an_id: originalMeal.id,
          thu_tu_trong_tuan: 1,
        },
      });

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${originalMenu.id}/clone`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(201);

      // Layer 2: Contract Response
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.id).not.toBe(originalMenu.id.toString());
      expect(res.body.data.menuName).toBe('[Bản sao] Thực đơn gốc cần clone');

      const clonedMenuId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbClonedMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: BigInt(clonedMenuId) },
      });
      expect(dbClonedMenu).not.toBeNull();
      expect(dbClonedMenu?.ten_thuc_don).toBe('[Bản sao] Thực đơn gốc cần clone');
      expect(dbClonedMenu?.nguoi_dung_id).toBe(regularUser.id);

      // Khẳng định chi tiết thực đơn đã được nhân bản sâu
      const clonedDetails = await helper.getPrisma().chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: BigInt(clonedMenuId) },
      });
      expect(clonedDetails.length).toBe(1);
      // Bữa ăn của bản sao phải là 1 bản ghi mới độc lập (không trỏ vào bữa ăn gốc)
      expect(clonedDetails[0].bua_an_id).not.toBe(originalMeal.id);

      const dbClonedMeal = await helper.getPrisma().bua_an.findUnique({
        where: { id: clonedDetails[0].bua_an_id },
      });
      expect(dbClonedMeal).not.toBeNull();
      expect(dbClonedMeal?.ten_bua_an).toBe('Bữa sáng gốc');
    });
  });

  // ==========================================================================
  // KỊCH BẢN 4: ĐỀ XUẤT THỰC ĐƠN & ĐÓNG BĂNG SNAPSHOT JSONB
  // ==========================================================================
  describe('Kịch bản 4: Đề xuất thực đơn & Đóng băng Snapshot JSONB (POST /api/menu-proposals/:menuId)', () => {
    it('4.1 Nộp đề xuất thực đơn -> Layer 3 verify de_xuat_thuc_don có snapshot_json đóng băng cấu trúc 5 cấp', async () => {
      // 1. Tạo thực đơn gốc với đầy đủ chi tiết món ăn
      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn đề xuất đóng băng snapshot',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(testPatientId),
        },
      });

      const dish = await helper.getPrisma().mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Cháo thịt bò dinh dưỡng',
          trang_thai: 'RIENG_TU',
        },
      });

      await helper.getPrisma().chi_tiet_mon_an.create({
        data: {
          mon_an_id: dish.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 80,
        },
      });

      const meal = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa sáng đề xuất',
          gio_an: '08:00',
        },
      });

      await helper.getPrisma().chi_tiet_bua_an.create({
        data: {
          bua_an_id: meal.id,
          mon_an_id: dish.id,
          he_so_song_chin: 1.0,
        },
      });

      await helper.getPrisma().chi_tiet_thuc_don.create({
        data: {
          thuc_don_id: menu.id,
          bua_an_id: meal.id,
          thu_tu_trong_tuan: 1,
        },
      });

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post(`/api/menu-proposals/${menu.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.proposalId).toBeDefined();

      const proposalId = res.body.data.proposalId;

      // Layer 3: Direct Database State Persistence Assertion
      const dbProposal = await helper.getPrisma().de_xuat_thuc_don.findUnique({
        where: { id: BigInt(proposalId) },
      });
      expect(dbProposal).not.toBeNull();
      expect(dbProposal?.trang_thai).toBe('CHO_DUYET');
      expect(dbProposal?.menu_goc_id).toBe(menu.id);
      expect(dbProposal?.nguoi_de_xuat_id).toBe(regularUser.id);

      // Khẳng định snapshot_json đã được đóng băng toàn bộ cây dữ liệu tĩnh
      expect(dbProposal?.snapshot_json).toBeDefined();
      const snapshot = JSON.parse(dbProposal!.snapshot_json);
      expect(snapshot).toHaveProperty('menuName', 'Thực đơn đề xuất đóng băng snapshot');
      expect(snapshot).toHaveProperty('weeks');
      expect(snapshot.weeks.length).toBeGreaterThan(0);
      expect(JSON.stringify(snapshot)).toContain('Cháo thịt bò dinh dưỡng');
    });

    it('4.2 Lấy chi tiết đề xuất đọc trực tiếp từ Snapshot (GET /api/menu-proposals/:id/full) -> Layer 3 verify', async () => {
      // Tạo bản ghi đề xuất sẵn
      const snapshotData = {
        id: '100',
        menuName: 'Thực đơn đọc từ Snapshot',
        menuType: MenuType.NGAY,
        weeks: [{ weekNo: 1, days: [{ dayOfWeek: 2, meals: [] }] }],
      };

      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Menu test full',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      const proposal = await helper.getPrisma().de_xuat_thuc_don.create({
        data: {
          menu_goc_id: menu.id,
          nguoi_de_xuat_id: regularUser.id,
          ten_thuc_don: 'Thực đơn đọc từ Snapshot',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          trang_thai: 'CHO_DUYET',
          snapshot_json: JSON.stringify(snapshotData),
        },
      });

      // Layer 1: HTTP 200
      const res = await request(helper.getHttpServer())
        .get(`/api/menu-proposals/${proposal.id}/full`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: API Contract
      expect(res.body.data.proposalId).toBe(proposal.id.toString());
      expect(res.body.data.menuName).toBe('Thực đơn đọc từ Snapshot');
      expect(Array.isArray(res.body.data.weeks)).toBe(true);

      // Layer 3: DB check
      const dbProp = await helper.getPrisma().de_xuat_thuc_don.findUnique({
        where: { id: proposal.id },
      });
      expect(dbProp).not.toBeNull();
    });
  });

  // ==========================================================================
  // KỊCH BẢN 5: ADMIN PHÊ DUYỆT ĐỀ XUẤT THỰC ĐƠN
  // ==========================================================================
  describe('Kịch bản 5: Admin phê duyệt đề xuất thực đơn (PUT /api/menu-proposals/:id/approve)', () => {
    it('5.1 Admin phê duyệt đề xuất -> Layer 3 verify de_xuat_thuc_don: DA_DUYET và thuc_don gốc: CONG_KHAI', async () => {
      // 1. Tạo thực đơn gốc dạng NGAY
      const originalMenu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn chờ phê duyệt',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      // 2. Tạo đề xuất ở trạng thái CHO_DUYET
      const proposal = await helper.getPrisma().de_xuat_thuc_don.create({
        data: {
          menu_goc_id: originalMenu.id,
          nguoi_de_xuat_id: regularUser.id,
          ten_thuc_don: 'Thực đơn chờ phê duyệt',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          trang_thai: 'CHO_DUYET',
          snapshot_json: JSON.stringify({ menuName: 'Thực đơn chờ phê duyệt' }),
        },
      });

      // Layer 1: HTTP Status Code (Admin duyệt)
      const res = await request(helper.getHttpServer())
        .put(`/api/menu-proposals/${proposal.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toBe('Phê duyệt đề xuất thực đơn thành công');

      // Layer 3: Direct Database State Persistence Assertion
      const prisma = helper.getPrisma();

      // Đề xuất phải chuyển sang DA_DUYET và ghi nhận ID người duyệt
      const dbProposal = await prisma.de_xuat_thuc_don.findUnique({
        where: { id: proposal.id },
      });
      expect(dbProposal).not.toBeNull();
      expect(dbProposal?.trang_thai).toBe('DA_DUYET');
      expect(dbProposal?.nguoi_phe_duyet_id).toBe(adminUser.id);
      expect(dbProposal?.ngay_phe_duyet).toBeDefined();

      // Thực đơn gốc phải chuyển trạng thái loai_thuc_don thành CONG_KHAI
      const dbOriginalMenu = await prisma.thuc_don.findUnique({
        where: { id: originalMenu.id },
      });
      expect(dbOriginalMenu).not.toBeNull();
      expect(dbOriginalMenu?.loai_thuc_don).toBe('CONG_KHAI');
    });
  });

  // ==========================================================================
  // KỊCH BẢN 6: XUẤT EXCEL THỰC ĐƠN 5 CHẾ ĐỘ (FULL, NET, NET_NUTRITION, RAW, COOKED)
  // ==========================================================================
  describe('Kịch bản 6: Xuất Excel thực đơn lâm sàng 5 chế độ', () => {
    let exportMenuId: bigint;

    beforeEach(async () => {
      // Chuẩn bị thực đơn đầy đủ phục vụ xuất Excel
      const menu = await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_thuc_don: 'Thực đơn mẫu xuất Excel Sprint 4',
          loai_thuc_don: MenuType.TUAN,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(testPatientId),
        },
      });
      exportMenuId = menu.id;

      const dish = await helper.getPrisma().mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Bò xào cần tây xuất file',
        },
      });

      await helper.getPrisma().chi_tiet_mon_an.create({
        data: {
          mon_an_id: dish.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 100,
        },
      });

      const meal = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa trưa',
          gio_an: '11:30',
        },
      });

      await helper.getPrisma().chi_tiet_bua_an.create({
        data: {
          bua_an_id: meal.id,
          mon_an_id: dish.id,
          he_so_song_chin: 1.2,
        },
      });

      await helper.getPrisma().chi_tiet_thuc_don.create({
        data: {
          thuc_don_id: menu.id,
          bua_an_id: meal.id,
          so_tuan: 1,
          thu_trong_tuan: 2,
          thu_tu_trong_tuan: 1,
        },
      });
    });

    const exportModes = [
      MenuExportType.FULL,
      MenuExportType.NET,
      MenuExportType.NET_NUTRITION,
      MenuExportType.RAW,
      MenuExportType.COOKED,
    ];

    for (const mode of exportModes) {
      it(`6.1 Xuất Excel chế độ ${mode} (/api/menus/:id/export) -> Layer 3 verify`, async () => {
        // Layer 1: HTTP Status Code 201 (POST /api/menus/:id/export)
        const res = await request(helper.getHttpServer())
          .post(`/api/menus/${exportMenuId}/export`)
          .set('Authorization', `Bearer ${regularToken}`)
          .send({ exportType: mode })
          .buffer(true)
          .parse(binaryBufferParser)
          .expect(201);

        // Layer 2: Binary Headers & Non-Empty Buffer
        expect(res.headers['content-type']).toContain(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        expect(res.headers['content-disposition']).toContain(
          `attachment; filename="thuc_don_${exportMenuId}_${mode.toLowerCase()}.xlsx"`,
        );
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);

        // Layer 3: Direct Database State Persistence Assertion
        const dbMenu = await helper.getPrisma().thuc_don.findUnique({
          where: { id: exportMenuId },
        });
        expect(dbMenu).not.toBeNull();
        expect(dbMenu?.ten_thuc_don).toBe('Thực đơn mẫu xuất Excel Sprint 4');
      });
    }

    it('6.2 Định tuyến kép: Xuất Excel qua /api/menu/:id/export -> Layer 3 verify', async () => {
      // Layer 1: HTTP 201 qua route số ít /api/menu/:id/export
      const res = await request(helper.getHttpServer())
        .post(`/api/menu/${exportMenuId}/export`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ exportType: MenuExportType.FULL })
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(201);

      // Layer 2: Headers
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Layer 3: DB Verification
      const dbCheck = await helper.getPrisma().thuc_don.findUnique({
        where: { id: exportMenuId },
      });
      expect(dbCheck).not.toBeNull();
    });
  });
});
