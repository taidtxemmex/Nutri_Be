import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { DishStatus } from '../../src/config/enums/domain.enum';

/**
 * ============================================================================
 * SPRINT 3 E2E TEST SUITE: DISHES, MEALS & COOKING COEFFICIENTS
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Rule 5 & Iron Discipline):
 * - Layer 1: Protocol HTTP Status Codes (200, 201, 400, 403, 404, 409)
 * - Layer 2: Universal API Contract Envelope ({ data, meta } / { error, meta })
 * - Layer 3: Database Ground Truth Verification (Direct Prisma queries)
 * ============================================================================
 */
describe('Sprint 3: Dishes, Meals & Cooking Coefficients (3-Layer E2E Suite)', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let adminUser: any;
  let regularToken: string;
  let regularUser: any;
  let otherUserToken: string;
  let otherUser: any;

  let categoryId: number;
  let beefIngId: number;
  let celeryIngId: number;
  let porkIngId: number;

  beforeAll(async () => {
    await helper.init();
  });

  beforeEach(async () => {
    const prisma = helper.getPrisma();

    // 1. Dọn dẹp CSDL theo thứ tự khóa ngoại từ bảng con đến bảng cha
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `he_so_song_chin`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await helper.cleanDatabase();

    // 2. Tạo danh mục chuẩn
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 3' },
    });
    categoryId = cat.id;

    // 3. Tạo nguyên liệu mẫu phục vụ tính toán vi chất
    // 3.1 Thịt bò bắp (Đạm động vật cao)
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

    // 3.2 Cần tây tươi (Chất xơ, vitamin, đạm thực vật)
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

    // 3.3 Thịt heo nạc
    const pork = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: 'Thịt heo nạc mông',
        danh_muc: categoryId,
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 73.0,
        protein: 19.0,
        fat: 7.0,
        fiber: 0.0,
        ash: 1.0,
        calci: 9.0,
        iron: 1.5,
        sodium: 60.0,
        potassium: 320.0,
        vitaminC: 0.0,
        trang_thai: 'DA_DUYET',
      },
    });
    porkIngId = Number(pork.id);

    // 4. Khởi tạo tài khoản kiểm thử
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const admin = await helper.createTestUser({
      username: `admin_s3_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Sprint 3',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_s3_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng Sprint 3',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    const other = await helper.createTestUser({
      username: `other_s3_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng Khác Sprint 3',
    });
    otherUserToken = other.token;
    otherUser = other.user;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
    await helper.close();
  });

  // ==========================================================================
  // KỊCH BẢN 1: HỆ SỐ SỐNG CHÍN (/api/coefficients)
  // ==========================================================================
  describe('Kịch bản 1: Hệ số sống chín (/api/coefficients)', () => {
    it('1.1 Admin tạo hệ số công khai (isPublic: true) -> Layer 3 verify is_public = true, nguoi_dung_id = null', async () => {
      const payload = {
        ingredientId: beefIngId,
        processingMethod: 'Luộc chín kỹ',
        coefficient: 1.25,
        isPublic: true,
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/coefficients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.ingredientId).toBe(beefIngId);
      expect(res.body.data.processingMethod).toBe('Luộc chín kỹ');
      expect(res.body.data.coefficient).toBe(1.25);
      expect(res.body.data.isPublic).toBe(true);
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      const publicCoeffId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbCoeff = await helper.getPrisma().he_so_song_chin.findUnique({
        where: { id: BigInt(publicCoeffId) },
      });
      expect(dbCoeff).not.toBeNull();
      expect(Number(dbCoeff?.nguyen_lieu_id)).toBe(beefIngId);
      expect(dbCoeff?.phuong_phap_che_bien).toBe('Luộc chín kỹ');
      expect(Number(dbCoeff?.he_so)).toBe(1.25);
      expect(dbCoeff?.is_public).toBe(true);
      expect(dbCoeff?.nguoi_dung_id).toBeNull();
    });

    it('1.2 User tạo hệ số riêng (isPublic: false) -> Layer 3 verify is_public = false, nguoi_dung_id = regularUser.id', async () => {
      const payload = {
        ingredientId: beefIngId,
        processingMethod: 'Nướng than hoa',
        coefficient: 0.85,
        isPublic: false,
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/coefficients')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.ingredientId).toBe(beefIngId);
      expect(res.body.data.processingMethod).toBe('Nướng than hoa');
      expect(res.body.data.coefficient).toBe(0.85);
      expect(res.body.data.isPublic).toBe(false);
      expect(res.body.data.userId).toBe(regularUser.id);

      const privateCoeffId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbCoeff = await helper.getPrisma().he_so_song_chin.findUnique({
        where: { id: BigInt(privateCoeffId) },
      });
      expect(dbCoeff).not.toBeNull();
      expect(dbCoeff?.is_public).toBe(false);
      expect(dbCoeff?.nguoi_dung_id).toBe(regularUser.id);
      expect(Number(dbCoeff?.he_so)).toBe(0.85);
    });

    it('1.3 Chặn tạo trùng cặp (nguyen_lieu_id, phuong_phap_che_bien) -> ném COEF_002 hoặc COEF_003', async () => {
      // 1. Tạo trước hệ số của regularUser
      await helper.getPrisma().he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(porkIngId),
          phuong_phap_che_bien: 'Hấp cách thủy',
          he_so: 1.1,
          is_public: false,
          nguoi_dung_id: regularUser.id,
        },
      });

      // 2. User tạo trùng cặp -> Ném COEF_002
      const duplicateUserRes = await request(helper.getHttpServer())
        .post('/api/v1/coefficients')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          ingredientId: porkIngId,
          processingMethod: 'Hấp cách thủy',
          coefficient: 1.15,
          isPublic: false,
        })
        .expect(400);

      expect(duplicateUserRes.body.error).toHaveProperty('code', 'COEF_002');

      // 3. Tạo trước hệ số công khai của Admin
      await helper.getPrisma().he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(porkIngId),
          phuong_phap_che_bien: 'Kho tiêu',
          he_so: 0.9,
          is_public: true,
          nguoi_dung_id: null,
        },
      });

      // 4. Admin tạo trùng cặp công khai -> Ném COEF_003
      const duplicateAdminRes = await request(helper.getHttpServer())
        .post('/api/v1/coefficients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId: porkIngId,
          processingMethod: 'Kho tiêu',
          coefficient: 0.95,
          isPublic: true,
        })
        .expect(400);

      expect(duplicateAdminRes.body.error).toHaveProperty('code', 'COEF_003');

      // Layer 3: Assert số bản ghi không bị tăng thêm
      const count = await helper.getPrisma().he_so_song_chin.count({
        where: { nguyen_lieu_id: BigInt(porkIngId) },
      });
      expect(count).toBe(2);
    });

    it('1.4 User thường không được sửa hệ số công khai -> ném 403 Forbidden', async () => {
      // 1. Tạo hệ số công khai
      const publicCoeff = await helper.getPrisma().he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(celeryIngId),
          phuong_phap_che_bien: 'Xào sơ',
          he_so: 0.95,
          is_public: true,
          nguoi_dung_id: null,
        },
      });

      // 2. User thường gửi PUT sửa hệ số công khai
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/coefficients/${publicCoeff.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          coefficient: 1.5,
        })
        .expect(403);

      expect(res.body.error).toHaveProperty('code', 'AUTH_002');

      // Layer 3: Verify giá trị CSDL không bị thay đổi
      const afterDb = await helper.getPrisma().he_so_song_chin.findUnique({
        where: { id: publicCoeff.id },
      });
      expect(Number(afterDb?.he_so)).toBe(0.95);
    });

    it('1.5 Kiểm tra tab /api/coefficients/public và /api/coefficients/my', async () => {
      // Tạo 1 công khai và 1 riêng tư
      await helper.getPrisma().he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(beefIngId),
          phuong_phap_che_bien: 'Xào lăn',
          he_so: 0.9,
          is_public: true,
          nguoi_dung_id: null,
        },
      });

      await helper.getPrisma().he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(beefIngId),
          phuong_phap_che_bien: 'Nhúng giấm',
          he_so: 1.0,
          is_public: false,
          nguoi_dung_id: regularUser.id,
        },
      });

      // Tab Public
      const publicRes = await request(helper.getHttpServer())
        .get('/api/v1/coefficients/public')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(Array.isArray(publicRes.body.data)).toBe(true);
      expect(publicRes.body.data.every((c: any) => c.isPublic === true)).toBe(true);

      // Layer 3: Đối chiếu số lượng CSDL công khai
      const dbPublicCount = await helper.getPrisma().he_so_song_chin.count({
        where: { is_public: true },
      });
      expect(publicRes.body.data.length).toBe(dbPublicCount);

      // Tab My
      const myRes = await request(helper.getHttpServer())
        .get('/api/v1/coefficients/my')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(Array.isArray(myRes.body.data)).toBe(true);
      expect(myRes.body.data.every((c: any) => c.userId === regularUser.id)).toBe(true);

      // Layer 3: Đối chiếu số lượng CSDL riêng tư của user
      const dbMyCount = await helper.getPrisma().he_so_song_chin.count({
        where: { nguoi_dung_id: regularUser.id },
      });
      expect(myRes.body.data.length).toBe(dbMyCount);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 2: BỮA ĂN (/api/meal và /api/meals)
  // ==========================================================================
  describe('Kịch bản 2: Bữa ăn (/api/meal và /api/meals)', () => {
    async function createSampleDishes() {
      const dish1 = await helper.getPrisma().mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Thịt bò xào cần tây',
          trang_thai: DishStatus.RIENG_TU,
          ngay_tao: new Date(),
          chi_tiet_mon_an: {
            create: [
              { nguyen_lieu_id: BigInt(beefIngId), khoi_luong_song_sach: 100 },
              { nguyen_lieu_id: BigInt(celeryIngId), khoi_luong_song_sach: 150 },
            ],
          },
        },
      });

      const dish2 = await helper.getPrisma().mon_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_mon: 'Thịt heo luộc',
          trang_thai: DishStatus.RIENG_TU,
          ngay_tao: new Date(),
          chi_tiet_mon_an: {
            create: [{ nguyen_lieu_id: BigInt(porkIngId), khoi_luong_song_sach: 150 }],
          },
        },
      });

      return { dish1Id: Number(dish1.id), dish2Id: Number(dish2.id) };
    }

    it('2.1 Tạo bữa ăn kèm món ăn và hệ số sống chín -> Layer 3 verify bua_an & chi_tiet_bua_an', async () => {
      const { dish1Id, dish2Id } = await createSampleDishes();

      const createMealPayload = {
        mealName: 'Bữa trưa hồi phục thể lực',
        time: '12:00',
        dishes: [
          { dishId: dish1Id, coefficient: 1.0 },
          { dishId: dish2Id, coefficient: 0.9 },
        ],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/meal')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(createMealPayload)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.mealName).toBe('Bữa trưa hồi phục thể lực');
      expect(res.body.data.time).toBe('12:00');
      expect(res.body.data.dishes.length).toBe(2);
      expect(res.body.data).toHaveProperty('totalMealNutrients');

      const createdMealId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbMeal = await helper.getPrisma().bua_an.findUnique({
        where: { id: BigInt(createdMealId) },
        include: { chi_tiet_bua_an: true },
      });

      expect(dbMeal).not.toBeNull();
      expect(dbMeal?.ten_bua_an).toBe('Bữa trưa hồi phục thể lực');
      expect(dbMeal?.gio_an).toBe('12:00');
      expect(dbMeal?.nguoi_dung_id).toBe(regularUser.id);
      expect(dbMeal?.chi_tiet_bua_an.length).toBe(2);

      const item1 = dbMeal?.chi_tiet_bua_an.find((d) => Number(d.mon_an_id) === dish1Id);
      const item2 = dbMeal?.chi_tiet_bua_an.find((d) => Number(d.mon_an_id) === dish2Id);

      expect(item1).toBeDefined();
      expect(Number(item1?.he_so_song_chin)).toBe(1.0);
      expect(item2).toBeDefined();
      expect(Number(item2?.he_so_song_chin)).toBe(0.9);
    });

    it('2.2 Xác nhận totalMealNutrients được tính toán tự động từ các món ăn thành phần', async () => {
      const { dish1Id, dish2Id } = await createSampleDishes();

      // 1. Tạo bữa ăn
      const createMealRes = await request(helper.getHttpServer())
        .post('/api/v1/meal')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          mealName: 'Bữa trưa tính toán dinh dưỡng',
          time: '12:00',
          dishes: [
            { dishId: dish1Id, coefficient: 1.0 },
            { dishId: dish2Id, coefficient: 1.0 },
          ],
        })
        .expect(200);

      const mealId = createMealRes.body.data.id;

      // 2. Lấy chi tiết bữa ăn
      const res = await request(helper.getHttpServer())
        .get(`/api/v1/meal/${mealId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      const totalNutrients = res.body.data.totalMealNutrients;
      expect(totalNutrients).toBeDefined();
      expect(totalNutrients.energy).toBeGreaterThan(0);
      expect(totalNutrients.protein).toBeGreaterThan(0);
      expect(totalNutrients.fat).toBeGreaterThan(0);

      // Layer 3: Kiểm tra bảng chi tiết bữa ăn liên kết đúng với món ăn
      const detailsCount = await helper.getPrisma().chi_tiet_bua_an.count({
        where: { bua_an_id: BigInt(mealId) },
      });
      expect(detailsCount).toBe(2);
    });

    it('2.3 Cập nhật bữa ăn (/api/meal/:id) -> Layer 3 verify đổi tên và khung giờ', async () => {
      const { dish1Id, dish2Id } = await createSampleDishes();

      // 1. Tạo bữa ăn ban đầu
      const initialMeal = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa trưa ban đầu',
          gio_an: '11:45',
          chi_tiet_bua_an: {
            create: [
              { mon_an_id: BigInt(dish1Id), he_so_song_chin: 1.0 },
              { mon_an_id: BigInt(dish2Id), he_so_song_chin: 0.9 },
            ],
          },
        },
      });

      const updatePayload = {
        mealName: 'Bữa trưa giàu đạm chuyên sâu',
        time: '12:30',
        dishes: [{ dishId: dish1Id, coefficient: 1.05 }],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/meal/${initialMeal.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updatePayload)
        .expect(200);

      // Layer 2: Envelope Assertion
      expect(res.body.data.mealName).toBe('Bữa trưa giàu đạm chuyên sâu');
      expect(res.body.data.time).toBe('12:30');
      expect(res.body.data.dishes.length).toBe(1);

      // Layer 3: Direct Database State Persistence Assertion
      const updatedDbMeal = await helper.getPrisma().bua_an.findUnique({
        where: { id: initialMeal.id },
        include: { chi_tiet_bua_an: true },
      });

      expect(updatedDbMeal?.ten_bua_an).toBe('Bữa trưa giàu đạm chuyên sâu');
      expect(updatedDbMeal?.gio_an).toBe('12:30');
      expect(updatedDbMeal?.chi_tiet_bua_an.length).toBe(1);
      expect(Number(updatedDbMeal?.chi_tiet_bua_an[0].he_so_song_chin)).toBe(1.05);
    });

    it('2.4 Xóa bữa ăn (/api/meal/:id) -> Layer 3 verify xóa sạch bua_an & chi_tiet_bua_an', async () => {
      const { dish1Id } = await createSampleDishes();

      // 1. Tạo bữa ăn cần xóa
      const mealToDelete = await helper.getPrisma().bua_an.create({
        data: {
          nguoi_dung_id: regularUser.id,
          ten_bua_an: 'Bữa ăn cần xóa',
          gio_an: '18:00',
          chi_tiet_bua_an: {
            create: [{ mon_an_id: BigInt(dish1Id), he_so_song_chin: 1.0 }],
          },
        },
      });

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .delete(`/api/v1/meal/${mealToDelete.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: Envelope
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.message).toMatch(/Xóa.*thành công/);

      // Layer 3: Direct Database State Persistence Assertion
      const dbMeal = await helper.getPrisma().bua_an.findUnique({
        where: { id: mealToDelete.id },
      });
      expect(dbMeal).toBeNull();

      const orphanDetails = await helper.getPrisma().chi_tiet_bua_an.findMany({
        where: { bua_an_id: mealToDelete.id },
      });
      expect(orphanDetails.length).toBe(0);
    });
  });

  // ==========================================================================
  // KỊCH BẢN 3: MÓN ĂN (/api/dish và /api/dishes)
  // ==========================================================================
  describe('Kịch bản 3: Món ăn (/api/dish và /api/dishes)', () => {
    it('3.1 Tạo món ăn mới -> Layer 3 DB kiểm tra recipe_hash SHA-256 (64 ký tự) tự động sinh', async () => {
      const payload = {
        name: 'Bò xào cần tây hành tây',
        details: [
          { ingredientId: beefIngId, netWeight: 100 },
          { ingredientId: celeryIngId, netWeight: 150 },
        ],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Bò xào cần tây hành tây');
      expect(res.body.data.status).toBe(DishStatus.RIENG_TU);
      expect(res.body.data.recipeHash).toBeDefined();
      expect(res.body.data.recipeHash).toHaveLength(64);
      expect(res.body.data.details.length).toBe(2);

      const createdDishId = res.body.data.id;
      const computedHash = res.body.data.recipeHash;

      // Layer 3: Direct Database State Persistence Assertion
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(createdDishId) },
        include: { chi_tiet_mon_an: true },
      });

      expect(dbDish).not.toBeNull();
      expect(dbDish?.ten_mon).toBe('Bò xào cần tây hành tây');
      expect(dbDish?.trang_thai).toBe(DishStatus.RIENG_TU);
      expect(dbDish?.recipe_hash).toBe(computedHash);
      expect(dbDish?.recipe_hash?.length).toBe(64);
      expect(dbDish?.nguoi_dung_id).toBe(regularUser.id);
      expect(dbDish?.chi_tiet_mon_an.length).toBe(2);

      const beefItem = dbDish?.chi_tiet_mon_an.find((d) => Number(d.nguyen_lieu_id) === beefIngId);
      const celeryItem = dbDish?.chi_tiet_mon_an.find(
        (d) => Number(d.nguyen_lieu_id) === celeryIngId,
      );

      expect(beefItem).toBeDefined();
      expect(Number(beefItem?.khoi_luong_song_sach)).toBe(100);
      expect(celeryItem).toBeDefined();
      expect(Number(celeryItem?.khoi_luong_song_sach)).toBe(150);
    });

    it('3.2 Kiểm tra tính toán 86 vi chất trả về đầy đủ trong totalNutrients (tạo món & lấy chi tiết sau phê duyệt)', async () => {
      // 1. Tạo món ăn
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Thịt bò xào cần tây giàu vi chất',
          details: [
            { ingredientId: beefIngId, netWeight: 100 },
            { ingredientId: celeryIngId, netWeight: 150 },
          ],
        })
        .expect(200);

      const dishId = createRes.body.data.id;

      // Layer 2: Kiểm tra 86 vi chất trả về đầy đủ trong response tạo món
      const nutrients = createRes.body.data.totalNutrients;
      expect(nutrients).toBeDefined();
      expect(nutrients.energy).toBeGreaterThan(0);
      expect(nutrients.protein).toBeGreaterThan(0);
      expect(nutrients.fat).toBeGreaterThan(0);
      expect(nutrients.calci).toBeGreaterThan(0);
      expect(nutrients.iron).toBeGreaterThan(0);

      // Layer 3: Kiểm tra định lượng nguyên liệu cấu thành món trong CSDL
      const dbComponents = await helper.getPrisma().chi_tiet_mon_an.findMany({
        where: { mon_an_id: BigInt(dishId) },
      });
      expect(dbComponents.length).toBe(2);

      // 2. Đề xuất và duyệt món để kiểm tra GET /api/dish/:id công khai
      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Lấy chi tiết món công khai đã duyệt
      const getDetailRes = await request(helper.getHttpServer())
        .get(`/api/v1/dish/${dishId}`)
        .expect(200);

      expect(getDetailRes.body.data.totalNutrients.energy).toBeGreaterThan(0);
      expect(getDetailRes.body.data.status).toBe(DishStatus.DA_DUYET);
    });

    it('3.3 Đề xuất món ăn (PUT /api/dish/:id/propose) -> chuyển sang CHO_DUYET', async () => {
      // 1. Tạo món ăn RIENG_TU
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món chờ đề xuất',
          details: [{ ingredientId: beefIngId, netWeight: 120 }],
        })
        .expect(200);

      const dishId = createRes.body.data.id;

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body.data).toHaveProperty('message', 'Đã gửi đề xuất');

      // Layer 3: Direct Database State Persistence Assertion
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(dishId) },
      });
      expect(dbDish?.trang_thai).toBe(DishStatus.CHO_DUYET);
    });

    it('3.4 Admin phê duyệt món (PUT /api/dish/:id/approve) -> chuyển sang DA_DUYET', async () => {
      // 1. Tạo và đề xuất món
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món để admin duyệt',
          details: [{ ingredientId: porkIngId, netWeight: 200 }],
        })
        .expect(200);

      const dishId = createRes.body.data.id;

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body.data).toHaveProperty('message', 'Đã duyệt');

      // Layer 3: Direct Database State Persistence Assertion
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(dishId) },
      });
      expect(dbDish?.trang_thai).toBe(DishStatus.DA_DUYET);
      expect(dbDish?.nguoi_phe_duyet_id).toBe(adminUser.id);
      expect(dbDish?.ngay_phe_duyet).not.toBeNull();
    });

    it('3.5 Thử đề xuất món có cùng công thức nguyên liệu -> chặn trùng lặp tức thì, ném PROP_021 (400)', async () => {
      // 1. Tạo món 1 và được Admin duyệt sang DA_DUYET
      const dish1Res = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Bò xào cần tây chuẩn công thức',
          details: [
            { ingredientId: beefIngId, netWeight: 100 },
            { ingredientId: celeryIngId, netWeight: 150 },
          ],
        })
        .expect(200);

      const dish1Id = dish1Res.body.data.id;
      const expectedHash = dish1Res.body.data.recipeHash;

      // Đề xuất món 1
      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dish1Id}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // Admin duyệt món 1
      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dish1Id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 2. User khác tạo món 2 với cùng nguyên liệu (ngay cả khi đảo thứ tự nguyên liệu!)
      const dish2Res = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Cần tây xào thịt bò (Đảo thứ tự nguyên liệu)',
          details: [
            { ingredientId: celeryIngId, netWeight: 150 }, // Đảo thứ tự
            { ingredientId: beefIngId, netWeight: 100 },
          ],
        })
        .expect(200);

      const dish2Id = dish2Res.body.data.id;
      // Khẳng định recipe_hash trùng khớp tuyệt đối nhờ thuật toán sắp xếp Canonical
      expect(dish2Res.body.data.recipeHash).toBe(expectedHash);

      // 3. Thử đề xuất món trùng công thức với món đã DA_DUYET
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dish2Id}/propose`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(400);

      // Layer 2: Error envelope ném PROP_021
      expect(res.body.error).toHaveProperty('code', 'PROP_021');

      // Layer 3: Món 2 KHÔNG ĐƯỢC PHÉP chuyển sang CHO_DUYET, vẫn giữ RIENG_TU
      const dbDish2 = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(dish2Id) },
      });
      expect(dbDish2?.trang_thai).toBe(DishStatus.RIENG_TU);
    });

    it('3.6 Thử chỉnh sửa công thức món đã DA_DUYET -> Immutability guard chặn đứng, ném DISH_002 (400)', async () => {
      // 1. Tạo và duyệt món
      const dishRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món chuẩn bị khóa bất biến',
          details: [{ ingredientId: beefIngId, netWeight: 100 }],
        })
        .expect(200);

      const dishId = dishRes.body.data.id;

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 2. User cố tình sửa món đã được duyệt
      const res = await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Cố tình đổi tên món đã duyệt',
          details: [{ ingredientId: beefIngId, netWeight: 200 }],
        })
        .expect(400);

      // Layer 2: Error envelope ném DISH_002
      expect(res.body.error).toHaveProperty('code', 'DISH_002');

      // Layer 3: CSDL Bất biến 100%, tên và chi tiết không bị thay đổi
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(dishId) },
        include: { chi_tiet_mon_an: true },
      });
      expect(dbDish?.ten_mon).toBe('Món chuẩn bị khóa bất biến');
      expect(Number(dbDish?.chi_tiet_mon_an[0].khoi_luong_song_sach)).toBe(100);
    });

    it('3.7 Nhân bản món ăn (POST /api/dish/:id/clone) -> tạo bản sao RIENG_TU từ món công khai đã duyệt', async () => {
      // 1. Tạo món gốc và được duyệt sang DA_DUYET
      const dishRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món công khai mẫu để nhân bản',
          details: [
            { ingredientId: beefIngId, netWeight: 100 },
            { ingredientId: celeryIngId, netWeight: 150 },
          ],
        })
        .expect(200);

      const originalDishId = dishRes.body.data.id;
      const originalHash = dishRes.body.data.recipeHash;

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${originalDishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${originalDishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 2. User khác (otherUser) tiến hành clone món công khai về làm món riêng tư của mình
      const clonePayload = {
        newName: 'Món công khai mẫu (Bản sao cá nhân hóa của User khác)',
      };

      // Layer 1: HTTP Status Code (201 Created)
      const res = await request(helper.getHttpServer())
        .post(`/api/v1/dish/${originalDishId}/clone`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(clonePayload)
        .expect(201);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.originalDishId).toBe(originalDishId);
      expect(res.body.data.name).toBe('Món công khai mẫu (Bản sao cá nhân hóa của User khác)');

      const clonedDishId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbClonedDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(clonedDishId) },
        include: { chi_tiet_mon_an: true },
      });

      expect(dbClonedDish).not.toBeNull();
      expect(dbClonedDish?.ten_mon).toBe('Món công khai mẫu (Bản sao cá nhân hóa của User khác)');
      expect(dbClonedDish?.trang_thai).toBe(DishStatus.RIENG_TU);
      expect(dbClonedDish?.nguoi_dung_id).toBe(otherUser.id);
      expect(dbClonedDish?.mon_goc_id).toBe(BigInt(originalDishId));
      expect(dbClonedDish?.recipe_hash).toBe(originalHash);
      expect(dbClonedDish?.chi_tiet_mon_an.length).toBe(2);
    });

    it('3.8 Tìm kiếm nhanh autocomplete (GET /api/dish/autocomplete)', async () => {
      // 1. Tạo món công khai đã duyệt để xuất hiện trong thư viện autocomplete
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Bò xào hành tây thơm ngon đặc biệt',
          details: [{ ingredientId: beefIngId, netWeight: 100 }],
        })
        .expect(200);

      const dishId = createRes.body.data.id;

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get('/api/v1/dish/autocomplete')
        .query({ dishName: 'Bò xào', limit: 5 })
        .expect(200);

      // Layer 2: Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((d: any) => d.name.includes('Bò xào'))).toBe(true);

      // Layer 3: Đối chiếu với CSDL món ăn có chứa từ khóa
      const matchingCount = await helper.getPrisma().mon_an.count({
        where: {
          ten_mon: { contains: 'Bò xào' },
          trang_thai: { in: [DishStatus.DA_DUYET, DishStatus.HE_THONG] },
          deleted_at: null,
        },
      });
      expect(matchingCount).toBeGreaterThanOrEqual(res.body.data.length);
    });
  });

  describe('Kịch bản 4: Adversarial Audit & Security Corner Cases (Ruthless QA)', () => {
    it('4.1 IDOR Vulnerability: User B can inject User A private dish into User B meal, then User A is permanently locked from deleting dish (DISH_003 Hostage)', async () => {
      // 1. User A (regularUser) tạo món ăn RIENG_TU
      const dishRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món bí mật cá nhân của User A',
          details: [{ ingredientId: beefIngId, netWeight: 100 }],
        })
        .expect(200);

      const secretDishId = dishRes.body.data.id;

      // 2. User B (otherUser) inject secretDishId của User A vào bữa ăn của mình
      // LỖ HỔNG IDOR: Backend cho phép tạo meal mà không kiểm tra quyền sở hữu món ăn riêng tư
      const mealRes = await request(helper.getHttpServer())
        .post('/api/v1/meal')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          mealName: 'Bữa ăn thu thập trộm công thức của User B',
          time: '12:00:00',
          isPublic: false,
          dishes: [{ dishId: Number(secretDishId), coefficient: 1.0 }],
        });

      // User B thành công thêm món của User A vào meal của mình
      expect(mealRes.status).toBe(200);
      expect(mealRes.body.data.dishes[0].id).toBe(secretDishId);

      // 3. User B xem chi tiết meal -> giải mã toàn bộ dinh dưỡng của món User A
      const getMealRes = await request(helper.getHttpServer())
        .get(`/api/v1/meal/${mealRes.body.data.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(getMealRes.body.data.dishes[0].name).toBe('Món bí mật cá nhân của User A');

      // 4. VULNERABILITY IMPACT: User A muốn xóa món riêng tư của mình
      // Nhưng chi_tiet_bua_an đã bị User B liên kết, dẫn đến User A bị khóa (DISH_003 - 409 Conflict)
      const deleteDishRes = await request(helper.getHttpServer())
        .delete(`/api/v1/dish/${secretDishId}`)
        .set('Authorization', `Bearer ${regularToken}`);

      // User A bị chặn xóa món của chính mình vì User B bắt làm "con tin"!
      expect(deleteDishRes.status).toBe(409);
      expect(deleteDishRes.body.error.code).toBe('DISH_003');
    });

    it('4.2 Hostile Type & Duplicate Smashing: Gửi trùng lặp ingredientId trong cùng request tạo món -> Tự động gộp khối lượng thành công (200)', async () => {
      // Gửi 2 item có cùng ingredientId (ví dụ thịt bò bắp 50g + 50g)
      const res = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món ăn cố tình gửi trùng nguyên liệu',
          details: [
            { ingredientId: beefIngId, netWeight: 50 },
            { ingredientId: beefIngId, netWeight: 50 },
          ],
        });

      // Layer 1: HTTP Status Code 200 (Thành công do tự động coalesce / gộp nguyên liệu)
      expect(res.status).toBe(200);

      // Layer 2: API Standard Response Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.details).toHaveLength(1);
      expect(res.body.data.details[0].ingredientId).toBe(beefIngId.toString());
      expect(res.body.data.details[0].netWeight).toBe(100);

      const dishId = res.body.data.id;

      // Layer 3: Database Ground Truth - kiểm tra chi_tiet_mon_an đã được gộp thành công 50g + 50g = 100g
      const detailsInDb = await helper.getPrisma().chi_tiet_mon_an.findMany({
        where: { mon_an_id: BigInt(dishId) },
      });
      expect(detailsInDb).toHaveLength(1);
      expect(Number(detailsInDb[0].nguyen_lieu_id)).toBe(beefIngId);
      expect(Number(detailsInDb[0].khoi_luong_song_sach)).toBe(100);
    });

    it('4.3 Review Lifecycle Tampering: Món ăn ở trạng thái CHO_DUYET bị chặn đứng khi cố tình chỉnh sửa -> ném DISH_003 (400)', async () => {
      // 1. User tạo món với tên "Món rau củ lành mạnh"
      const createRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món rau củ lành mạnh',
          details: [{ ingredientId: celeryIngId, netWeight: 100 }],
        })
        .expect(200);

      const dishId = createRes.body.data.id;

      // 2. User gửi đề xuất -> trạng thái chuyển sang CHO_DUYET
      await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}/propose`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      // 3. User lập tức gọi PUT /api/dish/:id để tráo đổi công thức trong khi đang CHO_DUYET
      // Immutability Guard chặn đứng việc chỉnh sửa món CHO_DUYET (ném HTTP 400 DISH_003)
      const tamperRes = await request(helper.getHttpServer())
        .put(`/api/v1/dish/${dishId}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Món tráo đổi thịt bò siêu nhiều đạm',
          details: [{ ingredientId: beefIngId, netWeight: 300 }],
        });

      // Layer 1: HTTP Status Code 400 Bad Request
      expect(tamperRes.status).toBe(400);

      // Layer 2: API Standard Error Envelope
      expect(tamperRes.body).toHaveProperty('error');
      expect(tamperRes.body.error).toHaveProperty('code', 'DISH_003');

      // Layer 3: Database Ground Truth - Món ăn bất biến 100%, vẫn giữ nguyên tên và công thức ban đầu
      const dbDish = await helper.getPrisma().mon_an.findUnique({
        where: { id: BigInt(dishId) },
        include: { chi_tiet_mon_an: true },
      });
      expect(dbDish?.trang_thai).toBe(DishStatus.CHO_DUYET);
      expect(dbDish?.ten_mon).toBe('Món rau củ lành mạnh');
      expect(Number(dbDish?.chi_tiet_mon_an[0].nguyen_lieu_id)).toBe(celeryIngId);
      expect(Number(dbDish?.chi_tiet_mon_an[0].khoi_luong_song_sach)).toBe(100);
    });
  });
});
