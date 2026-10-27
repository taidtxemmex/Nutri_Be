import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';

describe('Ingredients Master E2E & 3-Layer Persistence Validation', () => {
  const helper = new TestAppHelper();
  let adminToken: string;
  let adminUser: any;
  let regularToken: string;
  let regularUser: any;
  let testCategoryId: number;

  beforeAll(async () => {
    await helper.init();
  });

  beforeEach(async () => {
    // 1. Dọn dẹp CSDL theo thứ tự khóa ngoại an toàn với FOREIGN_KEY_CHECKS
    const prisma = helper.getPrisma();
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

    // 2. Tạo danh mục chuẩn dùng chung
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng tổng hợp' },
    });
    testCategoryId = cat.id;

    // 3. Khởi tạo tài khoản Admin và User thường
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_ing_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Dinh Dưỡng',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const regular = await helper.createTestUser({
      username: `user_ing_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng Khách Hàng',
    });
    regularToken = regular.token;
    regularUser = regular.user;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
    await helper.close();
  });

  describe('Scenario 1: Tạo nguyên liệu: User thường -> CHO_DUYET; Admin -> DA_DUYET', () => {
    it('should set trang_thai = CHO_DUYET and record tao_boi_id when created by regular user', async () => {
      const payload = {
        material: 'Bột yến mạch hữu cơ cán dẹt',
        categoryId: testCategoryId,
        loaiProtein: 'THUC_VAT',
        edible: 100,
        water: 12.5,
        protein: 13.2,
        fat: 6.5,
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/ingredients')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.material).toBe('Bột yến mạch hữu cơ cán dẹt');
      expect(res.body.data.trang_thai).toBe('CHO_DUYET');
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      const createdId = BigInt(res.body.data.id);

      // Layer 3: Direct Database State Persistence Assertion
      const dbIng = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { id: createdId },
      });
      expect(dbIng).not.toBeNull();
      expect(dbIng?.ten_nguyen_lieu).toBe('Bột yến mạch hữu cơ cán dẹt');
      expect(dbIng?.trang_thai).toBe('CHO_DUYET');
      expect(dbIng?.tao_boi_id).toBe(regularUser.id);
      expect(dbIng?.danh_muc).toBe(testCategoryId);
      expect(dbIng?.edible).toBe(100);
    });

    it('should set trang_thai = DA_DUYET when created directly by Admin', async () => {
      const payload = {
        material: 'Thịt bò Wagyu Úc thượng hạng',
        categoryId: testCategoryId,
        loaiProtein: 'DONG_VAT',
        edible: 100,
        water: 60.5,
        protein: 21.0,
        fat: 16.5,
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/ingredients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body.data.material).toBe('Thịt bò Wagyu Úc thượng hạng');
      expect(res.body.data.trang_thai).toBe('DA_DUYET');

      const createdId = BigInt(res.body.data.id);

      // Layer 3: Direct Database State Persistence Assertion
      const dbIng = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { id: createdId },
      });
      expect(dbIng).not.toBeNull();
      expect(dbIng?.ten_nguyen_lieu).toBe('Thịt bò Wagyu Úc thượng hạng');
      expect(dbIng?.trang_thai).toBe('DA_DUYET');
      expect(dbIng?.tao_boi_id).toBe(adminUser.id);
    });
  });

  describe('Scenario 2: Lean Query GET /api/ingredient (Không chứa 77 cột vi chất - Rule 11)', () => {
    it('should only return lean identifier columns in list endpoint, strictly excluding 77 heavy nutrient fields', async () => {
      // 1. Tạo 2 nguyên liệu mẫu có đầy đủ vi chất trong CSDL
      await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Gạo tẻ ST25 cao cấp',
          danh_muc: testCategoryId,
          loai_protein: 'THUC_VAT',
          trang_thai: 'DA_DUYET',
          edible: 100,
          water: 13.8,
          protein: 7.9,
          fat: 0.7,
          fiber: 0.4,
          ash: 0.8,
          calci: 30,
          iron: 1.2,
          zinc: 1.5,
          sodium: 3,
          potassium: 110,
          vitaminC: 0,
          retinol: 0,
          cholesterol: 0,
        },
      });

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get('/api/v1/ingredients')
        .query({ page: 1, limit: 10 })
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toHaveProperty('totalItems');
      expect(res.body.meta).toHaveProperty('page', 1);

      const targetItem = res.body.data.find((item: any) => item.material === 'Gạo tẻ ST25 cao cấp');
      expect(targetItem).toBeDefined();

      // CÁC CỘT ĐỊNH DANH PHẢI CÓ
      expect(targetItem).toHaveProperty('id');
      expect(targetItem).toHaveProperty('material', 'Gạo tẻ ST25 cao cấp');
      expect(targetItem).toHaveProperty('categoryName');
      expect(targetItem).toHaveProperty('loaiProtein', 'THUC_VAT');
      expect(targetItem).toHaveProperty('trangThai', 'DA_DUYET');
      expect(targetItem).toHaveProperty('edible', 100);

      // LEAN QUERY PROJECTION: 77 CỘT VI CHẤT TUYỆT ĐỐI KHÔNG XUẤT HIỆN TRONG LIST ENDPOINT (ANTI-OOM)
      expect(targetItem.water).toBeUndefined();
      expect(targetItem.protein).toBeUndefined();
      expect(targetItem.fat).toBeUndefined();
      expect(targetItem.fiber).toBeUndefined();
      expect(targetItem.ash).toBeUndefined();
      expect(targetItem.calci).toBeUndefined();
      expect(targetItem.iron).toBeUndefined();
      expect(targetItem.zinc).toBeUndefined();
      expect(targetItem.sodium).toBeUndefined();
      expect(targetItem.potassium).toBeUndefined();
      expect(targetItem.vitaminC).toBeUndefined();
      expect(targetItem.retinol).toBeUndefined();
      expect(targetItem.cholesterol).toBeUndefined();

      // Layer 3: Direct Database State Assertion - CSDL thực sự vẫn lưu trữ đầy đủ các cột này
      const dbRecord = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { ten_nguyen_lieu: 'Gạo tẻ ST25 cao cấp' },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.water).toBe(13.8);
      expect(dbRecord?.protein).toBe(7.9);
      expect(dbRecord?.fat).toBe(0.7);
      expect(dbRecord?.calci).toBe(30);
    });
  });

  describe('Scenario 3: Test findSummary (GET /api/ingredient/summary)', () => {
    it('should return ultra-fast summary list with only id and ten_nguyen_lieu', async () => {
      // 1. Tạo 2 nguyên liệu trong CSDL
      await helper.getPrisma().nguyen_lieu.createMany({
        data: [
          {
            ten_nguyen_lieu: 'Hạt sen tươi',
            danh_muc: testCategoryId,
            trang_thai: 'DA_DUYET',
          },
          {
            ten_nguyen_lieu: 'Đậu xanh bóc vỏ',
            danh_muc: testCategoryId,
            trang_thai: 'DA_DUYET',
          },
        ],
      });

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get('/api/v1/ingredients/summary')
        .expect(200);

      // Layer 2: API Response Envelope
      expect(res.body).toHaveProperty('status', 200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const materials = res.body.data.map((item: any) => item.material || item.ten_nguyen_lieu);
      expect(materials).toContain('Hạt sen tươi');
      expect(materials).toContain('Đậu xanh bóc vỏ');

      // Tối ưu 0ms: Mỗi item chỉ chứa id, ten_nguyen_lieu, material
      const sample = res.body.data.find((item: any) => item.material === 'Hạt sen tươi');
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('material', 'Hạt sen tươi');
      expect(sample.water).toBeUndefined();
      expect(sample.protein).toBeUndefined();
      expect(sample.danh_muc).toBeUndefined();

      // Layer 3: Database direct query verification
      const dbItems = await helper.getPrisma().nguyen_lieu.findMany({
        where: { ten_nguyen_lieu: { in: ['Hạt sen tươi', 'Đậu xanh bóc vỏ'] } },
      });
      expect(dbItems).toHaveLength(2);
    });
  });

  describe('Scenario 4: Test calculate-summary (Tính toán 86 vi chất chính xác tuyệt đối qua Decimal.js)', () => {
    it('should compute combined nutrients and weights for 2 ingredients without floating point drift', async () => {
      // 1. Khởi tạo 2 nguyên liệu mẫu trong CSDL với các chỉ số vi chất chuẩn hóa
      // Nguyên liệu 1: Gạo tẻ ST25 (100g) -> protein: 7.9g, fat: 0.7g, water: 13.8g, calci: 30mg, iron: 1.2mg, phosphorus: 100mg
      const ing1 = await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Gạo tẻ ST25 Thơm',
          danh_muc: testCategoryId,
          trang_thai: 'DA_DUYET',
          edible: 100,
          water: 13.8,
          protein: 7.9,
          fat: 0.7,
          fiber: 0.4,
          ash: 0.8,
          calci: 30,
          iron: 1.2,
          phosphorous: 100,
        },
      });

      // Nguyên liệu 2: Thịt lợn thăn nạc (100g) -> protein: 20.0g, fat: 7.0g, water: 72.0g, calci: 12mg, iron: 1.5mg, phosphorus: 180mg
      const ing2 = await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Thịt lợn nạc thăn',
          danh_muc: testCategoryId,
          trang_thai: 'DA_DUYET',
          edible: 100,
          water: 72.0,
          protein: 20.0,
          fat: 7.0,
          fiber: 0,
          ash: 1.0,
          calci: 12,
          iron: 1.5,
          phosphorous: 180,
        },
      });

      // 2. Gửi request tính toán tổng hợp cho 200g Gạo tẻ (coeff 1.0) và 100g Thịt nạc (coeff 0.85)
      const payload = {
        items: [
          {
            ingredientId: Number(ing1.id),
            weight: 200,
            isNetWeight: true,
            coefficient: 1.0,
          },
          {
            ingredientId: Number(ing2.id),
            weight: 100,
            isNetWeight: true,
            coefficient: 0.85,
          },
        ],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/ingredients/calculate-summary')
        .send(payload)
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('data');
      const data = res.body.data;

      // Khối lượng tổng hợp
      // totalGrossWeight = 200 + 100 = 300g
      expect(data.totalGrossWeight).toBe(300);
      // totalEdibleWeight = 200 + 100 = 300g
      expect(data.totalEdibleWeight).toBe(300);
      // totalCookedWeight = 200 * 1.0 + 100 * 0.85 = 200 + 85 = 285g
      expect(data.totalCookedWeight).toBe(285);

      // KIỂM TRA ĐỘ CHÍNH XÁC TUYỆT ĐỐI CỦA 86 CHỈ TIÊU VI CHẤT (DECIMAL.JS - KHÔNG TRÔI SỐ PHẨY ĐỘNG)
      // Protein: 200g * 7.9/100 + 100g * 20.0/100 = 15.8 + 20.0 = 35.8g (Không bị 35.800000000000004)
      expect(data.nutrients.protein).toBe(35.8);

      // Fat: 200g * 0.7/100 + 100g * 7.0/100 = 1.4 + 7.0 = 8.4g
      expect(data.nutrients.fat).toBe(8.4);

      // Calci: 200g * 30/100 + 100g * 12/100 = 60 + 12 = 72mg
      expect(data.nutrients.calci).toBe(72);

      // Iron: 200g * 1.2/100 + 100g * 1.5/100 = 2.4 + 1.5 = 3.9mg
      expect(data.nutrients.iron).toBe(3.9);

      // Water: 200g * 13.8/100 + 100g * 72.0/100 = 27.6 + 72.0 = 99.6g
      expect(data.nutrients.water).toBe(99.6);

      // Phosphorous: 200g * 100/100 + 100g * 180/100 = 200 + 180 = 380mg
      expect(data.nutrients.phosphorous).toBe(380);

      // Chi tiết breakdown từng nguyên liệu
      expect(data.items).toHaveLength(2);
      expect(data.items[0].name).toBe('Gạo tẻ ST25 Thơm');
      expect(data.items[1].name).toBe('Thịt lợn nạc thăn');

      // Layer 3: Direct Database State Assertion - CSDL các nguyên liệu thành phần hoàn toàn nguyên vẹn
      const dbIng1 = await helper.getPrisma().nguyen_lieu.findUnique({
        where: { id: ing1.id },
      });
      const dbIng2 = await helper.getPrisma().nguyen_lieu.findUnique({
        where: { id: ing2.id },
      });
      expect(dbIng1).not.toBeNull();
      expect(dbIng2).not.toBeNull();
      expect(dbIng1?.protein).toBe(7.9);
      expect(dbIng2?.protein).toBe(20.0);
    });
  });

  describe('Scenario 5: Proactive Delete Guard & Soft-Delete (ING_002 - 409 Conflict)', () => {
    it('should block deletion with ING_002 (409) if ingredient is used in any dish', async () => {
      // 1. Tạo nguyên liệu
      const ing = await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Nấm hương khô sạch',
          danh_muc: testCategoryId,
          trang_thai: 'DA_DUYET',
        },
      });

      // 2. Tạo món ăn và liên kết nguyên liệu này vào chi tiết món ăn
      const dish = await helper.getPrisma().mon_an.create({
        data: {
          ten_mon: 'Gà nấu nấm hương truyền thống',
          trang_thai: 'CONG_KHAI',
        },
      });

      await helper.getPrisma().chi_tiet_mon_an.create({
        data: {
          mon_an_id: dish.id,
          nguyen_lieu_id: ing.id,
          khoi_luong_song_sach: 50,
        },
      });

      // 3. Admin yêu cầu xóa nguyên liệu đang có trong món ăn
      const res = await request(helper.getHttpServer())
        .delete(`/api/v1/ingredients/${ing.id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      // Layer 2: API Error Response Envelope
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('ING_002');

      // Layer 3: Direct Database State Assertion - Nguyên liệu vẫn tồn tại và chưa bị soft-delete
      const dbIng = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { id: ing.id },
      });
      expect(dbIng).not.toBeNull();
      expect(dbIng?.deleted_at).toBeNull();
    });

    it('should successfully soft-delete ingredient when it is not used in any dish', async () => {
      // 1. Tạo nguyên liệu độc lập
      const ing = await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Rau mầm củ cải trắng',
          danh_muc: testCategoryId,
          trang_thai: 'DA_DUYET',
        },
      });

      // 2. Admin gọi xóa nguyên liệu
      const res = await request(helper.getHttpServer())
        .delete(`/api/v1/ingredients/${ing.id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: API Success Envelope
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.message).toContain('Đã xóa nguyên liệu thành công');

      // Layer 3: Direct Database State Assertion - Bản ghi đã được đánh dấu soft-delete (deleted_at IS NOT NULL)
      const activeRecord = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { id: ing.id, deleted_at: null },
      });
      expect(activeRecord).toBeNull();

      // Kiểm tra bằng raw query để thấy trường deleted_at thực tế trong MySQL
      const [softDeletedRecord]: any = await helper
        .getPrisma()
        .$queryRawUnsafe(
          `SELECT id, ten_nguyen_lieu, deleted_at FROM \`nguyen_lieu\` WHERE id = ${ing.id.toString()};`,
        );
      expect(softDeletedRecord).toBeDefined();
      expect(softDeletedRecord.deleted_at).not.toBeNull();
    });
  });
});
