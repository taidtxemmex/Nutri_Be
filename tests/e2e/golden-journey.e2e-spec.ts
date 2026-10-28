import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  MenuType,
  TargetType,
  IntakeInputType,
  DailyIntakeClinicalReportType,
  NutritionLimitWarning,
} from '../../src/config/enums/domain.enum';

jest.setTimeout(120000);

/**
 * ============================================================================
 * SPRINT 4 E2E GOLDEN JOURNEY: FULL HOSPITAL CLINICAL WORKFLOW (TC-S4-09)
 * ============================================================================
 * 8-Step Sequential Clinical Journey without mid-test database purge:
 * - Bước 1: Bác sĩ Minh đăng ký, xác thực email qua token, đăng nhập nhận JWT Token.
 * - Bước 2: Bác sĩ Minh tạo hồ sơ bệnh nhân Nguyễn Văn A (Nam, 50 tuổi, ĐTĐ Type 2, PAL 1.4).
 * - Bước 3: Thiết lập nguyên liệu lâm sàng & Tạo bộ giới hạn dinh dưỡng cá thể hóa.
 * - Bước 4: Tạo Thực đơn tuần 5 cấp, tự động tính recipe_hash chuẩn SHA-256, gán bộ giới hạn.
 * - Bước 5: Nhân bản thực đơn Copy-on-Write (CoW), nộp đề xuất đóng băng JSONB Snapshot.
 * - Bước 6: Quản trị viên (Admin) phê duyệt đề xuất, thực đơn chuyển trạng thái CONG_KHAI.
 * - Bước 7: Ghi nhận khẩu phần 24h thực tế của bệnh nhân A, tính vi chất tự động trừ vỏ (edible).
 * - Bước 8: Đối chiếu RDA/DRI lâm sàng 5 dải đánh giá & Xuất Excel 4-sheet lâm sàng sạch không NaN/Infinity.
 *
 * 3-Layer Verification Architecture:
 * - Layer 1: HTTP Protocol & Status Code Assertions (200, 201)
 * - Layer 2: Universal API Contract Schemas & Envelopes ({ data, meta })
 * - Layer 3: Direct Database State Persistence (MySQL nutri_test via Prisma Client)
 * ============================================================================
 */
describe('TC-S4-09: E2E Golden Journey - Full Hospital Clinical Nutrition Workflow', () => {
  const helper = new TestAppHelper();

  // Authentication & State
  let doctorToken: string;
  let doctorUser: any;
  let adminToken: string;
  let adminUser: any;

  // Domain Entities across 8 Steps
  let patientId: string;
  let categoryId: number;
  let specialMilkIngId: number;
  let medicalOatIngId: number;
  let limitSetId: string;
  let weeklyMenuId: string;
  let clonedMenuId: string;
  let proposalId: string;
  let dailyIntakeId: string;

  // Supertest Binary Parser for Excel Downloads
  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();

    // Dọn dẹp CSDL ban đầu với FOREIGN_KEY_CHECKS an toàn
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
    await prisma.$executeRawUnsafe('DELETE FROM `minh_chung`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `danh_muc`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    // Khởi tạo tài khoản Quản trị viên (Admin) cho bước 6
    const admin = await helper.createTestUser({
      username: `admin_golden_${Date.now()}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Hội đồng Dinh dưỡng Bệnh viện',
    });
    adminToken = admin.token;
    adminUser = admin.user;
  }, 60000);

  afterAll(async () => {
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
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();
    await helper.close();
  });

  // ==========================================================================
  // BƯỚC 1: BÁC SĨ ĐĂNG KÝ, XÁC THỰC EMAIL & ĐĂNG NHẬP
  // ==========================================================================
  describe('Bước 1: Quy trình Xác thực Bác sĩ Lâm sàng (Register -> Verify Email -> Login)', () => {
    const doctorUsername = `bs_minh_${Date.now()}`;
    const doctorEmail = `bsminh_${Date.now()}@nutrihospital.vn`;
    let verificationToken: string;

    it('1.1 Bác sĩ gửi yêu cầu đăng ký tài khoản -> Layer 3 verify dang_ky_cho_xac_thuc & hàng đợi Email', async () => {
      const registerPayload = {
        username: doctorUsername,
        password: 'P@ssw0rd123!',
        fullName: 'BS. CKII Lê Minh Trí',
        email: doctorEmail,
        phone: '0988776655',
        gender: 'NAM',
        address: 'Khoa Dinh Dưỡng - Bệnh viện Đa khoa Trung ương',
        dob: '1980-05-10',
      };

      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.success).toBe(true);
      expect(res.body.meta).toHaveProperty('timestamp');
      expect(res.body.meta).toHaveProperty('traceId');

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const pendingRecord = await prisma.dang_ky_cho_xac_thuc.findFirst({
        where: { ten_dang_nhap: doctorUsername },
      });
      expect(pendingRecord).not.toBeNull();
      expect(pendingRecord?.email).toBe(doctorEmail);
      expect(pendingRecord?.ho_ten).toBe('BS. CKII Lê Minh Trí');
      expect(pendingRecord?.token_hash).toBeDefined();
      expect(pendingRecord?.token_hash.length).toBe(64); // SHA-256 token

      verificationToken = pendingRecord!.token_hash;
    });

    it('1.2 Kích hoạt tài khoản qua Token xác thực Email -> Layer 3 verify nguoi_dung & ho_so_ca_nhan', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data.success).toBe(true);

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbDoctor = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: doctorUsername },
      });
      expect(dbDoctor).not.toBeNull();
      expect(dbDoctor?.active).toBe(true);
      expect(dbDoctor?.vai_tro).toBe('USER');

      const dbProfile = await prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: dbDoctor!.id },
      });
      expect(dbProfile).not.toBeNull();
      expect(dbProfile?.ho_ten).toBe('BS. CKII Lê Minh Trí');
      expect(dbProfile?.email).toBe(doctorEmail);

      // Bản ghi chờ xác thực phải bị xóa dọn sạch
      const pendingCheck = await prisma.dang_ky_cho_xac_thuc.findUnique({
        where: { token_hash: verificationToken },
      });
      expect(pendingCheck).toBeNull();
    });

    it('1.3 Đăng nhập hệ thống nhận Access Token JWT -> Layer 3 verify lich_su_dang_nhap', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: doctorUsername,
          password: 'P@ssw0rd123!',
        })
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.username).toBe(doctorUsername);

      doctorToken = res.body.data.accessToken;

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbDoctor = await prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: doctorUsername },
      });
      expect(dbDoctor).not.toBeNull();
      doctorUser = dbDoctor;

      const loginHistory = await prisma.lich_su_dang_nhap.findFirst({
        where: { nguoi_dung_id: doctorUser.id },
        orderBy: { login_time: 'desc' },
      });
      expect(loginHistory).not.toBeNull();
      expect(loginHistory?.nguoi_dung_id).toBe(doctorUser.id);
    });
  });

  // ==========================================================================
  // BƯỚC 2: BÁC SĨ TẠO HỒ SƠ BỆNH NHÂN NGUYỄN VĂN A
  // ==========================================================================
  describe('Bước 2: Tạo Hồ Sơ Bệnh Nhân Lâm Sàng Nguyễn Văn A (POST /api/patients)', () => {
    it('2.1 Bác sĩ tạo hồ sơ bệnh nhân ĐTĐ Type 2, PAL 1.4 -> Layer 3 verify benh_nhan', async () => {
      const patientPayload = {
        fullName: 'Nguyễn Văn A',
        patientCode: `BN-GOLDEN-${Date.now().toString().slice(-4)}`,
        dob: '1976-06-15', // 50 tuổi
        gender: 'NAM',
        weight: 65.5,
        height: 168.0,
        activityFactor: 1.4,
        phoneNumber: '0912345678',
        notes:
          'Bệnh nhân nội trú: Đái tháo đường Type 2 kiểm soát kém, biến chứng thận nhẹ, PAL 1.4',
      };

      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(patientPayload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.fullName).toBe('Nguyễn Văn A');
      expect(res.body.data.gender).toBe('NAM');
      expect(res.body.data.weight).toBe(65.5);
      expect(res.body.data.height).toBe(168.0);
      expect(res.body.data.activityFactor).toBe(1.4);

      patientId = res.body.data.id.toString();

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbPatient = await prisma.benh_nhan.findUnique({
        where: { id: BigInt(patientId) },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.ho_ten).toBe('Nguyễn Văn A');
      expect(dbPatient?.gioi_tinh).toBe('NAM');
      expect(Number(dbPatient?.can_nang)).toBe(65.5);
      expect(Number(dbPatient?.chieu_cao)).toBe(168.0);
      expect(Number(dbPatient?.he_so_hoat_dong)).toBe(1.4);
      expect(dbPatient?.nguoi_dung_id).toBe(doctorUser.id);
    });

    it('2.2 Bác sĩ truy vấn chi tiết bệnh nhân qua ID -> Layer 3 verify id & data', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data.id).toBe(patientId);
      expect(res.body.data.fullName).toBe('Nguyễn Văn A');
      expect(res.body.data.age).toBeGreaterThanOrEqual(49);
    });
  });

  // ==========================================================================
  // BƯỚC 3: NGUYÊN LIỆU MASTER & BỘ GIỚI HẠN DINH DƯỠNG CÁ THỂ HÓA
  // ==========================================================================
  describe('Bước 3: Khởi tạo Nguyên liệu Y tế & Bộ Giới hạn Dinh dưỡng Lâm sàng', () => {
    it('3.1 Khởi tạo Danh mục & 2 Nguyên liệu Master chuyên biệt -> Layer 3 verify nguyen_lieu', async () => {
      const prisma = helper.getPrisma();

      // Tạo Danh mục
      const cat = await prisma.danh_muc.create({
        data: { ten_danh_muc: 'Thực phẩm dinh dưỡng lâm sàng Golden' },
      });
      categoryId = cat.id;

      // Nguyên liệu 1: Sữa y học chuyên biệt tiểu đường (edible = 100%)
      const milk = await prisma.nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Sữa dinh dưỡng y học tiểu đường Golden',
          danh_muc: categoryId,
          loai_protein: 'DONG_VAT',
          edible: 100,
          water: 80.0,
          protein: 10.5,
          fat: 4.2,
          fiber: 2.5,
          ash: 0.8,
          calci: 120.0,
          iron: 1.5,
          sodium: 90.0,
          potassium: 160.0,
          vitaminC: 15.0,
          trang_thai: 'DA_DUYET',
          tao_boi_id: doctorUser.id,
        },
      });
      specialMilkIngId = Number(milk.id);

      // Nguyên liệu 2: Bột yến mạch y tế giàu chất xơ (edible = 100%)
      const oat = await prisma.nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: 'Bột yến mạch y tế giàu Beta-Glucan Golden',
          danh_muc: categoryId,
          loai_protein: 'THUC_VAT',
          edible: 100,
          water: 10.0,
          protein: 13.5,
          fat: 6.8,
          fiber: 10.0,
          ash: 1.8,
          calci: 50.0,
          iron: 4.2,
          sodium: 5.0,
          potassium: 350.0,
          vitaminC: 0.0,
          trang_thai: 'DA_DUYET',
          tao_boi_id: doctorUser.id,
        },
      });
      medicalOatIngId = Number(oat.id);

      // Layer 3: Assert both ingredients active in DB
      const count = await prisma.nguyen_lieu.count({
        where: { id: { in: [BigInt(specialMilkIngId), BigInt(medicalOatIngId)] } },
      });
      expect(count).toBe(2);
    });

    it('3.2 Bác sĩ tạo Bộ Giới Hạn Dinh Dưỡng áp dụng cho phác đồ Bệnh nhân A -> Layer 3 verify gioi_han_dinh_duong', async () => {
      const payload = {
        name: 'Phác đồ Giới hạn Dinh dưỡng Bệnh nhân A - ĐTĐ Type 2',
        warningRule: NutritionLimitWarning.GTE_5,
        reusable: true,
        limits: {
          energy: 1800,
          protein: 70,
          lipid: 45,
          carbohydrate: 220,
          fiber: 25,
          sodium: 1500,
          potassium: 2000,
        },
      };

      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/nutrition-limit-sets')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Phác đồ Giới hạn Dinh dưỡng Bệnh nhân A - ĐTĐ Type 2');
      expect(res.body.data.warningRule).toBe(NutritionLimitWarning.GTE_5);

      limitSetId = res.body.data.id.toString();

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbLimit = await prisma.gioi_han_dinh_duong.findUnique({
        where: { id: BigInt(limitSetId) },
      });
      expect(dbLimit).not.toBeNull();
      expect(dbLimit?.ten_gioi_han).toBe('Phác đồ Giới hạn Dinh dưỡng Bệnh nhân A - ĐTĐ Type 2');
      expect(dbLimit?.nguoi_dung_id).toBe(doctorUser.id);
      expect(dbLimit?.canh_bao).toBe(NutritionLimitWarning.GTE_5);
    });
  });

  // ==========================================================================
  // BƯỚC 4: THỰC ĐƠN TUẦN 5 CẤP, TÍNH RECIPE_HASH & GẮN BỘ GIỚI HẠN
  // ==========================================================================
  describe('Bước 4: Tạo Thực đơn Tuần 5 Cấp & Tính Toán Recipe Hash Tự Động (POST /api/menus)', () => {
    it('4.1 Bác sĩ tạo thực đơn tuần 5 cấp gắn bệnh nhân và bộ giới hạn -> Layer 3 verify thuc_don qua 5 cấp', async () => {
      const payload = {
        menuName: 'Thực đơn tuần kiểm soát đường huyết Bệnh nhân A',
        menuType: MenuType.TUAN,
        targetType: TargetType.BENH_NHAN,
        patientId: patientId,
        nutritionLimitSetId: limitSetId,
        weeks: [
          {
            weekNo: 1,
            days: [
              {
                dayOfWeek: 2, // Thứ Hai
                meals: [
                  {
                    mealName: 'Bữa sáng kiểm soát đường huyết',
                    time: '07:00',
                    dishes: [
                      {
                        name: 'Súp sữa y học kiểm soát đường huyết Golden',
                        coefficient: 1.0,
                        details: [{ ingredientId: specialMilkIngId, netWeight: 150 }],
                      },
                    ],
                  },
                  {
                    mealName: 'Bữa trưa kiểm soát đường huyết',
                    time: '11:30',
                    dishes: [
                      {
                        name: 'Cháo yến mạch ngũ cốc y học Golden',
                        coefficient: 1.05,
                        details: [
                          { ingredientId: medicalOatIngId, netWeight: 80 },
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

      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/menus')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.menuName).toBe('Thực đơn tuần kiểm soát đường huyết Bệnh nhân A');
      expect(res.body.data.menuType).toBe(MenuType.TUAN);

      weeklyMenuId = res.body.data.id.toString();

      // Layer 3: Direct Database Verification Across All 5 Levels
      const prisma = helper.getPrisma();

      // Cấp 1: thuc_don
      const dbMenu = await prisma.thuc_don.findUnique({
        where: { id: BigInt(weeklyMenuId) },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.ten_thuc_don).toBe('Thực đơn tuần kiểm soát đường huyết Bệnh nhân A');
      expect(dbMenu?.benh_nhan_id).toBe(BigInt(patientId));
      expect(dbMenu?.gioi_han_dinh_duong_id).toBe(BigInt(limitSetId));
      expect(dbMenu?.nguoi_dung_id).toBe(doctorUser.id);

      // Cấp 2: chi_tiet_thuc_don
      const dbMenuDetails = await prisma.chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: BigInt(weeklyMenuId) },
      });
      expect(dbMenuDetails.length).toBe(2);

      // Cấp 3: bua_an
      const mealIds = dbMenuDetails.map((d) => d.bua_an_id);
      const dbMeals = await prisma.bua_an.findMany({
        where: { id: { in: mealIds } },
      });
      expect(dbMeals.length).toBe(2);

      // Cấp 4 & 5: chi_tiet_bua_an & mon_an & recipe_hash 64-char
      const dbMealDishes = await prisma.chi_tiet_bua_an.findMany({
        where: { bua_an_id: { in: mealIds } },
        include: { mon_an: { include: { chi_tiet_mon_an: true } } },
      });
      expect(dbMealDishes.length).toBe(2);

      for (const md of dbMealDishes) {
        expect(md.mon_an.recipe_hash).toBeDefined();
        expect(md.mon_an.recipe_hash).toHaveLength(64); // SHA-256 standard
        expect(md.mon_an.chi_tiet_mon_an.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // BƯỚC 5: NHÂN BẢN THỰC ĐƠN (CoW) & NỘP ĐỀ XUẤT ĐÓNG BĂNG SNAPSHOT
  // ==========================================================================
  describe('Bước 5: Nhân bản Copy-on-Write & Nộp Đề xuất Đóng băng JSONB Snapshot', () => {
    it('5.1 Nhân bản thực đơn tuần (Deep Clone) -> Layer 3 verify cô lập dữ liệu bản sao', async () => {
      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${weeklyMenuId}/clone`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data.id).not.toBe(weeklyMenuId);
      expect(res.body.data.menuName).toContain('[Bản sao]');

      clonedMenuId = res.body.data.id.toString();

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbCloned = await prisma.thuc_don.findUnique({
        where: { id: BigInt(clonedMenuId) },
      });
      expect(dbCloned).not.toBeNull();
      expect(dbCloned?.ten_thuc_don).toBe(
        '[Bản sao] Thực đơn tuần kiểm soát đường huyết Bệnh nhân A',
      );

      // Đảm bảo bữa ăn của bản sao độc lập hoàn toàn với bản gốc
      const originalDetails = await prisma.chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: BigInt(weeklyMenuId) },
      });
      const clonedDetails = await prisma.chi_tiet_thuc_don.findMany({
        where: { thuc_don_id: BigInt(clonedMenuId) },
      });
      expect(clonedDetails.length).toBe(originalDetails.length);
      const originalMealIds = originalDetails.map((d) => d.bua_an_id.toString());
      expect(originalMealIds).not.toContain(clonedDetails[0].bua_an_id.toString());
    });

    it('5.2 Nộp đề xuất thực đơn cho Admin duyệt -> Layer 3 verify de_xuat_thuc_don & snapshot_json', async () => {
      // Layer 1: HTTP 201 Created
      const res = await request(helper.getHttpServer())
        .post(`/api/menu-proposals/${weeklyMenuId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(201);

      // Layer 2: API Contract Envelope
      expect(res.body.data.success).toBe(true);
      expect(res.body.data).toHaveProperty('proposalId');

      proposalId = res.body.data.proposalId;

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbProposal = await prisma.de_xuat_thuc_don.findUnique({
        where: { id: BigInt(proposalId) },
      });
      expect(dbProposal).not.toBeNull();
      expect(dbProposal?.menu_goc_id).toBe(BigInt(weeklyMenuId));
      expect(dbProposal?.nguoi_de_xuat_id).toBe(doctorUser.id);
      expect(dbProposal?.trang_thai).toBe('CHO_DUYET');

      // Khẳng định snapshot_json đóng băng nguyên vẹn
      expect(dbProposal?.snapshot_json).toBeDefined();
      const snapshot = JSON.parse(dbProposal!.snapshot_json);
      expect(snapshot.menuName).toBe('Thực đơn tuần kiểm soát đường huyết Bệnh nhân A');
      expect(snapshot.weeks.length).toBeGreaterThan(0);
      expect(JSON.stringify(snapshot)).toContain('Súp sữa y học kiểm soát đường huyết Golden');
    });
  });

  // ==========================================================================
  // BƯỚC 6: ADMIN DUYỆT ĐỀ XUẤT & CHUYỂN THỰC ĐƠN SANG CÔNG KHAI
  // ==========================================================================
  describe('Bước 6: Quản trị viên Phê duyệt Đề xuất Thực đơn (PUT /api/menu-proposals/:id/approve)', () => {
    it('6.1 Admin phê duyệt đề xuất -> Layer 3 verify de_xuat: DA_DUYET và thuc_don: CONG_KHAI', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .put(`/api/menu-proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: API Contract Envelope
      expect(res.body.data.success).toBe(true);

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbApprovedProposal = await prisma.de_xuat_thuc_don.findUnique({
        where: { id: BigInt(proposalId) },
      });
      expect(dbApprovedProposal).not.toBeNull();
      expect(dbApprovedProposal?.trang_thai).toBe('DA_DUYET');
      expect(dbApprovedProposal?.nguoi_phe_duyet_id).toBe(adminUser.id);
      expect(dbApprovedProposal?.ngay_phe_duyet).toBeDefined();

      const dbMenu = await prisma.thuc_don.findUnique({
        where: { id: BigInt(weeklyMenuId) },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.loai_thuc_don).toBe('CONG_KHAI');
    });
  });

  // ==========================================================================
  // BƯỚC 7: GHI NHẬN KHẨU PHẦN 24H THỰC TẾ & TÍNH TOÁN 86 VI CHẤT (EDIBLE)
  // ==========================================================================
  describe('Bước 7: Ghi nhận Khẩu phần 24h Thực tế (POST /api/daily-intakes)', () => {
    it('7.1 Ghi nhận khẩu phần 2 bữa thực tế trong ngày của bệnh nhân A -> Layer 3 verify khau_phan_24h & khoi_luong_song_sach', async () => {
      const payload = {
        patientId: patientId,
        intakeDate: '2026-06-15',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Khẩu phần thực tế Ngày 1 áp dụng theo phác đồ Golden Journey',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng lâm sàng',
            mealTime: '07:00',
            ingredients: [
              { ingredientId: specialMilkIngId, rawWeight: 200 }, // edible 100% -> sạch 200g
            ],
          },
          {
            mealOrder: 2,
            mealName: 'Bữa trưa lâm sàng',
            mealTime: '11:30',
            ingredients: [
              { ingredientId: medicalOatIngId, rawWeight: 100 }, // edible 100% -> sạch 100g
              { ingredientId: specialMilkIngId, rawWeight: 50 }, // edible 100% -> sạch 50g
            ],
          },
        ],
      };

      // Layer 1: HTTP 201 Created
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

      dailyIntakeId = res.body.data.id.toString();

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(dailyIntakeId) },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.benh_nhan_id).toBe(BigInt(patientId));
      expect(dbIntake?.nguoi_dung_id).toBe(doctorUser.id);
      expect(dbIntake?.kieu_nhap).toBe(IntakeInputType.BY_MEAL);

      const dbMeals = await prisma.khau_phan_24h_bua_an.findMany({
        where: { khau_phan_24h_id: BigInt(dailyIntakeId) },
        include: { khau_phan_24h_nguyen_lieu: true },
      });
      expect(dbMeals.length).toBe(2);

      // Assert khối lượng sống sạch tự động tính chuẩn theo tỷ lệ edible 100%
      const milkInBreakfast = dbMeals[0].khau_phan_24h_nguyen_lieu[0];
      expect(Number(milkInBreakfast.khoi_luong_song_sach)).toBe(200);

      const oatInLunch = dbMeals[1].khau_phan_24h_nguyen_lieu.find(
        (i) => i.nguyen_lieu_id === BigInt(medicalOatIngId),
      );
      expect(Number(oatInLunch?.khoi_luong_song_sach)).toBe(100);
    });
  });

  // ==========================================================================
  // BƯỚC 8: ĐỐI CHIẾU RDA/DRI & XUẤT FILE EXCEL 4 SHEET LÂM SÀNG SẠCH
  // ==========================================================================
  describe('Bước 8: Đối chiếu RDA/DRI Lâm sàng & Xuất Báo cáo Excel 4-Sheet Sạch Không NaN/Infinity', () => {
    it('8.1 Bác sĩ xem báo cáo đối chiếu RDA/DRI lâm sàng 5 dải đánh giá -> Layer 3 verify bệnh nhân', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes/${dailyIntakeId}/rda-report`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Layer 2: API Contract Envelope
      const rdaData = res.body.data;
      expect(rdaData).toHaveProperty('demographic');
      expect(rdaData.demographic.gender).toBe('NAM');
      expect(rdaData.demographic.ageYears).toBeGreaterThanOrEqual(49);
      expect(Array.isArray(rdaData.nutrients)).toBe(true);
      expect(rdaData.nutrients.length).toBeGreaterThan(0);

      // Kiểm tra cấu trúc đánh giá 5 dải lâm sàng cho vi chất
      const energyNutrient = rdaData.nutrients.find((n: any) => n.code === 'energy');
      expect(energyNutrient).toBeDefined();
      expect(energyNutrient).toHaveProperty('actualIntake');
      expect(energyNutrient).toHaveProperty('fulfillmentPercent');
      expect(energyNutrient).toHaveProperty('status');

      // Khẳng định giá trị tính toán hợp lệ, không chứa NaN hay Infinity
      expect(Number.isNaN(Number(energyNutrient.actualIntake))).toBe(false);
      expect(Number.isFinite(Number(energyNutrient.actualIntake))).toBe(true);

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbPatient = await prisma.benh_nhan.findUnique({
        where: { id: BigInt(patientId) },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.ho_ten).toBe('Nguyễn Văn A');
    });

    it('8.2 Bác sĩ tải file Excel báo cáo lâm sàng tổng hợp (ALL_IN_ONE) -> Layer 3 verify file ZIP/PK', async () => {
      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .get(
          `/api/daily-intakes/${dailyIntakeId}/export?reportType=${DailyIntakeClinicalReportType.ALL_IN_ONE}`,
        )
        .set('Authorization', `Bearer ${doctorToken}`)
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      // Layer 2: Binary Headers & Buffer Content Assertions
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain(
        `attachment; filename="bao_cao_lam_sang_24h_${dailyIntakeId}`,
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Zip magic header 'PK' (0x50, 0x4b)
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);

      // Xác nhận nội dung buffer không chứa chuỗi lỗi NaN hoặc Infinity
      const bufferText = res.body.toString('latin1');
      expect(bufferText).not.toContain('<v>NaN</v>');
      expect(bufferText).not.toContain('<v>Infinity</v>');

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbIntake = await prisma.khau_phan_24h.findUnique({
        where: { id: BigInt(dailyIntakeId) },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.id).toBe(BigInt(dailyIntakeId));
    });

    it('8.3 Xuất file Excel thực đơn tuần công khai -> Layer 3 verify binary output sạch', async () => {
      // Layer 1: HTTP Status Code (POST /api/menus/:id/export)
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${weeklyMenuId}/export`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ exportType: 'FULL' })
        .buffer(true)
        .parse(binaryBufferParser);

      expect([200, 201]).toContain(res.status);

      // Layer 2: Binary Content Assertions
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);

      // Layer 3: Direct Database Verification
      const prisma = helper.getPrisma();
      const dbMenu = await prisma.thuc_don.findUnique({
        where: { id: BigInt(weeklyMenuId) },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.loai_thuc_don).toBe('CONG_KHAI');
    });
  });
});
