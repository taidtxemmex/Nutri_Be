import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  MenuType,
  TargetType,
  MenuExportType,
  IntakeInputType,
  DailyIntakeClinicalReportType,
  NutritionLimitWarning,
} from '../../src/config/enums/domain.enum';

// Nâng timeout cho E2E suite để chống flaky timeout khi khởi tạo NestJS + Prisma
jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 4 E2E SECURITY & IDOR PENETRATION TEST SUITE
 * ============================================================================
 * Mandatory 3-Layer Assertion Model (Iron Discipline & Security Guardrails):
 * - Layer 1: Protocol HTTP Status Codes (401 Unauthorized, 403 Forbidden, 404 Not Found)
 * - Layer 2: Unified Error Response Contract Envelopes ({ error: { code, message }, meta })
 * - Layer 3: Direct Database State Persistence (Prisma queries verify victim data untouched)
 * ============================================================================
 */
describe('Sprint 4: Multi-Tenant Security & IDOR Defense (3-Layer E2E Suite)', () => {
  const helper = new TestAppHelper();

  let doctorAToken: string;
  let doctorAUser: any;
  let doctorBToken: string;
  let doctorBUser: any;
  let adminToken: string;
  let adminUser: any;

  let categoryId: number;
  let beefIngId: number;
  let _celeryIngId: number;
  let _riceIngId: number;
  let patientXId: string;
  let patientYId: string;

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
      data: { ten_danh_muc: 'Thực phẩm dinh dưỡng Sprint 4 Security' },
    });
    categoryId = cat.id;

    // 3. Tạo các nguyên liệu mẫu
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
    _celeryIngId = Number(celery.id);

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
    _riceIngId = Number(rice.id);

    // 4. Khởi tạo tài khoản kiểm thử bảo mật
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Bác sĩ A (Nạn nhân bị tấn công IDOR)
    const doctorA = await helper.createTestUser({
      username: `doc_a_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ A (Chủ sở hữu hợp pháp)',
    });
    doctorAToken = doctorA.token;
    doctorAUser = doctorA.user;

    // Bác sĩ B (Kẻ tấn công IDOR - Attacker)
    const doctorB = await helper.createTestUser({
      username: `doc_b_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ B (Kẻ tấn công IDOR)',
    });
    doctorBToken = doctorB.token;
    doctorBUser = doctorB.user;

    // Quản trị viên (Admin)
    const admin = await helper.createTestUser({
      username: `admin_sec_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên An Toàn',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    // 5. Khởi tạo Bệnh nhân X thuộc Bác sĩ A và Bệnh nhân Y thuộc Bác sĩ B
    const patientX = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorAUser.id,
        ho_ten: 'Nguyễn Văn Bệnh Nhân X (Của Bác Sĩ A)',
        so_dien_thoai: '0911223344',
        ngay_sinh: new Date('1985-06-15'),
        gioi_tinh: 'NAM',
        can_nang: 65.0,
        chieu_cao: 170.0,
        he_so_hoat_dong: 1.4,
        ma_benh_nhan_bv: `BN-X-${uniqueSuffix}`,
      },
    });
    patientXId = patientX.id.toString();

    const patientY = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: doctorBUser.id,
        ho_ten: 'Trần Thị Bệnh Nhân Y (Của Bác Sĩ B)',
        so_dien_thoai: '0988776655',
        ngay_sinh: new Date('1990-03-20'),
        gioi_tinh: 'NU',
        can_nang: 52.0,
        chieu_cao: 158.0,
        he_so_hoat_dong: 1.3,
        ma_benh_nhan_bv: `BN-Y-${uniqueSuffix}`,
      },
    });
    patientYId = patientY.id.toString();
  });

  afterAll(async () => {
    if (helper.getPrisma()) {
      await helper.getPrisma().$disconnect();
    }
    await helper.close();
  });

  // ==========================================================================
  // VECTOR 1: IDOR TRÊN PHÂN HỆ THỰC ĐƠN 5 CẤP (MENUS)
  // ==========================================================================
  describe('Vector 1: IDOR trên Phân hệ Thực đơn 5 Cấp (/api/menus & /api/menu)', () => {
    let menuAId: bigint;

    beforeEach(async () => {
      const prisma = helper.getPrisma();

      // Bác sĩ A tạo thực đơn riêng tư M_A
      const menuA = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_thuc_don: 'Thực đơn riêng tư điều trị tiểu đường của Bác sĩ A',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(patientXId),
          ngay_tao: new Date(),
        },
      });
      menuAId = menuA.id;

      const meal = await prisma.bua_an.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_bua_an: 'Bữa trưa dinh dưỡng A',
          gio_an: '11:30',
        },
      });

      const dish = await prisma.mon_an.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_mon: 'Thịt bò xào rau củ A',
          trang_thai: 'RIENG_TU',
        },
      });

      await prisma.chi_tiet_mon_an.create({
        data: {
          mon_an_id: dish.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 100,
        },
      });

      await prisma.chi_tiet_bua_an.create({
        data: {
          bua_an_id: meal.id,
          mon_an_id: dish.id,
          he_so_song_chin: 1.0,
        },
      });

      await prisma.chi_tiet_thuc_don.create({
        data: {
          thuc_don_id: menuA.id,
          bua_an_id: meal.id,
          thu_tu_trong_tuan: 1,
        },
      });
    });

    it('1.1 IDOR Read: Bác sĩ B cố gắng xem chi tiết thực đơn M_A của Bác sĩ A -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get(`/api/menus/${menuAId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('MENU_001');

      // Layer 3: Direct Database State Persistence Assertion
      const dbMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: menuAId },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.nguoi_dung_id).toBe(doctorAUser.id);
      expect(dbMenu?.ten_thuc_don).toBe('Thực đơn riêng tư điều trị tiểu đường của Bác sĩ A');
    });

    it('1.2 IDOR Read Full Tree: Bác sĩ B cố gắng xem toàn bộ cây 5 cấp thực đơn M_A của Bác sĩ A -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get(`/api/menus/${menuAId}/full`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('MENU_001');

      // Layer 3: Direct Database State Persistence Assertion
      const detailsCount = await helper.getPrisma().chi_tiet_thuc_don.count({
        where: { thuc_don_id: menuAId },
      });
      expect(detailsCount).toBe(1);
    });

    it('1.3 IDOR Mutation (Tamper/Update): Bác sĩ B cố gắng sửa thực đơn M_A đổi tên và chuyển sang bệnh nhân Y -> Bị chặn 404 NOT_FOUND', async () => {
      const maliciousPayload = {
        menuName: 'HACKED BY DOCTOR B: Thực đơn bị chiếm đoạt',
        patientId: patientYId,
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .put(`/api/menus/${menuAId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send(maliciousPayload)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('MENU_001');

      // Layer 3: Direct Database State Persistence Assertion - KHẲNG ĐỊNH M_A KHÔNG BỊ BIẾN ĐỔI BẤT KỲ TRƯỜNG NÀO!
      const dbMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: menuAId },
      });
      expect(dbMenu?.ten_thuc_don).toBe('Thực đơn riêng tư điều trị tiểu đường của Bác sĩ A');
      expect(dbMenu?.benh_nhan_id).toBe(BigInt(patientXId));
      expect(dbMenu?.nguoi_dung_id).toBe(doctorAUser.id);
    });

    it('1.4 IDOR Delete: Bác sĩ B cố gắng xóa thực đơn M_A của Bác sĩ A -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .delete(`/api/menus/${menuAId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('MENU_001');

      // Layer 3: Direct Database State Persistence Assertion - Menu M_A vẫn tồn tại và không bị xóa mềm!
      const dbMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: menuAId },
      });
      expect(dbMenu).not.toBeNull();
      expect(dbMenu?.deleted_at).toBeNull();
    });

    it('1.5 IDOR Export Excel: Bác sĩ B cố gắng xuất Excel thực đơn M_A của Bác sĩ A -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post(`/api/menus/${menuAId}/export`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ exportType: MenuExportType.FULL })
        .expect(404);

      // Layer 2: Error Payload
      expect(res.body.error.code).toBe('MENU_NOT_FOUND');

      // Layer 3: DB Verification
      const dbMenu = await helper.getPrisma().thuc_don.findUnique({
        where: { id: menuAId },
      });
      expect(dbMenu).not.toBeNull();
    });
  });

  // ==========================================================================
  // VECTOR 2: IDOR TRÊN PHÂN HỆ KHẨU PHẦN 24H (DAILY-INTAKES)
  // ==========================================================================
  describe('Vector 2: IDOR trên Phân hệ Khẩu phần 24h (/api/daily-intakes)', () => {
    let intakeXId: bigint;

    beforeEach(async () => {
      const prisma = helper.getPrisma();

      // Tạo hồ sơ ăn uống 24h D_X cho Bệnh nhân X (thuộc Bác sĩ A)
      const intake = await prisma.khau_phan_24h.create({
        data: {
          benh_nhan_id: BigInt(patientXId),
          nguoi_dung_id: doctorAUser.id,
          ngay_an: new Date('2026-05-10'),
          kieu_nhap: IntakeInputType.BY_MEAL,
          ghi_chu: 'Khẩu phần ăn 24h tiêu chuẩn của BN X',
        },
      });
      intakeXId = intake.id;

      const meal = await prisma.khau_phan_24h_bua_an.create({
        data: {
          khau_phan_24h_id: intake.id,
          thu_tu_bua: 1,
          ten_bua: 'Bữa sáng BN X',
          gio_an: '07:00',
        },
      });

      await prisma.khau_phan_24h_nguyen_lieu.create({
        data: {
          khau_phan_24h_bua_an_id: meal.id,
          nguyen_lieu_id: BigInt(beefIngId),
          khoi_luong_song_sach: 120,
        },
      });
    });

    it('2.1 IDOR Read: Bác sĩ B cố gắng đọc chi tiết khẩu phần D_X của Bệnh nhân X -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get(`/api/daily-intakes/${intakeXId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('DAILY_INTAKE_NOT_FOUND');

      // Layer 3: Direct Database State Persistence Assertion
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: intakeXId },
      });
      expect(dbIntake).not.toBeNull();
      expect(dbIntake?.benh_nhan_id).toBe(BigInt(patientXId));
    });

    it('2.2 IDOR Update: Bác sĩ B cố gắng ghi đè/xóa bữa ăn của D_X -> Bị chặn 404 NOT_FOUND', async () => {
      const maliciousPayload = {
        note: 'HACKED DAILY INTAKE BY DOCTOR B',
        meals: [],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .put(`/api/daily-intakes/${intakeXId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send(maliciousPayload)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('DAILY_INTAKE_NOT_FOUND');

      // Layer 3: Direct Database State Persistence Assertion - KHẲNG ĐỊNH D_X KHÔNG BỊ THAY ĐỔI!
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: intakeXId },
        include: { khau_phan_24h_bua_an: true },
      });
      expect(dbIntake?.ghi_chu).toBe('Khẩu phần ăn 24h tiêu chuẩn của BN X');
      expect(dbIntake?.khau_phan_24h_bua_an.length).toBe(1);
    });

    it('2.3 IDOR Delete: Bác sĩ B cố gắng xóa hồ sơ khẩu phần D_X của Bệnh nhân X -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .delete(`/api/daily-intakes/${intakeXId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('DAILY_INTAKE_NOT_FOUND');

      // Layer 3: Direct Database State Persistence Assertion - Bản ghi D_X vẫn tồn tại nguyên vẹn!
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: intakeXId },
      });
      expect(dbIntake).not.toBeNull();
    });

    it('2.4 IDOR Export: Bác sĩ B cố gắng xuất báo cáo lâm sàng của D_X -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get(
          `/api/daily-intakes/${intakeXId}/export?reportType=${DailyIntakeClinicalReportType.ALL_IN_ONE}`,
        )
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: Error Payload
      expect(res.body.error.code).toBe('DAILY_INTAKE_NOT_FOUND');

      // Layer 3: DB Check
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: intakeXId },
      });
      expect(dbIntake).not.toBeNull();
    });

    it('2.5 Cross-Tenant Injection: Bác sĩ A cố gắng ghi nhận khẩu phần ăn cho Bệnh nhân Y (thuộc Bác sĩ B) -> Bị chặn 404 PATIENT_NOT_FOUND', async () => {
      const payload = {
        patientId: patientYId, // Bệnh nhân của Bác sĩ B
        intakeDate: '2026-05-15',
        inputType: IntakeInputType.BY_MEAL,
        note: 'Bác sĩ A cố tình ghi dữ liệu vào bệnh nhân của Bác sĩ B',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng bất hợp pháp',
            ingredients: [{ ingredientId: beefIngId, rawWeight: 100 }],
          },
        ],
      };

      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(payload)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('PATIENT_NOT_FOUND');

      // Layer 3: Direct Database State Persistence Assertion - KHÔNG BẢN GHI NÀO ĐƯỢC PHÉP TẠO CHO BỆNH NHÂN Y TỪ BÁC SĨ A!
      const unauthorizedIntake = await helper.getPrisma().khau_phan_24h.findFirst({
        where: {
          benh_nhan_id: BigInt(patientYId),
          nguoi_dung_id: doctorAUser.id,
        },
      });
      expect(unauthorizedIntake).toBeNull();
    });
  });

  // ==========================================================================
  // VECTOR 3: LEO THANG ĐẶC QUYỀN (PRIVILEGE ESCALATION) TRÊN ĐỀ XUẤT THỰC ĐƠN
  // ==========================================================================
  describe('Vector 3: Leo thang Đặc quyền (Privilege Escalation) trên Đề xuất Thực đơn (/api/menu-proposals)', () => {
    let proposalId: bigint;

    beforeEach(async () => {
      const prisma = helper.getPrisma();

      // Bác sĩ A nộp đề xuất thực đơn chờ phê duyệt
      const menu = await prisma.thuc_don.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_thuc_don: 'Thực đơn đề xuất thẩm định y khoa',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: BigInt(patientXId),
        },
      });

      const proposal = await prisma.de_xuat_thuc_don.create({
        data: {
          menu_goc_id: menu.id,
          nguoi_de_xuat_id: doctorAUser.id,
          ten_thuc_don: 'Thực đơn đề xuất thẩm định y khoa',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          trang_thai: 'CHO_DUYET',
          snapshot_json: JSON.stringify({ menuName: 'Thực đơn đề xuất thẩm định y khoa' }),
        },
      });
      proposalId = proposal.id;
    });

    it('3.1 Privilege Escalation on Approve: Người dùng thường cố gắng tự phê duyệt đề xuất qua PUT /api/menu-proposals/:id/approve -> Bị chặn 403 FORBIDDEN', async () => {
      // Layer 1: HTTP Status Code 403 Forbidden
      const res = await request(helper.getHttpServer())
        .put(`/api/menu-proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('AUTH_403');

      // Layer 3: Direct Database State Persistence Assertion - KHẲNG ĐỊNH TRẠNG THÁI VẪN LÀ CHO_DUYET!
      const dbProposal = await helper.getPrisma().de_xuat_thuc_don.findUnique({
        where: { id: proposalId },
      });
      expect(dbProposal?.trang_thai).toBe('CHO_DUYET');
      expect(dbProposal?.nguoi_phe_duyet_id).toBeNull();
    });

    it('3.2 Privilege Escalation on Reject: Người dùng thường cố gắng từ chối đề xuất qua PUT /api/menu-proposals/:id/reject -> Bị chặn 403 FORBIDDEN', async () => {
      // Layer 1: HTTP Status Code 403 Forbidden
      const res = await request(helper.getHttpServer())
        .put(`/api/menu-proposals/${proposalId}/reject`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ reason: 'Hacker tự ý từ chối đề xuất' })
        .expect(403);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('AUTH_403');

      // Layer 3: Direct Database State Persistence Assertion - KHẲNG ĐỊNH ĐỀ XUẤT VẪN Ở TRẠNG THÁI CHO_DUYET!
      const dbProposal = await helper.getPrisma().de_xuat_thuc_don.findUnique({
        where: { id: proposalId },
      });
      expect(dbProposal?.trang_thai).toBe('CHO_DUYET');
      expect(dbProposal?.ly_do_tu_choi).toBeNull();
    });

    it('3.3 Privilege Escalation on Admin List: Người dùng thường cố gắng xem danh sách toàn bộ đề xuất của Admin -> Bị chặn 403 FORBIDDEN', async () => {
      // Layer 1: HTTP Status Code 403 Forbidden
      const res = await request(helper.getHttpServer())
        .get('/api/menu-proposals')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('AUTH_403');
    });

    it('3.4 Admin Legit Approval: Chỉ Admin thực thụ mới có quyền phê duyệt đề xuất -> Layer 3 verify DA_DUYET', async () => {
      // Layer 1: HTTP Status Code 200 OK (Chỉ khi gửi token của Admin)
      const res = await request(helper.getHttpServer())
        .put(`/api/menu-proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Layer 2: Contract Response
      expect(res.body.data.success).toBe(true);

      // Layer 3: Direct Database State Persistence Assertion
      const dbProposal = await helper.getPrisma().de_xuat_thuc_don.findUnique({
        where: { id: proposalId },
      });
      expect(dbProposal?.trang_thai).toBe('DA_DUYET');
      expect(dbProposal?.nguoi_phe_duyet_id).toBe(adminUser.id);
    });
  });

  // ==========================================================================
  // VECTOR 4: IDOR TRÊN BỘ GIỚI HẠN DINH DƯỠNG (NUTRITION-LIMIT-SETS)
  // ==========================================================================
  describe('Vector 4: IDOR trên Bộ Giới Hạn Dinh Dưỡng (/api/nutrition-limit-sets)', () => {
    let privateLimitSetId: bigint;

    beforeEach(async () => {
      // User 1 (Bác sĩ A) tạo bộ giới hạn riêng tư (tai_su_dung = false)
      const limit = await helper.getPrisma().gioi_han_dinh_duong.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_gioi_han: 'Giới hạn dinh dưỡng tuyệt mật của User 1',
          tai_su_dung: false,
          canh_bao: NutritionLimitWarning.GTE_5,
          gioi_han_json: { energy: 1600, sodium: 1200 },
          ngay_tao: new Date(),
          ngay_cap_nhat: new Date(),
        },
      });
      privateLimitSetId = limit.id;
    });

    it('4.1 IDOR Read: User 2 cố gắng lấy chi tiết bộ giới hạn riêng tư của User 1 -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code 404 Not Found
      const res = await request(helper.getHttpServer())
        .get(`/api/nutrition-limit-sets/${privateLimitSetId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('NLS_004');

      // Layer 3: Direct Database State Persistence Assertion
      const dbLimit = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: privateLimitSetId },
      });
      expect(dbLimit).not.toBeNull();
      expect(dbLimit?.nguoi_dung_id).toBe(doctorAUser.id);
    });

    it('4.2 IDOR Update: User 2 cố gắng sửa đổi bộ giới hạn riêng tư của User 1 -> Bị chặn 404 NOT_FOUND', async () => {
      const maliciousPayload = {
        name: 'HACKED BY USER 2: Giới hạn bị chiếm đoạt',
        reusable: true,
      };

      // Layer 1: HTTP Status Code 404 Not Found
      const res = await request(helper.getHttpServer())
        .put(`/api/nutrition-limit-sets/${privateLimitSetId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send(maliciousPayload)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('NLS_004');

      // Layer 3: Direct Database State Persistence Assertion - KHẲNG ĐỊNH TÊN VÀ TRẠNG THÁI KHÔNG BỊ ĐỔI!
      const dbLimit = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: privateLimitSetId },
      });
      expect(dbLimit?.ten_gioi_han).toBe('Giới hạn dinh dưỡng tuyệt mật của User 1');
      expect(dbLimit?.tai_su_dung).toBe(false);
    });

    it('4.3 IDOR Delete: User 2 cố gắng xóa bộ giới hạn riêng tư của User 1 -> Bị chặn 404 NOT_FOUND', async () => {
      // Layer 1: HTTP Status Code 404 Not Found
      const res = await request(helper.getHttpServer())
        .delete(`/api/nutrition-limit-sets/${privateLimitSetId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);

      // Layer 2: API Error Envelope
      expect(res.body.error.code).toBe('NLS_004');

      // Layer 3: Direct Database State Persistence Assertion - Bản ghi vẫn tồn tại nguyên vẹn!
      const dbLimit = await helper.getPrisma().gioi_han_dinh_duong.findUnique({
        where: { id: privateLimitSetId },
      });
      expect(dbLimit).not.toBeNull();
    });
  });

  // ==========================================================================
  // VECTOR 5: TẤN CÔNG SQL INJECTION, XSS VÀ AUTHENTICATION TAMPERING
  // ==========================================================================
  describe('Vector 5: SQLi, XSS Injection & Header/JWT Tampering trên Sprint 4 Endpoints', () => {
    it("5.1 SQL Injection qua Query Parameters: Thử nghiệm ' OR 1=1 -- trên search/keyword -> Prisma chống SQLi an toàn, không rò rỉ dữ liệu tenant khác", async () => {
      // Tạo menu của Bác sĩ A và Bác sĩ B
      await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ten_thuc_don: 'Thực đơn Bác sĩ A - Tìm kiếm bảo mật',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      await helper.getPrisma().thuc_don.create({
        data: {
          nguoi_dung_id: doctorBUser.id,
          ten_thuc_don: 'Thực đơn Bác sĩ B - Dữ liệu nhạy cảm',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      // Tấn công SQLi với chuỗi kinh điển "' OR '1'='1"
      const res = await request(helper.getHttpServer())
        .get("/api/menus?keyword=' OR '1'='1")
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      // Layer 2: API Response Envelope
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);

      // Khẳng định Bác sĩ A KHÔNG THỂ nhìn thấy thực đơn của Bác sĩ B dù đã inject SQL!
      const leakedItems = res.body.data.filter((item: any) => item.menuName.includes('Bác sĩ B'));
      expect(leakedItems.length).toBe(0);

      // Tấn công SQLi dạng DROP TABLE thuc_don; --
      await request(helper.getHttpServer())
        .get("/api/menus?search='; DROP TABLE thuc_don; --")
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      // Layer 3: Direct Database State Persistence Assertion - Bảng thuc_don vẫn tồn tại nguyên vẹn!
      const totalMenus = await helper.getPrisma().thuc_don.count();
      expect(totalMenus).toBeGreaterThanOrEqual(2);
    });

    it('5.2 XSS & SQLi Injection trong JSON Body (note, mealName): Payload được lưu trữ nguyên vẹn dạng chuỗi, không thực thi mã', async () => {
      const maliciousPayload = {
        patientId: patientXId,
        intakeDate: '2026-05-20',
        inputType: IntakeInputType.BY_MEAL,
        note: "<script>alert('XSS_ATTACK')</script>'; DROP TABLE benh_nhan; --",
        meals: [
          {
            mealOrder: 1,
            mealName: "<img src=x onerror=alert('XSS')>",
            ingredients: [{ ingredientId: beefIngId, rawWeight: 100 }],
          },
        ],
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(maliciousPayload)
        .expect(201);

      const intakeId = res.body.data.id;

      // Layer 3: Direct Database State Persistence Assertion - Chuỗi được lưu an toàn dạng text, CSDL nguyên vẹn
      const dbIntake = await helper.getPrisma().khau_phan_24h.findUnique({
        where: { id: BigInt(intakeId) },
        include: { khau_phan_24h_bua_an: true },
      });
      expect(dbIntake?.ghi_chu).toBe(
        "<script>alert('XSS_ATTACK')</script>'; DROP TABLE benh_nhan; --",
      );
      expect(dbIntake?.khau_phan_24h_bua_an[0].ten_bua).toBe("<img src=x onerror=alert('XSS')>");

      const totalPatients = await helper.getPrisma().benh_nhan.count();
      expect(totalPatients).toBeGreaterThanOrEqual(2);
    });

    it('5.3 Missing Authorization Header: Không gửi Header Authorization -> Bị chặn 401 UNAUTHORIZED', async () => {
      // 1. Thử vào /api/menus
      const resMenu = await request(helper.getHttpServer()).get('/api/menus').expect(401);
      expect(resMenu.body.error.code).toBe('AUTH_001');

      // 2. Thử vào /api/daily-intakes
      const resIntake = await request(helper.getHttpServer()).get('/api/daily-intakes').expect(401);
      expect(resIntake.body.error.code).toBe('AUTH_001');

      // 3. Thử vào /api/nutrition-limit-sets
      const resLimit = await request(helper.getHttpServer())
        .get('/api/nutrition-limit-sets')
        .expect(401);
      expect(resLimit.body.error.code).toBe('AUTH_001');
    });

    it('5.4 Malformed / Fake JWT Token: Gửi token rác/giả mạo -> Bị chặn 401 UNAUTHORIZED', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/menus')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_tampered_payload.signature',
        )
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_001');
    });

    it('5.5 Expired JWT Token: Gửi token đã hết hạn -> Bị chặn 401 UNAUTHORIZED', async () => {
      const expiredPayload = {
        sub: doctorAUser.id,
        userId: doctorAUser.id,
        role: doctorAUser.vai_tro,
      };

      const expiredToken = helper.getJwtService().sign(expiredPayload, { expiresIn: '-10s' });

      const res = await request(helper.getHttpServer())
        .get('/api/menus')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_001');
    });

    it('5.6 Tampered JWT Signature: Token ký bởi Secret giả mạo -> Bị chặn 401 UNAUTHORIZED', async () => {
      const forgedPayload = {
        sub: doctorAUser.id,
        userId: doctorAUser.id,
        role: UserRole.ADMIN, // Giả mạo quyền Admin
      };

      // Ký bằng Secret Key giả mạo của kẻ tấn công
      const forgedToken = helper.getJwtService().sign(forgedPayload, {
        secret: 'malicious-attacker-unauthorized-secret-key-123456789',
        expiresIn: '1h',
      });

      const res = await request(helper.getHttpServer())
        .get('/api/menus')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_001');
    });
  });
});
