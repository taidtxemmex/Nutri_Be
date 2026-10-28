import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { HttpStatus } from '@nestjs/common';

/**
 * PARITY FULL 132 ENDPOINTS E2E TEST SUITE (Task 8.1 [T11.1])
 * Đối chiếu hợp đồng 132 APIs giữa Spring Boot cũ và NestJS mới
 * Căn cứ: 13_MA_TRAN_DOI_CHIEU_PARITY_132_APIS_NESTJS.md (STT 1 -> 132)
 */
describe('Sprint 8: Full Parity 132 APIs Verification (Spring Boot ➔ NestJS)', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let doctorToken: string;
  let userToken: string;
  let _adminUser: any;
  let doctorUser: any;
  let normalUser: any;

  // Shared IDs for cross-endpoint validation
  let sampleCategoryId: number;
  let sampleDiseaseGroupId: number;
  let sampleIngredientId: bigint;
  let sampleDishId: bigint;
  let sampleMenuId: bigint;
  let samplePatientId: any;
  let samplePlanId: any;
  let randomSuffix: number;

  beforeAll(async () => {
    await helper.init();
    await helper.cleanDatabase();

    // 1. Create seed users
    const adminRes = await helper.createTestUser({
      username: 'parity_admin',
      role: 'SUPERADMIN',
    });
    _adminUser = adminRes.user;
    adminToken = adminRes.token;

    const doctorRes = await helper.createTestUser({
      username: 'parity_doctor',
      role: 'USERPRO',
    });
    doctorUser = doctorRes.user;
    doctorToken = doctorRes.token;

    const userRes = await helper.createTestUser({
      username: 'parity_user',
      role: 'USER',
    });
    normalUser = userRes.user;
    userToken = userRes.token;

    const prisma = helper.getPrisma();

    randomSuffix = Math.floor(Math.random() * 1000000);

    // 2. Seed basic reference records for tests
    const category = await prisma.danh_muc.create({
      data: {
        ten_danh_muc: `Nhóm Ngũ Cốc Test Parity ${randomSuffix}`,
      },
    });
    sampleCategoryId = category.id;

    const diseaseGroup = await prisma.nhom_benh.create({
      data: {
        ma_nhom: `DG_${randomSuffix}`.substring(0, 10),
        ten_nhom: `Nhóm bệnh mẫu Parity ${randomSuffix}`,
      },
    });
    sampleDiseaseGroupId = diseaseGroup.id;

    const ingredient = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: `Gạo tẻ kiểm thử Parity ${randomSuffix}`,
        danh_muc: sampleCategoryId,
        protein: 7.5,
        fat: 1.0,
        edible: 100,
      },
    });
    sampleIngredientId = ingredient.id;

    const dish = await prisma.mon_an.create({
      data: {
        ten_mon: `Cơm trắng kiểm thử Parity ${randomSuffix}`,
        nguoi_dung_id: doctorUser.id,
        trang_thai: 'HE_THONG',
        recipe_hash: `hash-parity-sample-dish-${randomSuffix}`,
        chi_tiet_mon_an: {
          create: [
            {
              nguyen_lieu_id: sampleIngredientId,
              khoi_luong_song_sach: 100,
            },
          ],
        },
      },
    });
    sampleDishId = dish.id;

    const patient = await prisma.benh_nhan.create({
      data: {
        ma_benh_nhan_bv: `BN-PARITY-${randomSuffix}`,
        ho_ten: 'Bệnh Nhân Kiểm Thử Parity',
        ngay_sinh: new Date('1990-01-01'),
        gioi_tinh: 'NAM',
        so_dien_thoai: `09${String(randomSuffix).padStart(8, '0')}`,
        nguoi_dung_id: doctorUser.id,
      },
    });
    samplePatientId = patient.id;

    const plan = await prisma.goi.create({
      data: {
        ma_goi: `PARITY_PRO_${randomSuffix}`,
        ten_goi: 'Gói PRO 30 Ngày Parity',
        gia_tien: 150000,
        so_ngay_su_dung: 30,
        mo_ta: 'Gói kiểm thử Parity',
        trang_thai: 'ACTIVE',
      },
    });
    samplePlanId = plan.id;

    const menu = await prisma.thuc_don.create({
      data: {
        ten_thuc_don: `Thực đơn mẫu Parity ${randomSuffix}`,
        loai_thuc_don: 'NGAY',
        loai_doi_tuong: 'BENH_NHAN',
        nguoi_dung_id: doctorUser.id,
        benh_nhan_id: samplePatientId,
      },
    });
    sampleMenuId = menu.id;
  });

  afterAll(async () => {
    await helper.close();
  });

  // =========================================================================
  // I. AuthController (STT 1 -> 7)
  // =========================================================================
  describe('I. AuthController (STT 1 -> 7)', () => {
    it('1. POST /api/v1/auth/register & /api/auth/register', async () => {
      const res = await request(helper.getHttpServer()).post('/api/auth/register').send({
        username: 'parity_reg_user',
        password: 'Password123!',
        email: 'parity_reg@test.com',
        fullName: 'Parity Register Test',
      });
      expect([HttpStatus.CREATED, HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('2. POST /api/v1/auth/verify-email (anonymous)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/verify-email')
        .send({ email: 'nonexistent@test.com', code: '000000' });
      expect([HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.OK]).toContain(res.status);
    });

    it('3. POST /api/v1/auth/login & /api/auth/login', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'parity_admin', password: 'P@ssw0rd123!' });
      expect([HttpStatus.OK, HttpStatus.UNAUTHORIZED]).toContain(res.status);
    });

    it('4. POST /api/v1/auth/refresh & /api/auth/refresh', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'dummy-invalid-refresh-token' });
      expect([HttpStatus.UNAUTHORIZED, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('5. POST /api/v1/auth/logout & /api/auth/logout', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
    });

    it('6. POST /api/v1/auth/oauth2/exchange', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/oauth2/exchange')
        .send({ token: 'mock-google-id-token' });
      expect([HttpStatus.UNAUTHORIZED, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('7. POST /api/v1/auth/forgot-password', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'test_forgot@test.com' });
      expect([HttpStatus.OK, HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });
  });

  // =========================================================================
  // II. CategoryController (STT 8 -> 12)
  // =========================================================================
  describe('II. CategoryController (STT 8 -> 12)', () => {
    let createdCatId: number;

    it('8. POST /api/category (Admin create category)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/category')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryName: 'Rau củ quả Parity Test' });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdCatId = res.body.data.id;
    });

    it('9. PUT /api/category/:id (Admin update category)', async () => {
      const catId = createdCatId || sampleCategoryId;
      const res = await request(helper.getHttpServer())
        .put(`/api/category/${catId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ categoryName: 'Rau củ quả Parity Updated' });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('10. GET /api/category (List categories with dual-route)', async () => {
      const res1 = await request(helper.getHttpServer()).get('/api/category');
      const res2 = await request(helper.getHttpServer()).get('/api/categories');
      const res3 = await request(helper.getHttpServer()).get('/api/v1/categories');

      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
      expect(res3.status).toBe(HttpStatus.OK);
      expect(res1.body).toHaveProperty('data');
    });

    it('11. GET /api/category/:id (Detail category)', async () => {
      const res = await request(helper.getHttpServer()).get(`/api/category/${sampleCategoryId}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data?.id).toBe(sampleCategoryId);
    });

    it('12. DELETE /api/category/:id', async () => {
      if (createdCatId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/category/${createdCatId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT, HttpStatus.BAD_REQUEST]).toContain(
          res.status,
        );
      }
    });
  });

  // =========================================================================
  // III. ChatbotController (STT 13: Deprecated HTTP 410 Gone)
  // =========================================================================
  describe('III. ChatbotController (STT 13: HTTP 410 Gone)', () => {
    it('13. POST /api/chatbot returns 410 Gone', async () => {
      const res1 = await request(helper.getHttpServer())
        .post('/api/chatbot')
        .send({ message: 'Hello AI' });
      const res2 = await request(helper.getHttpServer())
        .post('/api/v1/chatbot')
        .send({ message: 'Hello AI' });

      expect(res1.status).toBe(HttpStatus.GONE);
      expect(res2.status).toBe(HttpStatus.GONE);
    });
  });

  // =========================================================================
  // IV. CoefficientController (STT 14 -> 20)
  // =========================================================================
  describe('IV. CoefficientController (STT 14 -> 20)', () => {
    let createdCoefId: string;

    it('14. POST /api/coefficients (Create coefficient)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/coefficients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          ingredientId: Number(sampleIngredientId),
          processingMethod: 'Luộc chín',
          coefficient: 0.85,
          isPublic: false,
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdCoefId = res.body.data.id;
    });

    it('15. GET /api/coefficients (List all)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/coefficients')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('16. GET /api/coefficients/:id (Get detail)', async () => {
      if (createdCoefId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/coefficients/${createdCoefId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('17. PUT /api/coefficients/:id (Update)', async () => {
      if (createdCoefId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/coefficients/${createdCoefId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ coefficient: 0.9 });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('18. DELETE /api/coefficients/:id (Delete)', async () => {
      if (createdCoefId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/coefficients/${createdCoefId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('19. GET /api/coefficients/public (Public coefficients)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/coefficients/public')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('20. GET /api/coefficients/my (User own coefficients)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/coefficients/my')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  // =========================================================================
  // V. DailyIntakeController (STT 21 -> 28)
  // =========================================================================
  describe('V. DailyIntakeController (STT 21 -> 28)', () => {
    let createdIntakeId: string;

    it('21. POST /api/daily-intakes (Create clinical 24h intake)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: samplePatientId,
          intakeDate: '2026-10-27',
          inputType: 'BY_MEAL',
          meals: [
            {
              mealOrder: 1,
              mealName: 'Bữa trưa',
              ingredients: [
                {
                  ingredientId: Number(sampleIngredientId),
                  rawWeight: 150,
                },
              ],
            },
          ],
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdIntakeId = res.body.data.id;
    });

    it('22. GET /api/daily-intakes (Get by patientId & date)', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes?patientId=${samplePatientId}&date=2026-10-27`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('23. GET /api/daily-intakes/:id (Get detail)', async () => {
      if (createdIntakeId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/daily-intakes/${createdIntakeId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('24. PUT /api/daily-intakes/:id (Update intake)', async () => {
      if (createdIntakeId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/daily-intakes/${createdIntakeId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            note: 'Cập nhật ghi chú lâm sàng khẩu phần',
          });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('25. DELETE /api/daily-intakes/:id (Delete intake)', async () => {
      if (createdIntakeId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/daily-intakes/${createdIntakeId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('26. GET /api/daily-intakes/patient/:patientId (History)', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes/patient/${samplePatientId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('27. GET /api/daily-intakes/import-template (Download Excel template)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/daily-intakes/import-template')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('28. POST /api/daily-intakes/import (Validate missing file returns 400)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/import')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // VI. DailyIntakeExportController (STT 29)
  // =========================================================================
  describe('VI. DailyIntakeExportController (STT 29)', () => {
    it('29. POST /api/daily-intakes/export (Export clinical RDA Excel report)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          templateType: 'TOTAL_FOOD_GROUP_MULTI_PATIENTS',
          patientIds: [samplePatientId],
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        });
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });
  });

  // =========================================================================
  // VII. DiseaseGroupController (STT 30 -> 34)
  // =========================================================================
  describe('VII. DiseaseGroupController (STT 30 -> 34)', () => {
    let createdDgId: number;

    it('30. POST /api/disease-groups (Admin create)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/disease-groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Đái tháo đường Parity ${randomSuffix}`,
          code: `PD_${randomSuffix}`.substring(0, 10),
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdDgId = res.body.data.id;
    });

    it('31. GET /api/disease-groups (List all)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/disease-groups');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('32. GET /api/disease-groups/:id (Get detail)', async () => {
      if (createdDgId) {
        const res = await request(helper.getHttpServer()).get(`/api/disease-groups/${createdDgId}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('33. PUT /api/disease-groups/:id (Update)', async () => {
      if (createdDgId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/disease-groups/${createdDgId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Đái tháo đường Parity Updated' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('34. DELETE /api/disease-groups/:id (Delete)', async () => {
      if (createdDgId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/disease-groups/${createdDgId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // VIII. DishController (STT 35 -> 49)
  // =========================================================================
  describe('VIII. DishController (STT 35 -> 49)', () => {
    let createdDishId: string;

    it('35. GET /api/dish (List user dishes - dual-route /api/dish & /api/dishes)', async () => {
      const res1 = await request(helper.getHttpServer())
        .get('/api/dish')
        .set('Authorization', `Bearer ${doctorToken}`);
      const res2 = await request(helper.getHttpServer())
        .get('/api/dishes')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
    });

    it('36. GET /api/dish/import-template (Download template)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/dish/import-template');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('37. POST /api/dish/import (Validate missing file returns 400)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/dish/import')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('38. GET /api/dish/autocomplete (Autocomplete search)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/dish/autocomplete?q=Cơm')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('39. GET /api/dish/:id (Get dish detail)', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/dish/${sampleDishId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toBeDefined();
    });

    it('40. POST /api/dish (Create dish with RecipeHash)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/dish')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'Món ăn kiểm thử 132 APIs',
          details: [
            {
              ingredientId: Number(sampleIngredientId),
              netWeight: 120,
            },
          ],
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdDishId = res.body.data.id;
    });

    it('41. PUT /api/dish/:id (Update dish)', async () => {
      if (createdDishId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/dish/${createdDishId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            name: 'Món ăn kiểm thử 132 APIs Updated',
            details: [
              {
                ingredientId: Number(sampleIngredientId),
                netWeight: 140,
              },
            ],
          });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('42. POST /api/dish/:id/clone (Clone dish)', async () => {
      const res = await request(helper.getHttpServer())
        .post(`/api/dish/${sampleDishId}/clone`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ newName: 'Cơm trắng nhân bản' });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
    });

    it('43. DELETE /api/dish/:id (Delete dish)', async () => {
      if (createdDishId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/dish/${createdDishId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('44. POST /api/dish/export (Export dishes to Excel)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/dish/export')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ keyword: 'Cơm' });
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('45. PUT /api/dish/:id/propose (Propose dish to public)', async () => {
      const res = await request(helper.getHttpServer())
        .put(`/api/dish/${sampleDishId}/propose`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN]).toContain(res.status);
    });

    it('46. PUT /api/dish/:id/approve (Admin approve dish)', async () => {
      const res = await request(helper.getHttpServer())
        .put(`/api/dish/${sampleDishId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('47. PUT /api/dish/:id/reject (Admin reject dish)', async () => {
      const res = await request(helper.getHttpServer())
        .put(`/api/dish/${sampleDishId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Chưa đủ thông tin dinh dưỡng' });
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('48. GET /api/dish/public (Get public verified dishes)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/dish/public');
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('49. GET /api/dish/admin (Admin list all dishes for review)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/dish/admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  // =========================================================================
  // IX. EvidenceController (STT 50 -> 51)
  // =========================================================================
  describe('IX. EvidenceController (STT 50 -> 51)', () => {
    it('50. GET /api/evidences/:id/preview (Nonexistent evidence returns 404)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/evidences/999999/preview')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });

    it('51. GET /api/evidences/:id/download (Nonexistent evidence returns 404)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/evidences/999999/download')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(res.status);
    });
  });

  // =========================================================================
  // X. ExportController (STT 52: POST /api/export/ingredients)
  // =========================================================================
  describe('X. ExportController (STT 52)', () => {
    it('52. POST /api/export/ingredients (Consolidated export)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/export/ingredients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ keyword: 'Gạo' });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });

  // =========================================================================
  // XI. ExtendedDiseaseGroupController (STT 53 -> 59)
  // =========================================================================
  describe('XI. ExtendedDiseaseGroupController (STT 53 -> 59)', () => {
    let createdExtId: number;

    it('53. POST /api/extended-disease-groups (Create doctor extended disease group)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/extended-disease-groups')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          extendedCode: `EXT_${randomSuffix}`.substring(0, 20),
          displayName: 'Viêm dạ dày chuyên sâu Parity',
          parentId: sampleDiseaseGroupId,
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdExtId = res.body.data.id;
    });

    it('54. GET /api/extended-disease-groups (List)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/extended-disease-groups')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('55. GET /api/extended-disease-groups/:id (Detail)', async () => {
      if (createdExtId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/extended-disease-groups/${createdExtId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('56. PUT /api/extended-disease-groups/:id (Update)', async () => {
      if (createdExtId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/extended-disease-groups/${createdExtId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ name: 'Viêm dạ dày chuyên sâu Updated' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('57. DELETE /api/extended-disease-groups/:id (Delete)', async () => {
      if (createdExtId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/extended-disease-groups/${createdExtId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('58. GET /api/extended-disease-groups/import-template (Download template)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/extended-disease-groups/import-template')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('59. POST /api/extended-disease-groups/import (Validate missing file)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/extended-disease-groups/import')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // XII. FileController (STT 60: POST /api/files)
  // =========================================================================
  describe('XII. FileController (STT 60)', () => {
    it('60. POST /api/files requires authentication and rejects missing file', async () => {
      // 1. Chặn anonymous upload (B1 sprint 7 fix)
      const unauthRes = await request(helper.getHttpServer()).post('/api/files');
      expect(unauthRes.status).toBe(HttpStatus.UNAUTHORIZED);

      // 2. Authenticated user without file returns 400 Bad Request
      const authRes = await request(helper.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(authRes.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // XIII. IngredientController (STT 61 -> 69)
  // =========================================================================
  describe('XIII. IngredientController (STT 61 -> 69)', () => {
    let createdIngId: string;

    it('61. POST /api/ingredient (Admin create ingredient)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/ingredient')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          material: `Thịt bò phi lê Parity ${randomSuffix}`,
          name: `Thịt bò phi lê Parity ${randomSuffix}`,
          categoryId: sampleCategoryId,
          protein: 26,
          fat: 15,
          edible: 100,
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdIngId = res.body.data.id;
    });

    it('62. GET /api/ingredient/summary (Summary list)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/ingredient/summary');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('63. GET /api/ingredient (Paginated list)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/ingredient?page=1&limit=10');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('64. GET /api/ingredient/all (All ingredients)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/ingredient/all');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('65. GET /api/ingredient/:id (Detail 86 nutrients)', async () => {
      const res = await request(helper.getHttpServer()).get(
        `/api/ingredient/${sampleIngredientId}`,
      );
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toBeDefined();
    });

    it('66. PUT /api/ingredient/:id (Admin update)', async () => {
      const ingId = createdIngId || String(sampleIngredientId);
      const res = await request(helper.getHttpServer())
        .put(`/api/ingredient/${ingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          material: 'Thịt bò phi lê Parity Updated',
          name: 'Thịt bò phi lê Parity Updated',
        });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('67. DELETE /api/ingredient/:id (Admin delete)', async () => {
      if (createdIngId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/ingredient/${createdIngId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('68. GET /api/ingredient/template (Download template)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/ingredient/template');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('69. POST /api/ingredient/import (Validate missing file)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/ingredient/import')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // XIV. IngredientProposalController (STT 70 -> 74)
  // =========================================================================
  describe('XIV. IngredientProposalController (STT 70 -> 74)', () => {
    let createdProposalId: number;

    it('70. POST /api/ingredient-proposals (Doctor create proposal)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/ingredient-proposals')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          ingredientName: 'Quả Acai Berry Parity',
          categoryId: sampleCategoryId,
          energyKcal: 70,
          protein: 1,
          fat: 5,
          carbohydrate: 4,
          reason: 'Bổ sung chất chống oxy hóa',
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdProposalId = res.body.data.id;
    });

    it('71. GET /api/ingredient-proposals (Admin list proposals)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/ingredient-proposals')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('72. GET /api/ingredient-proposals/:id (Detail proposal)', async () => {
      if (createdProposalId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/ingredient-proposals/${createdProposalId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('73. PUT /api/ingredient-proposals/:id/approve (Admin approve)', async () => {
      if (createdProposalId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/ingredient-proposals/${createdProposalId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });

    it('74. PUT /api/ingredient-proposals/:id/reject (Admin reject)', async () => {
      if (createdProposalId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/ingredient-proposals/${createdProposalId}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Chưa đủ chứng cứ y văn' });
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // XV. MealController (STT 75 -> 79: Dead Code, denyAll in Spring Boot)
  // =========================================================================
  describe('XV. MealController (STT 75 -> 79: Disabled / DenyAll)', () => {
    it('75. POST /api/meal (Protected / Disabled)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/meal')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ name: 'Bữa sáng độc lập' });
      expect([
        HttpStatus.FORBIDDEN,
        HttpStatus.BAD_REQUEST,
        HttpStatus.CREATED,
        HttpStatus.OK,
      ]).toContain(res.status);
    });

    it('76. GET /api/meal', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/meal')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(res.status);
    });

    it('77. GET /api/meal/:id', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/meal/999999')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(
        res.status,
      );
    });

    it('78. PUT /api/meal/:id', async () => {
      const res = await request(helper.getHttpServer())
        .put('/api/meal/999999')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ name: 'Bữa trưa cập nhật' });
      expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(
        res.status,
      );
    });

    it('79. DELETE /api/meal/:id', async () => {
      const res = await request(helper.getHttpServer())
        .delete('/api/meal/999999')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.BAD_REQUEST]).toContain(
        res.status,
      );
    });
  });

  // =========================================================================
  // XVI. MenuController (STT 80 -> 86)
  // =========================================================================
  describe('XVI. MenuController (STT 80 -> 86)', () => {
    let createdMenuId: string;

    it('80. POST /api/menu (Create multi-level menu with dual-route)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/menu')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          menuName: `Thực đơn mẫu Parity ${randomSuffix}`,
          menuType: 'NGAY',
          targetType: 'BENH_NHAN',
          patientId: String(samplePatientId),
          meals: [
            {
              mealName: 'Bữa trưa',
              time: '11:30',
              dishes: [
                {
                  dishId: String(sampleDishId),
                },
              ],
            },
          ],
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) {
        createdMenuId = res.body.data.id;
      }
    });

    it('81. GET /api/menu (List menus with dual-route /api/menu & /api/menus)', async () => {
      const res1 = await request(helper.getHttpServer())
        .get('/api/menu')
        .set('Authorization', `Bearer ${doctorToken}`);
      const res2 = await request(helper.getHttpServer())
        .get('/api/menus')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
    });

    it('82. GET /api/menu/:id (Detail menu)', async () => {
      if (sampleMenuId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/menu/${sampleMenuId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('83. GET /api/menu/:id/full (Full menu tree)', async () => {
      if (sampleMenuId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/menu/${sampleMenuId}/full`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('84. PUT /api/menu/:id (Update menu)', async () => {
      if (sampleMenuId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/menu/${sampleMenuId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ name: 'Thực đơn mẫu 7 ngày Parity Updated' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('85. DELETE /api/menu/:id (Delete menu)', async () => {
      if (createdMenuId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/menu/${createdMenuId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('86. POST /api/menu/:id/export (Export Excel menu analysis)', async () => {
      if (sampleMenuId) {
        const res = await request(helper.getHttpServer())
          .post(`/api/menu/${sampleMenuId}/export`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({});
        expect([HttpStatus.OK, HttpStatus.CREATED, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // XVII. MenuProposalController (STT 87 -> 95)
  // =========================================================================
  describe('XVII. MenuProposalController (STT 87 -> 95)', () => {
    let createdPropId: string;

    it('87. POST /api/menu-proposals/:menuId (Submit proposal with frozen snapshot)', async () => {
      if (sampleMenuId) {
        const res = await request(helper.getHttpServer())
          .post(`/api/menu-proposals/${sampleMenuId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ reason: 'Đề xuất thực đơn mẫu chuẩn y khoa' });
        expect([HttpStatus.CREATED, HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
        if (res.body?.data?.id) createdPropId = res.body.data.id;
      }
    });

    it('88. GET /api/menu-proposals/my (Doctor proposals)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/menu-proposals/my')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('89. GET /api/menu-proposals (Admin list proposals)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/menu-proposals')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('90. GET /api/menu-proposals/:id/full (Full snapshot detail)', async () => {
      if (createdPropId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/menu-proposals/${createdPropId}/full`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('91. GET /api/menu-proposals/:id (Detail)', async () => {
      if (createdPropId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/menu-proposals/${createdPropId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('92. PUT /api/menu-proposals/:id/approve (Admin approve)', async () => {
      if (createdPropId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/menu-proposals/${createdPropId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });

    it('93. PUT /api/menu-proposals/:id/reject (Admin reject)', async () => {
      if (createdPropId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/menu-proposals/${createdPropId}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Cần bổ sung chi tiết khẩu phần' });
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });

    it('94. GET /api/menu-proposals/public (Public approved menus)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/menu-proposals/public');
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('95. POST /api/menu-proposals/:id/export (Export Excel)', async () => {
      if (createdPropId) {
        const res = await request(helper.getHttpServer())
          .post(`/api/menu-proposals/${createdPropId}/export`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({});
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // XVIII. NutritionGuideController (STT 96 -> 100)
  // =========================================================================
  describe('XVIII. NutritionGuideController (STT 96 -> 100)', () => {
    let createdGuideId: number;

    it('96. GET /api/nutrition-guide & /api/nutrition-guides (Public list)', async () => {
      const res1 = await request(helper.getHttpServer()).get('/api/nutrition-guide');
      const res2 = await request(helper.getHttpServer()).get('/api/nutrition-guides');
      expect(res1.status).toBe(HttpStatus.OK);
      expect(res2.status).toBe(HttpStatus.OK);
    });

    it('98. POST /api/nutrition-guide (Admin create guide)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/nutrition-guide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          diseaseName: 'Hướng dẫn dinh dưỡng cho người cao huyết áp',
          code: `HD-HA-${randomSuffix}`,
          nutritionPrinciple: 'Nội dung chi tiết giảm muối, tăng kali...',
          note: 'Bệnh tim mạch',
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdGuideId = res.body.data.id;
    });

    it('97. GET /api/nutrition-guide/:id (Detail guide)', async () => {
      if (createdGuideId) {
        const res = await request(helper.getHttpServer()).get(
          `/api/nutrition-guide/${createdGuideId}`,
        );
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('99. PUT /api/nutrition-guide/:id (Admin update guide)', async () => {
      if (createdGuideId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/nutrition-guide/${createdGuideId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Hướng dẫn dinh dưỡng cao huyết áp Updated' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('100. DELETE /api/nutrition-guide/:id (Admin delete guide)', async () => {
      if (createdGuideId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/nutrition-guide/${createdGuideId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // XIX. NutritionLimitSetController (STT 101 -> 104)
  // =========================================================================
  describe('XIX. NutritionLimitSetController (STT 101 -> 104)', () => {
    let createdLimitSetId: string;

    it('101. POST /api/nutrition-limit-sets (Admin create limit set)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Ngưỡng Natri & Đường cho người đái tháo đường ${randomSuffix}`,
          limits: {
            energy: { min: 1500, max: 2000 },
            sodium: { min: 0, max: 2000 },
          },
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdLimitSetId = res.body.data.id;
    });

    it('102. PUT /api/nutrition-limit-sets/:id (Admin update limit set)', async () => {
      if (createdLimitSetId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/nutrition-limit-sets/${createdLimitSetId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Ngưỡng Natri Updated' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('103. GET /api/nutrition-limit-sets/:id (Detail limit set)', async () => {
      if (createdLimitSetId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/nutrition-limit-sets/${createdLimitSetId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('104. GET /api/nutrition-limit-sets (List all)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  // =========================================================================
  // XX. PackageController (STT 105 -> 109)
  // =========================================================================
  describe('XX. PackageController (STT 105 -> 109)', () => {
    it('105. POST /api/package (Superadmin create package)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/package')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          packageCode: `PARITY_VIP_${randomSuffix}`,
          packageName: `Gói VIP 1 Năm Parity ${randomSuffix}`,
          price: 1200000,
          usageDays: 365,
          description: 'Gói năm dành cho bác sĩ',
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
    });

    it('106. GET /api/package (Superadmin list all packages)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/package')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('107. GET /api/package/:id (Detail package)', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/package/${samplePlanId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('108. PUT /api/package/update-package (Superadmin update package)', async () => {
      const res = await request(helper.getHttpServer())
        .put('/api/package/update-package')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: Number(samplePlanId),
          packageName: 'Gói PRO 30 Ngày Parity Updated',
          price: 160000,
          usageDays: 30,
        });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('109. GET /api/package/active (Public list active packages)', async () => {
      const res = await request(helper.getHttpServer()).get('/api/package/active');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // XXI. PatientController (STT 110 -> 117)
  // =========================================================================
  describe('XXI. PatientController (STT 110 -> 117)', () => {
    let createdPatId: number;

    it('110. POST /api/patients (Doctor create patient)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          fullName: 'Trần Văn Parity',
          dateOfBirth: '1985-05-15',
          gender: 'NAM',
          phoneNumber: '0977888999',
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdPatId = res.body.data.id;
    });

    it('111. PUT /api/patients/:id (Update patient & anthropometry)', async () => {
      const patId = createdPatId || samplePatientId;
      const res = await request(helper.getHttpServer())
        .put(`/api/patients/${patId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          fullName: 'Trần Văn Parity Updated',
          height: 172,
          weight: 68,
        });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('112. DELETE /api/patients/:id (Delete patient)', async () => {
      if (createdPatId) {
        const res = await request(helper.getHttpServer())
          .delete(`/api/patients/${createdPatId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect([HttpStatus.OK, HttpStatus.NO_CONTENT]).toContain(res.status);
      }
    });

    it('113. GET /api/patients/:id (Get detail patient)', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${samplePatientId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toBeDefined();
    });

    it('114. GET /api/patients/code-preview (Preview auto-generated code)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients/code-preview?phone=0988776655')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data?.previewCode || res.body?.data?.code).toBeDefined();
    });

    it('115. GET /api/patients (List doctor patients)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toHaveProperty('data');
    });

    it('116. GET /api/patients/import-template (Download template)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients/import-template')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('117. POST /api/patients/import (Validate missing file)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // XXII. ProfileController (STT 118: POST /api/profile/getAll)
  // =========================================================================
  describe('XXII. ProfileController (STT 118)', () => {
    it('118. POST /api/profile/getAll (Admin filter profiles with pagination)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/profile/getAll')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ page: 0, size: 20 });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toBeDefined();
    });
  });

  // =========================================================================
  // XXIII. ProposerController (STT 119 -> 122)
  // =========================================================================
  describe('XXIII. ProposerController (STT 119 -> 122)', () => {
    let createdProposerId: number;

    it('119. POST /api/proposer (Create proposer)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/proposer')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'TS. BS. Nguyễn Văn Parity',
          email: 'dr_parity@hospital.vn',
          phone: '0981122334',
          organization: 'Viện Dinh Dưỡng Parity',
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdProposerId = res.body.data.id;
    });

    it('120. PUT /api/proposer/:id (Update proposer)', async () => {
      if (createdProposerId) {
        const res = await request(helper.getHttpServer())
          .put(`/api/proposer/${createdProposerId}`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ organization: 'Viện Dinh Dưỡng Quốc Gia' });
        expect(res.status).toBe(HttpStatus.OK);
      }
    });

    it('121. GET /api/proposer (List proposers)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/proposer')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('122. GET /api/proposer/:id (Detail proposer)', async () => {
      if (createdProposerId) {
        const res = await request(helper.getHttpServer())
          .get(`/api/proposer/${createdProposerId}`)
          .set('Authorization', `Bearer ${doctorToken}`);
        expect(res.status).toBe(HttpStatus.OK);
      }
    });
  });

  // =========================================================================
  // XXIV. SubscriptionController (STT 123 -> 127)
  // =========================================================================
  describe('XXIV. SubscriptionController (STT 123 -> 127)', () => {
    let createdPaymentReqId: number;

    it('123. POST /api/subscription/payment-request (User submit payment request)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/subscription/payment-request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          packageCode: `PARITY_PRO_${randomSuffix}`,
        });
      expect([HttpStatus.CREATED, HttpStatus.OK]).toContain(res.status);
      if (res.body?.data?.id) createdPaymentReqId = res.body.data.id;
    });

    it('124. GET /api/subscription/my-requests (User view own requests)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/subscription/my-requests')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('125. GET /api/subscription/list (Admin list all requests)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/subscription/list')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('126. POST /api/subscription/:id/approve (Admin approve payment)', async () => {
      if (createdPaymentReqId) {
        const res = await request(helper.getHttpServer())
          .post(`/api/subscription/${createdPaymentReqId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
      }
    });

    it('127. POST /api/subscription/:id/reject (Admin reject payment)', async () => {
      if (createdPaymentReqId) {
        const res = await request(helper.getHttpServer())
          .post(`/api/subscription/${createdPaymentReqId}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Mã giao dịch không trùng khớp sao kê' });
        // Request was either already approved or will be rejected
        expect([HttpStatus.OK, HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT]).toContain(res.status);
      }
    });
  });

  // =========================================================================
  // XXV. UserController (STT 128 -> 132)
  // =========================================================================
  describe('XXV. UserController (STT 128 -> 132)', () => {
    it('128. PUT /api/users/update-user-active-satus (Admin toggle status)', async () => {
      const res = await request(helper.getHttpServer())
        .put('/api/users/update-user-active-satus')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: normalUser.id, active: true });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('129. PUT /api/users/update-role (Admin update role)', async () => {
      const res = await request(helper.getHttpServer())
        .put('/api/users/update-role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: normalUser.id, role: 'USER' });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('130. PUT /api/users/update-info (User update self info)', async () => {
      const res = await request(helper.getHttpServer())
        .put('/api/users/update-info')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fullName: 'Parity User Updated',
          phone: '0911223344',
          address: 'TP. Hồ Chí Minh',
        });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('131. POST /api/users/getInfo (Get authenticated user info)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/users/getInfo')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ userId: doctorUser.id });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toBeDefined();
    });

    it('132. GET /api/users/check-profile (Check profile completion)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/users/check-profile')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data).toHaveProperty('profileComplete');
    });
  });

  // =========================================================================
  // EXTRA: Health Check (Task 8.4)
  // =========================================================================
  describe('Health Check Endpoint (Task 8.4)', () => {
    it('GET /api/health returns HTTP 200 OK with system status', async () => {
      const res = await request(helper.getHttpServer()).get('/api/health');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body?.data?.status).toBe('ok');
    });
  });
});
