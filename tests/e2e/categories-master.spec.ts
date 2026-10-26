import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { CacheService } from '../../src/core/cache/cache.service';
import { CACHE_TAG_CATEGORIES } from '../../src/config/constants/cache.constants';

describe('Categories Master E2E & 3-Layer Persistence Validation', () => {
  const helper = new TestAppHelper();
  let adminToken: string;
  let adminUserId: string;
  let cacheService: CacheService;

  beforeAll(async () => {
    await helper.init();
    cacheService = helper.getApp().get<CacheService>(CacheService);
  });

  beforeEach(async () => {
    // 1. Dọn dẹp theo thứ tự khóa ngoại từ bảng con tới bảng cha
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('DELETE FROM `he_so_song_chin`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nhom_benh_mo_rong`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nhom_benh`;').catch(() => {});
    await helper.cleanDatabase();

    // 2. Dọn dẹp In-memory cache
    if (cacheService) {
      await cacheService.invalidateTags([CACHE_TAG_CATEGORIES]);
    }

    // 3. Khởi tạo tài khoản Admin với unique username
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const admin = await helper.createTestUser({
      username: `admin_cat_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Category QA',
    });
    adminToken = admin.token;
    adminUserId = admin.user.id;
  });

  afterAll(async () => {
    await helper.getPrisma().$disconnect();
    await helper.close();
  });

  describe('Scenario 1: Tạo mới danh mục thực phẩm -> Layer 3 Verify CSDL danh_muc', () => {
    it('should create new category successfully and persist accurately into database', async () => {
      const payload = {
        categoryName: 'Ngũ cốc & Các loại hạt dinh dưỡng',
        tenDanhMuc: 'Ngũ cốc & Các loại hạt dinh dưỡng',
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);

      // Layer 2: API Response Payload Envelope Validation
      expect(res.body).toHaveProperty('status', 200);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(typeof res.body.data.id).toBe('number');
      expect(res.body.data.categoryName).toBe('Ngũ cốc & Các loại hạt dinh dưỡng');
      expect(res.body.data.tenDanhMuc).toBe('Ngũ cốc & Các loại hạt dinh dưỡng');
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      const createdCategoryId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion
      const dbCategory = await helper.getPrisma().danh_muc.findUnique({
        where: { id: createdCategoryId },
      });
      expect(dbCategory).not.toBeNull();
      expect(dbCategory?.id).toBe(createdCategoryId);
      expect(dbCategory?.ten_danh_muc).toBe('Ngũ cốc & Các loại hạt dinh dưỡng');
    });

    it('should reject duplicate category name with CAT_001 and preserve database count', async () => {
      // 1. Tạo trước danh mục gốc trong DB
      await helper.getPrisma().danh_muc.create({
        data: { ten_danh_muc: 'Rau củ quả tươi' },
      });

      // 2. Thử tạo lại với cùng tên
      const res = await request(helper.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryName: '  Rau củ quả tươi  ',
          tenDanhMuc: '  Rau củ quả tươi  ',
        })
        .expect(400);

      // Layer 2: Error envelope
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CAT_001');

      // Layer 3: CSDL chỉ có đúng 1 bản ghi duy nhất
      const count = await helper.getPrisma().danh_muc.count({
        where: { ten_danh_muc: 'Rau củ quả tươi' },
      });
      expect(count).toBe(1);
    });
  });

  describe('Scenario 2: Cache GET /api/category/public-lookup & Invalidation tức thì', () => {
    it('should populate cache on first call, hit cache on second call, and invalidate immediately upon mutation', async () => {
      // 1. Khởi tạo 2 danh mục mẫu trong CSDL
      await helper.getPrisma().danh_muc.createMany({
        data: [{ ten_danh_muc: 'Rau lá xanh' }, { ten_danh_muc: 'Trái cây nhiệt đới' }],
      });

      const lookupCacheKey = 'cache:categories:lookup';

      // Đảm bảo cache ban đầu trống
      const initialCache = await cacheService.get(lookupCacheKey);
      expect(initialCache).toBeNull();

      // 2. Gọi lần 1: Nạp cache từ CSDL
      const res1 = await request(helper.getHttpServer())
        .get('/api/v1/category/public-lookup')
        .expect(200);

      expect(res1.body.data).toHaveLength(2);
      const names1 = res1.body.data.map((c: any) => c.categoryName);
      expect(names1).toContain('Rau lá xanh');
      expect(names1).toContain('Trái cây nhiệt đới');

      // Layer 3 (Cache Assertion): Dữ liệu đã được nạp thành công vào CacheService
      const cachedData = await cacheService.get<any[]>(lookupCacheKey);
      expect(cachedData).not.toBeNull();
      expect(cachedData?.length).toBe(2);

      // 3. Chứng minh cache hit ở lần gọi thứ 2:
      // Can thiệp trực tiếp vào database tạo 1 danh mục mới mà không qua API/CacheService
      await helper.getPrisma().danh_muc.create({
        data: { ten_danh_muc: 'Danh mục chui trực tiếp DB' },
      });

      // Gọi lần 2: Phải nhận dữ liệu từ Cache (KHÔNG có 'Danh mục chui trực tiếp DB')
      const res2 = await request(helper.getHttpServer())
        .get('/api/v1/category/public-lookup')
        .expect(200);

      const names2 = res2.body.data.map((c: any) => c.categoryName);
      expect(names2).not.toContain('Danh mục chui trực tiếp DB');
      expect(names2).toHaveLength(2);

      // 4. Gọi API tạo danh mục mới qua chuẩn hệ thống -> Kích hoạt Invalidation
      const resCreate = await request(helper.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryName: 'Sữa và các chế phẩm từ sữa',
          tenDanhMuc: 'Sữa và các chế phẩm từ sữa',
        })
        .expect(200);

      expect(resCreate.body.data.categoryName).toBe('Sữa và các chế phẩm từ sữa');

      // Layer 3 (Cache Invalidation Verification): Flush debounce timer (Rule 25) và kiểm tra cache bị xóa sạch
      await cacheService.flushPendingTagsToDb();
      const cacheAfterInvalidate = await cacheService.get(lookupCacheKey);
      expect(cacheAfterInvalidate).toBeNull();

      // 5. Gọi lại public-lookup: Nạp lại dữ liệu tươi mới từ DB, bao gồm cả danh mục mới và danh mục chui
      const res3 = await request(helper.getHttpServer())
        .get('/api/v1/category/public-lookup')
        .expect(200);

      const names3 = res3.body.data.map((c: any) => c.categoryName);
      expect(names3).toContain('Sữa và các chế phẩm từ sữa');
      expect(names3).toContain('Danh mục chui trực tiếp DB');
      expect(names3).toHaveLength(4);
    });
  });

  describe('Scenario 3: Xóa danh mục có nguyên liệu -> Chặn lỗi CAT_002 (409 Conflict)', () => {
    it('should block deletion with CAT_002 (409) if category is referenced by ingredients', async () => {
      // 1. Tạo danh mục trong CSDL
      const cat = await helper.getPrisma().danh_muc.create({
        data: { ten_danh_muc: 'Thịt gia súc gia cầm' },
      });

      // 2. Tạo nguyên liệu liên kết đến danh mục này
      await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Thịt bò thăn nạc',
          danh_muc: cat.id,
          trang_thai: 'DA_DUYET',
        },
      });

      // 3. Gọi DELETE /api/v1/categories/:id
      const res = await request(helper.getHttpServer())
        .delete(`/api/v1/categories/${cat.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      // Layer 2: API Error Response Envelope Assertion
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CAT_002');

      // Layer 3: Direct Database State Assertion - Bản ghi CSDL vẫn nguyên vẹn
      const dbCatStillExists = await helper.getPrisma().danh_muc.findUnique({
        where: { id: cat.id },
      });
      expect(dbCatStillExists).not.toBeNull();
      expect(dbCatStillExists?.id).toBe(cat.id);
      expect(dbCatStillExists?.ten_danh_muc).toBe('Thịt gia súc gia cầm');
    });

    it('should allow deletion when category has no ingredients and verify Layer 3 DB removal', async () => {
      // 1. Tạo danh mục độc lập
      const cat = await helper.getPrisma().danh_muc.create({
        data: { ten_danh_muc: 'Gia vị thảo mộc khô' },
      });

      // 2. Gọi DELETE /api/v1/categories/:id
      const res = await request(helper.getHttpServer())
        .delete(`/api/v1/categories/${cat.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: Success envelope
      expect(res.body.data).toHaveProperty('success', true);

      // Layer 3: Direct Database State Assertion - Bản ghi đã bị xóa hoàn toàn khỏi CSDL
      const dbCat = await helper.getPrisma().danh_muc.findUnique({
        where: { id: cat.id },
      });
      expect(dbCat).toBeNull();
    });
  });
});
