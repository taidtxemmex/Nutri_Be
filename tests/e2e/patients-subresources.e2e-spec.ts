import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { MenuType, TargetType, IntakeInputType } from '../../src/config/enums/domain.enum';

jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 5 TEST SUITE 4: PATIENTS SUB-RESOURCES, IDOR & PROACTIVE DELETE GUARD
 * (Tasks 5.5 & 5.6)
 * ============================================================================
 * Targets:
 * - Sub-resource: GET/POST /api/patients/:id/anthropometry (Biến thiên thể trạng & đồng bộ hồ sơ chính)
 * - Sub-resource: GET/POST /api/patients/:id/medical-records (Bệnh án lâm sàng, ICD-10, can thiệp dinh dưỡng)
 * - Proactive Delete Guard: Chặn xóa bệnh nhân (409 PAT_003) nếu có thực đơn (thuc_don) hoặc nhật ký 24h (khau_phan_24h)
 * - IDOR Defense: Bác sĩ B bị chặn 100% (403 PAT_001) khi đọc/ghi/xóa dữ liệu bệnh nhân của Bác sĩ A
 * - Mandatory 3-Layer Assertions (HTTP Status -> Payload Envelope -> Direct MySQL Database State)
 * ============================================================================
 */
describe('Sprint 5 Suite 4: Sub-resources, IDOR & Delete Guard (Tasks 5.5 & 5.6)', () => {
  const helper = new TestAppHelper();

  let adminToken: string;
  let adminUser: any;
  let doctorAToken: string;
  let doctorAUser: any;
  let doctorBToken: string;
  let doctorBUser: any;

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();
  });

  beforeEach(async () => {
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `chi_tiet_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_nhan_trac`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_benh_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_sub_${unique}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Giám Đốc Bệnh Viện (Admin)',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const docA = await helper.createTestUser({
      username: `doc_sub_a_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Nguyễn Văn A',
    });
    doctorAToken = docA.token;
    doctorAUser = docA.user;

    const docB = await helper.createTestUser({
      username: `doc_sub_b_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Trần Thị B (Attacker IDOR)',
    });
    doctorBToken = docB.token;
    doctorBUser = docB.user;
  });

  afterAll(async () => {
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_nhan_trac`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_benh_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();
    await helper.close();
  });

  describe('Scenario 1: Sub-resource Anthropometry (Nhân trắc học & Đồng bộ)', () => {
    it('1.1 Bác sĩ A ghi nhận thể trạng mới -> 201 Created, Layer 3 verify benh_nhan_nhan_trac & tự động đồng bộ vào benh_nhan', async () => {
      // 1. Tạo bệnh nhân gốc
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Trần Thể Trạng',
          so_dien_thoai: '0912111222',
          ma_benh_nhan_bv: '0912111222',
          gioi_tinh: 'NAM',
          ngay_sinh: new Date('1990-05-10'),
          can_nang: 60.0,
          chieu_cao: 168.0,
          he_so_hoat_dong: 1.2,
          tao_luc: new Date(),
        },
      });

      // 2. Ghi nhận số đo mới
      const anthroPayload = {
        measuredDate: '2026-10-27',
        weight: 65.5,
        height: 168.0,
        systolicBloodPressure: 120,
        diastolicBloodPressure: 80,
        waistCircumference: 78.5,
        hipCircumference: 92.0,
        activityFactor: 1.55,
        notes: 'Sau 1 tháng điều trị: Cân nặng tăng 5.5kg, thể trạng hồi phục tốt',
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(anthroPayload)
        .expect(201);

      // Layer 2: API Contract Envelope
      const body = res.body.data;
      expect(body).toHaveProperty('id');
      expect(body.patientId).toBe(patient.id.toString());
      expect(body.weight).toBe(65.5);
      expect(body.height).toBe(168.0);
      expect(body.bmi).toBeCloseTo(23.2, 1);
      expect(body.bmiLevel).toBe('overweight');
      expect(body.systolicBloodPressure).toBe(120);
      expect(body.diastolicBloodPressure).toBe(80);
      expect(body.waistCircumference).toBe(78.5);
      expect(body.hipCircumference).toBe(92.0);
      expect(body.notes).toBe('Sau 1 tháng điều trị: Cân nặng tăng 5.5kg, thể trạng hồi phục tốt');

      const anthroId = BigInt(body.id);

      // Layer 3: DIRECT DATABASE STATE PERSISTENCE (GOLDEN LAW)
      // A. Bản ghi benh_nhan_nhan_trac được tạo đúng
      const dbAnthro = await helper.getPrisma().benh_nhan_nhan_trac.findUnique({
        where: { id: anthroId },
      });
      expect(dbAnthro).not.toBeNull();
      expect(Number(dbAnthro?.can_nang)).toBe(65.5);
      expect(Number(dbAnthro?.chieu_cao)).toBe(168.0);
      expect(dbAnthro?.huyet_ap_tam_thu).toBe(120);
      expect(dbAnthro?.huyet_ap_tam_truong).toBe(80);
      expect(dbAnthro?.nguoi_tao_id).toBe(doctorAUser.id);

      // B. Bảng benh_nhan gốc phải được TỰ ĐỘNG ĐỒNG BỘ chỉ số mới nhất!
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(Number(dbPatient?.can_nang)).toBe(65.5);
      expect(Number(dbPatient?.chieu_cao)).toBe(168.0);
      expect(Number(dbPatient?.he_so_hoat_dong)).toBe(1.55);
    });

    it('1.2 Lấy danh sách lịch sử đo nhân trắc học phân trang qua GET /api/patients/:id/anthropometry', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Lê Văn Lịch Sử',
          gioi_tinh: 'NAM',
          tao_luc: new Date(),
        },
      });

      // Tạo 3 bản ghi số đo
      for (let i = 1; i <= 3; i++) {
        await helper.getPrisma().benh_nhan_nhan_trac.create({
          data: {
            benh_nhan_id: patient.id,
            ngay_do: new Date(`2026-0${i}-15`),
            can_nang: 60 + i,
            chieu_cao: 170,
            bmi: 21.0,
            phan_loai_bmi: 'normal',
            nguoi_tao_id: doctorAUser.id,
            tao_luc: new Date(),
          },
        });
      }

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/anthropometry?page=1&limit=10`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(3);
      expect(res.body.meta.totalItems).toBe(3);
      // Sắp xếp ngày đo giảm dần: bản ghi ngày 2026-03-15 đứng đầu
      expect(res.body.data[0].measuredDate).toContain('2026-03-15');
    });
  });

  describe('Scenario 2: Sub-resource Medical Records (Bệnh án & ICD-10)', () => {
    it('2.1 Bác sĩ A lưu hồ sơ bệnh án lâm sàng -> 201 Created, Layer 3 verify benh_nhan_benh_an', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Phạm Bệnh Án',
          gioi_tinh: 'NAM',
          tao_luc: new Date(),
        },
      });

      const recordPayload = {
        examDate: '2026-10-27',
        reason: 'Khám định kỳ & tư vấn dinh dưỡng bệnh đái tháo đường',
        primaryDiagnosis: 'Đái tháo đường týp 2 có biến chứng mạch máu ngoại vi',
        icd10Code: 'E11.5',
        clinicalSymptoms: 'Mệt mỏi, tê bì đầu chi, khát nhiều, sụt cân nhẹ',
        medicalHistory: 'Phát hiện tiểu đường 3 năm, đang dùng Metformin 500mg',
        treatmentPlan: 'Kiểm soát carbohydrate < 50% tổng năng lượng, tăng cường chất xơ hòa tan',
        notes: 'Tái khám sau 1 tháng kèm xét nghiệm HbA1c',
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(recordPayload)
        .expect(201);

      // Layer 2: API Contract Envelope
      const body = res.body.data;
      expect(body).toHaveProperty('id');
      expect(body.patientId).toBe(patient.id.toString());
      expect(body.primaryDiagnosis).toBe('Đái tháo đường týp 2 có biến chứng mạch máu ngoại vi');
      expect(body.icd10Code).toBe('E11.5');
      expect(body.treatmentPlan).toBe(
        'Kiểm soát carbohydrate < 50% tổng năng lượng, tăng cường chất xơ hòa tan',
      );
      expect(body.doctorName).toBe(doctorAUser.ten_dang_nhap);

      const recordId = BigInt(body.id);

      // Layer 3: DIRECT DATABASE STATE PERSISTENCE ASSERTION (GOLDEN LAW)
      const dbRecord = await helper.getPrisma().benh_nhan_benh_an.findUnique({
        where: { id: recordId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.chan_doan_chinh).toBe('Đái tháo đường týp 2 có biến chứng mạch máu ngoại vi');
      expect(dbRecord?.ma_icd10).toBe('E11.5');
      expect(dbRecord?.bac_si_kham_id).toBe(doctorAUser.id);
    });

    it('2.2 Lấy danh sách hồ sơ khám bệnh phân trang qua GET /api/patients/:id/medical-records', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Đặng Hồ Sơ',
          gioi_tinh: 'NU',
          tao_luc: new Date(),
        },
      });

      // Tạo 2 bệnh án
      await helper.getPrisma().benh_nhan_benh_an.create({
        data: {
          benh_nhan_id: patient.id,
          ngay_kham: new Date('2026-08-01'),
          chan_doan_chinh: 'Viêm dạ dày cấp',
          bac_si_kham_id: doctorAUser.id,
          tao_luc: new Date(),
        },
      });
      await helper.getPrisma().benh_nhan_benh_an.create({
        data: {
          benh_nhan_id: patient.id,
          ngay_kham: new Date('2026-09-01'),
          chan_doan_chinh: 'Viêm dạ dày mạn',
          bac_si_kham_id: doctorAUser.id,
          tao_luc: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/medical-records?page=1&limit=10`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.totalItems).toBe(2);
      expect(res.body.data[0].primaryDiagnosis).toBe('Viêm dạ dày mạn');
    });
  });

  describe('Scenario 3: Proactive Delete Guard (Ràng Buộc Khóa Ngoại Toàn Vẹn)', () => {
    it('3.1 Chặn xóa bệnh nhân đang có thực đơn liên kết (thuc_don) -> Ném 409 Conflict mã PAT_003', async () => {
      // 1. Tạo bệnh nhân
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Bệnh Nhân Có Thực Đơn',
          gioi_tinh: 'NAM',
          tao_luc: new Date(),
        },
      });

      // 2. Tạo thực đơn liên kết tới bệnh nhân
      await helper.getPrisma().thuc_don.create({
        data: {
          ten_thuc_don: 'Thực đơn tiểu đường tháng 10',
          nguoi_dung_id: doctorAUser.id,
          benh_nhan_id: patient.id,
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
        },
      });

      // 3. Cố tình xóa bệnh nhân -> BẮT BUỘC BỊ CHẶN 409 CONFLICT
      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_003');

      // Layer 3: Bệnh nhân vẫn còn nguyên vẹn trong CSDL
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.deleted_at).toBeNull();
    });

    it('3.2 Chặn xóa bệnh nhân đang có nhật ký ăn uống (khau_phan_24h) -> Ném 409 Conflict mã PAT_003', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Bệnh Nhân Có Khẩu Phần 24h',
          gioi_tinh: 'NU',
          tao_luc: new Date(),
        },
      });

      // Tạo nhật ký khẩu phần 24h
      await helper.getPrisma().khau_phan_24h.create({
        data: {
          benh_nhan_id: patient.id,
          nguoi_dung_id: doctorAUser.id,
          ngay_an: new Date('2026-10-25'),
          kieu_nhap: 'BY_MEAL',
          tao_luc: new Date(),
        },
      });

      // Thử xóa bệnh nhân -> Bị chặn 409 Conflict
      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_003');

      // Layer 3: Kiểm tra DB không bị xóa
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbPatient?.deleted_at).toBeNull();
    });

    it('3.3 Xóa an toàn khi bệnh nhân không có ràng buộc dữ liệu -> 200 OK & Layer 3 verify soft delete', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Bệnh Nhân Độc Lập Sạch',
          gioi_tinh: 'NAM',
          tao_luc: new Date(),
        },
      });

      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.success).toBe(true);

      // Layer 3: Direct database check - soft deleted
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbPatient).toBeNull(); // Prisma extension filter returns null for soft deleted
    });
  });

  describe('Scenario 4: IDOR Defense Guard (Attacker Doctor B vs Victim Doctor A)', () => {
    let victimPatient: any;

    beforeEach(async () => {
      victimPatient = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorAUser.id,
          ho_ten: 'Nạn Nhân Của Bác Sĩ A',
          so_dien_thoai: '0909999999',
          ma_benh_nhan_bv: '0909999999',
          gioi_tinh: 'NAM',
          can_nang: 65,
          chieu_cao: 170,
          tao_luc: new Date(),
        },
      });
    });

    it('4.1 Bác sĩ B cố đọc chi tiết bệnh nhân của BS A -> 403 Forbidden mã PAT_001', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${victimPatient.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_001');
    });

    it('4.2 Bác sĩ B cố cập nhật bệnh nhân của BS A -> 403 Forbidden mã PAT_001', async () => {
      const res = await request(helper.getHttpServer())
        .put(`/api/patients/${victimPatient.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ fullName: 'Tên Bị Hack' })
        .expect(403);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_001');

      // Layer 3: Database không bị sửa
      const dbRecord = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: victimPatient.id },
      });
      expect(dbRecord?.ho_ten).toBe('Nạn Nhân Của Bác Sĩ A');
    });

    it('4.3 Bác sĩ B cố xóa bệnh nhân của BS A -> 403 Forbidden mã PAT_001', async () => {
      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${victimPatient.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_001');

      // Layer 3: Database không bị xóa
      const dbRecord = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: victimPatient.id },
      });
      expect(dbRecord?.deleted_at).toBeNull();
    });

    it('4.4 Bác sĩ B cố đọc hoặc thêm chỉ số nhân trắc học của bệnh nhân BS A -> 403 Forbidden mã PAT_001', async () => {
      // Đọc
      await request(helper.getHttpServer())
        .get(`/api/patients/${victimPatient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      // Thêm
      await request(helper.getHttpServer())
        .post(`/api/patients/${victimPatient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ weight: 70, height: 175 })
        .expect(403);
    });

    it('4.5 Bác sĩ B cố đọc hoặc thêm bệnh án của bệnh nhân BS A -> 403 Forbidden mã PAT_001', async () => {
      // Đọc
      await request(helper.getHttpServer())
        .get(`/api/patients/${victimPatient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      // Thêm
      await request(helper.getHttpServer())
        .post(`/api/patients/${victimPatient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ primaryDiagnosis: 'Chẩn đoán trái phép' })
        .expect(403);
    });

    it('4.6 Truy cập bệnh nhân không tồn tại (ID = 999999999) -> 404 Not Found mã PAT_001', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients/999999999')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(404);

      const errCode = res.body?.error?.code || res.body?.code;
      expect(errCode).toBe('PAT_001');
    });

    it('4.7 Quản trị viên (Admin) có quyền hợp lệ xem bất kỳ bệnh nhân nào của Bác sĩ A', async () => {
      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${victimPatient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(victimPatient.id.toString());
      expect(res.body.data.fullName).toBe('Nạn Nhân Của Bác Sĩ A');
    });
  });
});
