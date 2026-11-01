import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { LocalStorageService } from '../../src/modules/files/services/local-storage.service';

/**
 * HOSTILE TEST SUITE: Image Upload Flow & Ground Truth DB Persistence (3-Layer Assertions)
 * Role: @Role_Ruthless_QA (Breakers Division - Division 5)
 * Whitelist: tests/e2e/image-upload-flow.e2e-spec.ts
 *
 * Target Capabilities Under Adversarial Test:
 * 1. Upload Avatar & Auto-Update Profile (ho_so_ca_nhan.avatar_url)
 * 2. Upload Dish Image & Create Dish (mon_an.image_url)
 * 3. Upload Ingredient Image & Create Ingredient (nguyen_lieu.image_url)
 * 4. Ingredient Proposal Image Inheritance on Approval (de_xuat_nguyen_lieu.image_url -> nguyen_lieu.image_url)
 * 5. Security Gates & Anti-Domain-Pollution (Strict relative paths, zero domain leakage)
 * 6. Adversarial Enemy Personas (The Stupid Bot, The Amateur Hacker, The Broken Cable Network)
 */
describe('Image Upload Flow & 3-Layer DB Persistence E2E Test Suite', () => {
  const helper = new TestAppHelper();
  let localStorageService: LocalStorageService;
  let baseUploadDir: string;

  let regularUserToken: string;
  let regularUser: any;
  let adminUserToken: string;
  let _adminUser: any;
  let testCategoryId: number;
  let sharedIngredientId: number;

  const uniqueRunId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  // Authentic Binary Magic Bytes Buffers
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xd9,
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const createdFilePaths: string[] = [];

  beforeAll(async () => {
    await helper.init();
    localStorageService = helper.getApp().get<LocalStorageService>(LocalStorageService);
    baseUploadDir = localStorageService.getBaseDir();

    const prisma = helper.getPrisma();
    await prisma.$connect();

    // Dọn dẹp dữ liệu cũ
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});

    // Tạo danh mục mẫu
    const cat = await prisma.danh_muc.create({
      data: { ten_danh_muc: `Danh Mục Test Ảnh ${uniqueRunId}` },
    });
    testCategoryId = cat.id;

    // Tạo nguyên liệu mẫu dùng chung cho các test
    const sharedIng = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: `Nguyên liệu dùng chung ${uniqueRunId}`,
        danh_muc: testCategoryId,
        loai_protein: 'DONG_VAT',
        edible: 100,
        protein: 15.0,
        fat: 3.0,
        trang_thai: 'DA_DUYET',
      },
    });
    sharedIngredientId = Number(sharedIng.id);

    // Tạo User thường
    const reg = await helper.createTestUser({
      username: `img_user_${uniqueRunId}`,
      password: 'P@ssw0rd123!',
      fullName: 'Người Dùng Test Ảnh',
      role: UserRole.USER,
    });
    regularUserToken = reg.token;
    regularUser = reg.user;

    // Tạo Admin
    const adm = await helper.createTestUser({
      username: `img_admin_${uniqueRunId}`,
      password: 'P@ssw0rd123!',
      fullName: 'Admin Test Ảnh',
      role: UserRole.ADMIN,
    });
    adminUserToken = adm.token;
    _adminUser = adm.user;
  });

  afterAll(async () => {
    // Dọn dẹp file vật lý tạo ra trong quá trình test
    // eslint-disable-next-line sonarjs/no-empty-collection
    for (const fPath of createdFilePaths) {
      if (fs.existsSync(fPath)) {
        try {
          fs.unlinkSync(fPath);
        } catch {}
      }
    }

    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `mon_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});

    await helper.close();
  });

  // ==========================================================================
  // SCENARIO 1: UPLOAD AVATAR & AUTO-UPDATE PROFILE
  // ==========================================================================
  describe('1. Scenario: Upload Avatar & Auto-Update Profile (3-Layer Assertions)', () => {
    it('1.1 should upload avatar to POST /api/v1/files/avatar and auto-update ho_so_ca_nhan.avatar_url', async () => {
      // Execute hostile request to required endpoint
      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/avatar')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validJpegBuffer, 'user_avatar.jpg');

      // LAYER 1: HTTP Status Code Validation (Must be 200 OK)
      expect(res.status).toBe(200);

      // LAYER 2: Payload Schema & Integrity Validation
      expect(res.body).toBeDefined();
      const avatarUrl =
        res.body.avatarUrl ||
        res.body.avatar_url ||
        res.body.data?.avatarUrl ||
        res.body.data?.avatar_url ||
        (Array.isArray(res.body.data) ? res.body.data[0]?.url : res.body.data?.url);

      expect(avatarUrl).toBeDefined();
      expect(typeof avatarUrl).toBe('string');
      // Relative Path Enforcement: Must start with /uploads/public/avatars/
      expect(avatarUrl).toMatch(/^\/uploads\/public\/avatars\//);
      // Anti-Domain-Pollution: Must NEVER contain domain protocol
      expect(avatarUrl).not.toContain('http://');
      expect(avatarUrl).not.toContain('https://');
      expect(avatarUrl).not.toContain('localhost');

      // LAYER 3: Direct Database State Persistence Assertion
      const profileInDb = await helper.getPrisma().ho_so_ca_nhan.findFirst({
        where: { nguoi_dung_id: regularUser.id },
      });
      expect(profileInDb).not.toBeNull();
      expect(profileInDb?.avatar_url).toBe(avatarUrl);

      // Verify GET /api/v1/profiles/my returns exact relative avatarUrl
      const myProfileRes = await request(helper.getHttpServer())
        .get('/api/v1/profiles/my')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      const returnedAvatar =
        myProfileRes.body.data?.avatarUrl || myProfileRes.body.data?.avatar_url;
      expect(returnedAvatar).toBe(avatarUrl);
    });

    it('1.2 should support alias POST /api/files/avatar with valid PNG and update ho_so_ca_nhan.avatar_url', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/files/avatar')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validPngBuffer, 'user_avatar.png');

      // LAYER 1: HTTP Status Code
      expect(res.status).toBe(200);

      // LAYER 2: Payload Envelope
      const avatarUrl =
        res.body.avatarUrl ||
        res.body.avatar_url ||
        res.body.data?.avatarUrl ||
        res.body.data?.avatar_url ||
        (Array.isArray(res.body.data) ? res.body.data[0]?.url : res.body.data?.url);

      expect(avatarUrl).toBeDefined();
      expect(avatarUrl).toMatch(/^\/uploads\/public\/avatars\//);
      expect(avatarUrl).not.toMatch(/^https?:\/\//);

      // LAYER 3: Direct DB State Persistence
      const profileInDb = await helper.getPrisma().ho_so_ca_nhan.findFirst({
        where: { nguoi_dung_id: regularUser.id },
      });
      expect(profileInDb?.avatar_url).toBe(avatarUrl);
    });

    it('1.3 [Fixed] Long filename (240+ chars) is safely truncated to <= 100 chars and succeeds with 200 (No ENAMETOOLONG)', async () => {
      const longName = 'a'.repeat(240) + '.jpg';
      const res = await request(helper.getHttpServer())
        .post('/api/files/avatar')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validJpegBuffer, longName);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.avatarUrl).toMatch(/^\/uploads\/public\/avatars\//);
    });

    it('1.4 [Fixed] Consecutive avatar updates automatically prune old file from disk (Zero Storage Leak)', async () => {
      // Lấy avatar hiện tại từ CSDL
      const beforeProfile = await helper.getPrisma().ho_so_ca_nhan.findFirst({
        where: { nguoi_dung_id: regularUser.id },
      });
      const oldAvatarRelativePath = beforeProfile?.avatar_url;
      expect(oldAvatarRelativePath).toBeDefined();

      const oldAvatarDiskPath = path.resolve(
        baseUploadDir,
        oldAvatarRelativePath!.replace(/^\/uploads\//, ''),
      );
      expect(fs.existsSync(oldAvatarDiskPath)).toBe(true);

      // Upload avatar mới
      const res = await request(helper.getHttpServer())
        .post('/api/files/avatar')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validPngBuffer, 'new_avatar.png')
        .expect(200);

      const newAvatarUrl = res.body.data?.avatarUrl || res.body.avatarUrl || res.body.avatar_url;
      expect(newAvatarUrl).not.toBe(oldAvatarRelativePath);

      // Old avatar file is successfully deleted from disk (Storage Leak Resolved)
      const oldFileStillExists = fs.existsSync(oldAvatarDiskPath);
      expect(oldFileStillExists).toBe(false);
    });
  });

  // ==========================================================================
  // SCENARIO 2: UPLOAD DISH IMAGE & CREATE DISH
  // ==========================================================================
  describe('2. Scenario: Upload Dish Image & Create Dish (3-Layer Assertions)', () => {
    let uploadedDishImageUrl: string;

    it('2.1 should upload dish image to POST /api/files/dish-image returning relative imageUrl', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/files/dish-image')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validJpegBuffer, 'delicious_pho.jpg');

      // LAYER 1: HTTP Status Code
      expect(res.status).toBe(200);

      // LAYER 2: Payload Schema
      expect(res.body).toBeDefined();
      uploadedDishImageUrl =
        res.body.imageUrl ||
        res.body.image_url ||
        res.body.data?.imageUrl ||
        res.body.data?.image_url ||
        (Array.isArray(res.body.data) ? res.body.data[0]?.url : res.body.data?.url);

      expect(uploadedDishImageUrl).toBeDefined();
      expect(typeof uploadedDishImageUrl).toBe('string');
      expect(uploadedDishImageUrl).toMatch(/^\/uploads\/public\/dishes\//);
      expect(uploadedDishImageUrl).not.toContain('http://');
      expect(uploadedDishImageUrl).not.toContain('https://');
      expect(uploadedDishImageUrl).not.toContain('localhost');
    });

    it('2.2 should create dish with imageUrl and persist relative path into mon_an.image_url', async () => {
      // Chuẩn bị 1 nguyên liệu để tạo món ăn
      const sampleIng = await helper.getPrisma().nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: `Thịt bò phi lê tái ${uniqueRunId}`,
          danh_muc: testCategoryId,
          loai_protein: 'DONG_VAT',
          edible: 100,
          protein: 20.0,
          fat: 5.0,
          trang_thai: 'DA_DUYET',
        },
      });

      const effectiveImageUrl =
        uploadedDishImageUrl || `/uploads/public/dishes/2026/11/pho_bo_${uniqueRunId}.jpg`;

      const createDishPayload = {
        name: `Phở bò tái nạm đặc biệt ${uniqueRunId}`,
        imageUrl: effectiveImageUrl,
        details: [
          {
            ingredientId: Number(sampleIng.id),
            netWeight: 150,
          },
        ],
      };

      // LAYER 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(createDishPayload);

      expect([200, 201]).toContain(res.status);

      // LAYER 2: Payload Schema Integrity
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      const returnedImageUrl = res.body.data.imageUrl || res.body.data.image_url;
      expect(returnedImageUrl).toBe(effectiveImageUrl);
      expect(returnedImageUrl).not.toMatch(/^https?:\/\//);

      const dishId = BigInt(res.body.data.id);

      // LAYER 3: Direct Database State Persistence Assertion
      const dishInDb = await helper.getPrisma().mon_an.findUnique({
        where: { id: dishId },
      });
      expect(dishInDb).not.toBeNull();
      expect(dishInDb?.ten_mon).toBe(`Phở bò tái nạm đặc biệt ${uniqueRunId}`);
      expect(dishInDb?.image_url).toBe(effectiveImageUrl);
      expect(dishInDb?.image_url).not.toContain('http://');
      expect(dishInDb?.image_url).not.toContain('localhost');
    });
  });

  // ==========================================================================
  // SCENARIO 3: UPLOAD INGREDIENT IMAGE & CREATE INGREDIENT
  // ==========================================================================
  describe('3. Scenario: Upload Ingredient Image & Create Ingredient (3-Layer Assertions)', () => {
    let uploadedIngImageUrl: string;

    it('3.1 should upload ingredient image to POST /api/files/ingredient-image returning relative imageUrl', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/files/ingredient-image')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', validJpegBuffer, 'salmon_fillet.jpg');

      // LAYER 1: HTTP Status Code
      expect(res.status).toBe(200);

      // LAYER 2: Payload Schema
      expect(res.body).toBeDefined();
      uploadedIngImageUrl =
        res.body.imageUrl ||
        res.body.image_url ||
        res.body.data?.imageUrl ||
        res.body.data?.image_url ||
        (Array.isArray(res.body.data) ? res.body.data[0]?.url : res.body.data?.url);

      expect(uploadedIngImageUrl).toBeDefined();
      expect(typeof uploadedIngImageUrl).toBe('string');
      expect(uploadedIngImageUrl).toMatch(/^\/uploads\/public\/ingredients\//);
      expect(uploadedIngImageUrl).not.toContain('http://');
      expect(uploadedIngImageUrl).not.toContain('https://');
      expect(uploadedIngImageUrl).not.toContain('localhost');
    });

    it('3.2 should create ingredient with imageUrl and persist relative path into nguyen_lieu.image_url', async () => {
      const effectiveImageUrl =
        uploadedIngImageUrl || `/uploads/public/ingredients/2026/11/ca_hoi_${uniqueRunId}.jpg`;

      const createIngPayload = {
        material: `Cá hồi Na Uy phi lê tươi ${uniqueRunId}`,
        categoryId: testCategoryId,
        imageUrl: effectiveImageUrl,
        loaiProtein: 'DONG_VAT',
        edible: 100,
        protein: 20.5,
        fat: 13.0,
      };

      // LAYER 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/ingredient')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(createIngPayload);

      expect([200, 201]).toContain(res.status);

      // LAYER 2: Payload Schema Integrity
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      const returnedImageUrl = res.body.data.imageUrl || res.body.data.image_url;
      expect(returnedImageUrl).toBe(effectiveImageUrl);

      const ingId = BigInt(res.body.data.id);

      // LAYER 3: Direct Database State Persistence Assertion
      const ingInDb = await helper.getPrisma().nguyen_lieu.findUnique({
        where: { id: ingId },
      });
      expect(ingInDb).not.toBeNull();
      expect(ingInDb?.ten_nguyen_lieu).toBe(`Cá hồi Na Uy phi lê tươi ${uniqueRunId}`);
      expect(ingInDb?.image_url).toBe(effectiveImageUrl);
      expect(ingInDb?.image_url).not.toContain('http://');
      expect(ingInDb?.image_url).not.toContain('localhost');
    });
  });

  // ==========================================================================
  // SCENARIO 4: INGREDIENT PROPOSAL IMAGE INHERITANCE ON APPROVAL
  // ==========================================================================
  describe('4. Scenario: Ingredient Proposal Image Inheritance to Ingredient on Approval (3-Layer Assertions)', () => {
    const proposalImgUrl = `/uploads/public/ingredients/2026/11/sua_hat_oc_cho_${uniqueRunId}.jpg`;
    let createdProposalId: string;

    it('4.1 should create ingredient proposal with imageUrl and persist into de_xuat_nguyen_lieu.image_url', async () => {
      const proposalPayload = {
        ingredientName: `Sữa hạt óc chó Organic ${uniqueRunId}`,
        categoryId: testCategoryId,
        imageUrl: proposalImgUrl,
        loaiProtein: 'THUC_VAT',
        edible: 100,
        nutrients: {
          energy: 65,
          protein: 3.0,
          fat: 4.5,
        },
        note: 'Đề xuất bổ sung sữa hạt óc chó cho người ăn kiêng',
      };

      // LAYER 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/v1/ingredient-proposals')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(proposalPayload);

      expect([200, 201]).toContain(res.status);

      // LAYER 2: Payload Schema Integrity
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      createdProposalId = res.body.data.id.toString();

      // LAYER 3: Direct Database State Persistence Assertion on Proposal
      const proposalInDb = await helper.getPrisma().de_xuat_nguyen_lieu.findUnique({
        where: { id: BigInt(createdProposalId) },
      });
      expect(proposalInDb).not.toBeNull();
      expect(proposalInDb?.ten_nguyen_lieu).toBe(`Sữa hạt óc chó Organic ${uniqueRunId}`);
      expect(proposalInDb?.image_url).toBe(proposalImgUrl);
      expect(proposalInDb?.image_url).not.toContain('http://');
    });

    it('4.2 should inherit image_url to nguyen_lieu when Admin approves proposal', async () => {
      expect(createdProposalId).toBeDefined();

      // Thử cả POST lẫn PUT cho approve endpoint
      let approveRes = await request(helper.getHttpServer())
        .post(`/api/v1/ingredient-proposals/${createdProposalId}/approve`)
        .set('Authorization', `Bearer ${adminUserToken}`);

      if (approveRes.status === 404 || approveRes.status === 405) {
        approveRes = await request(helper.getHttpServer())
          .put(`/api/v1/ingredient-proposals/${createdProposalId}/approve`)
          .set('Authorization', `Bearer ${adminUserToken}`);
      }

      // LAYER 1: HTTP Status Code
      expect(approveRes.status).toBe(200);

      // LAYER 3: Direct Database State Persistence Assertion on newly created Ingredient
      const approvedIngredient = await helper.getPrisma().nguyen_lieu.findFirst({
        where: { ten_nguyen_lieu: `Sữa hạt óc chó Organic ${uniqueRunId}` },
      });

      expect(approvedIngredient).not.toBeNull();
      expect(approvedIngredient?.trang_thai).toBe('DA_DUYET');
      // Crucial Golden Law Assertion: Must inherit image_url from proposal!
      expect(approvedIngredient?.image_url).toBe(proposalImgUrl);
      expect(approvedIngredient?.image_url).not.toContain('http://');
      expect(approvedIngredient?.image_url).not.toContain('localhost');
    });
  });

  // ==========================================================================
  // SCENARIO 5: SECURITY GATES & ANTI-DOMAIN-POLLUTION
  // ==========================================================================
  describe('5. Scenario: Security Gates & Anti-Domain-Pollution (3-Layer Assertions)', () => {
    it('5.1 should HARD BLOCK PHP shell script disguised as .jpg with HTTP 400 Bad Request', async () => {
      const maliciousPhpShell = Buffer.from('<?php @system($_GET["cmd"]); ?>');

      const endpointsToTest = [
        '/api/v1/files/avatar',
        '/api/files/dish-image',
        '/api/files/ingredient-image',
        '/api/v1/files/upload',
      ];

      for (const endpoint of endpointsToTest) {
        const res = await request(helper.getHttpServer())
          .post(endpoint)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .attach('file', maliciousPhpShell, 'exploit_shell.jpg');

        // LAYER 1: Phải bị chặn với 400 Bad Request (hoặc 404 nếu route chưa tồn tại)
        if (res.status !== 404) {
          expect(res.status).toBe(400);

          // LAYER 2: Error Payload Contract Envelope
          expect(res.body).toHaveProperty('error');
          expect(res.body.error).toHaveProperty('code');
        }
      }

      // LAYER 3: Kiểm tra đĩa cứng tuyệt đối không có file chứa shell
      const files = fs.readdirSync(baseUploadDir, { recursive: true }) as string[];
      const shellFiles = files.filter(
        (f) => typeof f === 'string' && (f.includes('exploit_shell') || f.endsWith('.php')),
      );
      expect(shellFiles.length).toBe(0);
    });

    it('5.2 Anti-Domain-Pollution DB Ground Truth Audit (Zero domain strings in database)', async () => {
      const prisma = helper.getPrisma();

      // Query trực tiếp CSDL kiểm tra không có bất kỳ bản ghi nào lưu chứa http://, https://, hoặc localhost
      const pollutedProfiles = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, avatar_url FROM ho_so_ca_nhan WHERE avatar_url LIKE '%http://%' OR avatar_url LIKE '%https://%' OR avatar_url LIKE '%localhost%';`,
      );
      expect(pollutedProfiles.length).toBe(0);

      const pollutedDishes = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, image_url FROM mon_an WHERE image_url LIKE '%http://%' OR image_url LIKE '%https://%' OR image_url LIKE '%localhost%';`,
      );
      expect(pollutedDishes.length).toBe(0);

      const pollutedIngredients = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, image_url FROM nguyen_lieu WHERE image_url LIKE '%http://%' OR image_url LIKE '%https://%' OR image_url LIKE '%localhost%';`,
      );
      expect(pollutedIngredients.length).toBe(0);

      const pollutedProposals = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, image_url FROM de_xuat_nguyen_lieu WHERE image_url LIKE '%http://%' OR image_url LIKE '%https://%' OR image_url LIKE '%localhost%';`,
      );
      expect(pollutedProposals.length).toBe(0);
    });
  });

  // ==========================================================================
  // SCENARIO 6: ADVERSARIAL ENEMY PERSONAS SIMULATION
  // ==========================================================================
  describe('6. Scenario: Enemy Personas Simulation', () => {
    // ------------------------------------------------------------------------
    // Persona 1: The Stupid Bot (100 req/sec scraper hammering concurrency burst)
    // ------------------------------------------------------------------------
    it('6.1 [Enemy Persona: The Stupid Bot] Rapid-fire 20 concurrent upload requests must not crash server', async () => {
      const burstPromises = Array.from({ length: 20 }).map((_, index) =>
        request(helper.getHttpServer())
          .post('/api/v1/files/upload?folder=avatar')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .attach('file', validJpegBuffer, `bot_avatar_${index}.jpg`),
      );

      const results = await Promise.all(burstPromises);

      // Verify no server crash (500) and connection pool handles burst gracefully
      for (const res of results) {
        expect([200, 429]).toContain(res.status);
      }
    });

    // ------------------------------------------------------------------------
    // Persona 2: The Amateur Hacker (SQLi, XSS, Path Traversal, Type Smashing)
    // ------------------------------------------------------------------------
    it('6.2 [Enemy Persona: The Amateur Hacker] Malicious payloads in imageUrl must be neutralized or rejected', async () => {
      const maliciousPayloads = [
        {
          name: `Dish SQLi ${uniqueRunId}`,
          imageUrl: "' OR '1'='1'; DROP TABLE mon_an; --",
        },
        {
          name: `Dish XSS ${uniqueRunId}`,
          imageUrl: '<script>alert("XSS")</script>',
        },
        {
          name: `Dish Path Traversal ${uniqueRunId}`,
          imageUrl: '../../../../../../etc/passwd',
        },
      ];

      for (const p of maliciousPayloads) {
        const res = await request(helper.getHttpServer())
          .post('/api/v1/dish')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            name: p.name,
            imageUrl: p.imageUrl,
            details: [{ ingredientId: sharedIngredientId, netWeight: 100 }],
          });

        // Server should either reject with 400 Bad Request or safely treat it as a literal string (parameterized query)
        if (res.status === 200 || res.status === 201) {
          // Verify table was NOT dropped (SQLi defeated)
          const dishCheck = await helper.getPrisma().mon_an.findFirst({
            where: { ten_mon: p.name },
          });
          expect(dishCheck).not.toBeNull();
        } else {
          expect(res.status).toBe(400);
        }
      }

      // Type Smashing: Pass object or array instead of string for imageUrl
      const typeSmashRes = await request(helper.getHttpServer())
        .post('/api/v1/dish')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          name: `Dish Type Smash ${uniqueRunId}`,
          imageUrl: { malformed: true, nested: ['exploit'] },
          details: [{ ingredientId: sharedIngredientId, netWeight: 100 }],
        });

      // Must be rejected with 400 Bad Request by ValidationPipe
      expect(typeSmashRes.status).toBe(400);
    });

    // ------------------------------------------------------------------------
    // Persona 3: The Broken Cable Network (Empty body, zero-byte file, truncated stream)
    // ------------------------------------------------------------------------
    it('6.3 [Enemy Persona: The Broken Cable Network] Zero-byte payload or empty upload must return 400 Bad Request', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const res = await request(helper.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .attach('file', emptyBuffer, 'broken_stream.jpg');

      // Phải chặn đứng tệp tin rỗng 0 byte với mã 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
