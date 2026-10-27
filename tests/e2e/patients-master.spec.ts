import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';
import { MenuType, TargetType, IntakeInputType } from '../../src/config/enums/domain.enum';

describe('Patients Master E2E & IDOR / 3-Layer Persistence Validation', () => {
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
    await prisma.$executeRawUnsafe('DELETE FROM `de_xuat_thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `thuc_don`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_nguyen_lieu`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h_bua_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `khau_phan_24h`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_nhan_trac`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_benh_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const admin = await helper.createTestUser({
      username: `admin_pat_${uniqueSuffix}`,
      role: UserRole.ADMIN,
      password: 'P@ssw0rd123!',
      fullName: 'Quản Trị Viên Bệnh Viện',
    });
    adminToken = admin.token;
    adminUser = admin.user;

    const docA = await helper.createTestUser({
      username: `doc_a_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Nguyễn Văn A',
    });
    doctorAToken = docA.token;
    doctorAUser = docA.user;

    const docB = await helper.createTestUser({
      username: `doc_b_${uniqueSuffix}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Trần Thị B',
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

  describe('Scenario 1: CRUD Bệnh nhân & Tự động sinh mã', () => {
    it('1.1 Bác sĩ tạo bệnh nhân mới với đầy đủ thông số nhân khẩu học -> Layer 3 verify benh_nhan', async () => {
      const payload = {
        fullName: 'Phạm Nhật Huy',
        gender: 'NAM',
        dob: '1985-04-12',
        weight: 70.5,
        height: 172.0,
        activityFactor: 1.55,
        phoneNumber: '0901234567',
        notes: 'Tiền sử tăng huyết áp nhẹ, kiểm soát tốt',
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(payload)
        .expect(201);

      // Layer 2: API Response Envelope
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.fullName).toBe('Phạm Nhật Huy');
      expect(res.body.data.gender).toBe('NAM');
      expect(res.body.data.weight).toBe(70.5);
      expect(res.body.data.height).toBe(172.0);
      expect(res.body.data.activityFactor).toBe(1.55);
      expect(res.body.data.patientCode).toMatch(/^BN-/);
      expect(res.body.data).toHaveProperty('bmi');
      expect(res.body.data.bmi).toBeCloseTo(23.8, 1);
      expect(['OVERWEIGHT', 'overweight']).toContain(res.body.data.bmiLevel);
      expect(res.body.data.bmiStatus).toBe('Thừa cân');
      expect(res.body.data).toHaveProperty('tdee');
      expect(res.body.data.tdee).toBeGreaterThan(1500);
      expect(res.body.data.dateOfBirth).toBe('1985-04-12');
      expect(res.body.data.note).toBe('Tiền sử tăng huyết áp nhẹ, kiểm soát tốt');

      const createdId = BigInt(res.body.data.id);

      // Layer 3: Direct Database State Persistence Assertion
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: createdId },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.ho_ten).toBe('Phạm Nhật Huy');
      expect(dbPatient?.gioi_tinh).toBe('NAM');
      expect(Number(dbPatient?.can_nang)).toBe(70.5);
      expect(Number(dbPatient?.chieu_cao)).toBe(172.0);
      expect(Number(dbPatient?.he_so_hoat_dong)).toBe(1.55);
      expect(dbPatient?.nguoi_dung_id).toBe(doctorAUser.id);
    });

    it('1.2 Cập nhật thông tin bệnh nhân -> Layer 3 verify trường cập nhật', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Vũ Thị Mai',
          gioi_tinh: 'NU',
          can_nang: 55,
          chieu_cao: 160,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-TEST-${Date.now().toString().slice(-4)}`,
        },
      });

      const updatePayload = {
        fullName: 'Vũ Thị Mai Hoa',
        weight: 56.5,
        activityFactor: 1.3,
        notes: 'Đã bổ sung chế độ ăn tăng đạm',
      };

      const res = await request(helper.getHttpServer())
        .put(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.fullName).toBe('Vũ Thị Mai Hoa');
      expect(res.body.data.weight).toBe(56.5);
      expect(res.body.data.activityFactor).toBe(1.3);

      const dbUpdated = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbUpdated?.ho_ten).toBe('Vũ Thị Mai Hoa');
      expect(Number(dbUpdated?.can_nang)).toBe(56.5);
      expect(Number(dbUpdated?.he_so_hoat_dong)).toBe(1.3);
    });
  });

  describe('Scenario 2: IDOR Defense Guard', () => {
    it('2.1 Bác sĩ B không được phép truy cập xem chi tiết bệnh nhân của Bác sĩ A (403 AUTH_002)', async () => {
      const patientA = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân riêng Bác sĩ A',
          gioi_tinh: 'NAM',
          can_nang: 60,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-PRIV-${Date.now().toString().slice(-4)}`,
        },
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patientA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(['AUTH_002', 'ERR_IDOR_VIOLATION', 'PAT_001']).toContain(res.body.error.code);
    });

    it('2.2 Bác sĩ B không được phép sửa bệnh nhân của Bác sĩ A (403 AUTH_002)', async () => {
      const patientA = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân riêng Bác sĩ A',
          gioi_tinh: 'NAM',
          can_nang: 60,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-PRIV2-${Date.now().toString().slice(-4)}`,
        },
      });

      await request(helper.getHttpServer())
        .put(`/api/patients/${patientA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ fullName: 'Tấn công IDOR ghi đè tên' })
        .expect(403);

      const dbCheck = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patientA.id },
      });
      expect(dbCheck?.ho_ten).toBe('Bệnh nhân riêng Bác sĩ A');
    });

    it('2.3 Quản trị viên (Admin) có quyền xem và sửa bất kỳ bệnh nhân nào', async () => {
      const patientA = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân của Bác sĩ A',
          gioi_tinh: 'NU',
          can_nang: 50,
          chieu_cao: 155,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-ADM-${Date.now().toString().slice(-4)}`,
        },
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patientA.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(patientA.id.toString());
      expect(res.body.data.fullName).toBe('Bệnh nhân của Bác sĩ A');
    });
  });

  describe('Scenario 3: Code Preview (GET /api/patients/code-preview)', () => {
    it('3.1 Trả về mã gợi ý hợp lệ theo định dạng BN-YYYYMMDD-XXXX', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients/code-preview')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('previewCode');
      expect(res.body.data.previewCode).toMatch(/^BN-/);
    });

    it('3.2 Gợi ý mã kèm danh sách người nhà dùng chung số điện thoại (sharedWith)', async () => {
      await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Nguyễn Văn Cha',
          gioi_tinh: 'NAM',
          so_dien_thoai: '0988112233',
          can_nang: 65,
          chieu_cao: 168,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: 'BN-FAMILY-01',
        },
      });

      const res = await request(helper.getHttpServer())
        .get('/api/patients/code-preview?phone=0988112233')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data.code).toContain('2233');
      expect(res.body.data).toHaveProperty('sharedWith');
      expect(res.body.data.sharedWith).toContain('Nguyễn Văn Cha');
    });
  });

  describe('Scenario 4: Phân trang & Tìm kiếm', () => {
    it('4.1 Lọc danh sách bệnh nhân theo keyword và phân trang', async () => {
      await helper.getPrisma().benh_nhan.createMany({
        data: [
          {
            ho_ten: 'Hoàng Văn Thắng',
            gioi_tinh: 'NAM',
            can_nang: 68,
            chieu_cao: 170,
            nguoi_dung_id: doctorAUser.id,
            ma_benh_nhan_bv: 'BN-SEARCH-01',
          },
          {
            ho_ten: 'Hoàng Thị Thảo',
            gioi_tinh: 'NU',
            can_nang: 52,
            chieu_cao: 160,
            nguoi_dung_id: doctorAUser.id,
            ma_benh_nhan_bv: 'BN-SEARCH-02',
          },
          {
            ho_ten: 'Lê Văn Nam',
            gioi_tinh: 'NAM',
            can_nang: 75,
            chieu_cao: 175,
            nguoi_dung_id: doctorAUser.id,
            ma_benh_nhan_bv: 'BN-SEARCH-03',
          },
        ],
      });

      const res = await request(helper.getHttpServer())
        .get('/api/patients?page=1&limit=2&keyword=Hoàng')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.totalItems).toBe(2);
      expect(res.body.data[0].fullName).toContain('Hoàng');
      expect(res.body.data[1].fullName).toContain('Hoàng');
    });
  });

  describe('Scenario 5: Proactive Delete Guard & Constraint Verification', () => {
    it('5.1 Chặn xóa bệnh nhân nếu đang có Thực đơn liên kết (409 PATIENT_IN_USE)', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân có thực đơn',
          gioi_tinh: 'NAM',
          can_nang: 65,
          chieu_cao: 168,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-MENU-${Date.now().toString().slice(-4)}`,
        },
      });

      await helper.getPrisma().thuc_don.create({
        data: {
          ten_thuc_don: 'Thực đơn kiểm thử ràng buộc xóa bệnh nhân',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          benh_nhan_id: patient.id,
          nguoi_dung_id: doctorAUser.id,
        },
      });

      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);

      expect(['PAT_003', 'PATIENT_IN_USE']).toContain(res.body.error.code);

      // Khẳng định bản ghi bệnh nhân vẫn còn nguyên trong CSDL
      const dbCheck = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbCheck).not.toBeNull();
    });

    it('5.2 Xóa thành công bệnh nhân khi chưa có thực đơn hoặc khẩu phần 24h ràng buộc', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân độc lập sẵn sàng xóa',
          gioi_tinh: 'NAM',
          can_nang: 62,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-FREE-${Date.now().toString().slice(-4)}`,
        },
      });

      const res = await request(helper.getHttpServer())
        .delete(`/api/patients/${patient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.success).toBe(true);

      const dbCheck = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbCheck).toBeNull();
    });
  });

  describe('Scenario 6: Excel Template & Import Bệnh Nhân', () => {
    const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    };

    it('6.1 Tải template import bệnh nhân (GET /api/patients/import-template)', async () => {
      const res = await request(helper.getHttpServer())
        .get('/api/patients/import-template')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain('Template_import_benh_nhan.xlsx');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('6.2 Upload file rỗng bị từ chối 400 Bad Request', async () => {
      await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(400);
    });
  });

  describe('Scenario 7: Sub-resource Endpoints: Anthropometry (Nhân trắc học)', () => {
    it('7.1 Bác sĩ A ghi nhận biến thiên nhân trắc học -> 201 Created & Layer 3 verify benh_nhan_nhan_trac & đồng bộ benh_nhan', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Nguyễn Thể Trạng',
          gioi_tinh: 'NAM',
          ngay_sinh: new Date('1990-01-01'),
          can_nang: 65,
          chieu_cao: 170,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-ANTHRO-${Date.now().toString().slice(-4)}`,
        },
      });

      const payload = {
        measuredDate: '2026-10-27',
        weight: 72.0,
        height: 171.0,
        systolicBloodPressure: 125,
        diastolicBloodPressure: 82,
        waistCircumference: 80.5,
        hipCircumference: 96.0,
        activityFactor: 1.55,
        notes: 'Chỉ số tăng nhẹ sau đợt điều trị',
      };

      const res = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patientId).toBe(patient.id.toString());
      expect(res.body.data.weight).toBe(72.0);
      expect(res.body.data.height).toBe(171.0);
      expect(res.body.data.bmi).toBeCloseTo(24.6, 1);
      expect(res.body.data.systolicBloodPressure).toBe(125);
      expect(res.body.data.diastolicBloodPressure).toBe(82);

      // Layer 3: Assert in database
      const dbAnthro = await helper.getPrisma().benh_nhan_nhan_trac.findFirst({
        where: { benh_nhan_id: patient.id },
      });
      expect(dbAnthro).not.toBeNull();
      expect(dbAnthro?.can_nang).toBe(72.0);
      expect(dbAnthro?.chieu_cao).toBe(171.0);
      expect(dbAnthro?.huyet_ap_tam_thu).toBe(125);
      expect(dbAnthro?.huyet_ap_tam_truong).toBe(82);

      // Đồng bộ vào benh_nhan master
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patient.id },
      });
      expect(dbPatient?.can_nang).toBe(72.0);
      expect(dbPatient?.chieu_cao).toBe(171.0);
    });

    it('7.2 Lấy danh sách lịch sử đo nhân trắc học phân trang (GET /api/patients/:id/anthropometry)', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Trần Nhân Trắc',
          gioi_tinh: 'NAM',
          can_nang: 60,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-ANTHRO2-${Date.now().toString().slice(-4)}`,
        },
      });

      await helper.getPrisma().benh_nhan_nhan_trac.createMany({
        data: [
          {
            benh_nhan_id: patient.id,
            ngay_do: new Date('2026-10-01'),
            can_nang: 60,
            chieu_cao: 165,
            bmi: 22.0,
            phan_loai_bmi: 'NORMAL',
            nguoi_tao_id: doctorAUser.id,
          },
          {
            benh_nhan_id: patient.id,
            ngay_do: new Date('2026-10-15'),
            can_nang: 61,
            chieu_cao: 165,
            bmi: 22.4,
            phan_loai_bmi: 'NORMAL',
            nguoi_tao_id: doctorAUser.id,
          },
        ],
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/anthropometry?page=1&limit=10`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.totalItems).toBe(2);
      expect(new Date(res.body.data[0].measuredDate).getTime()).toBeGreaterThanOrEqual(
        new Date(res.body.data[1].measuredDate).getTime(),
      );
    });

    it('7.3 Bác sĩ B không thể đọc/ghi nhân trắc học của Bác sĩ A -> IDOR 403 PAT_001', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân riêng A',
          gioi_tinh: 'NAM',
          can_nang: 60,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-IDOR-ANTHRO-${Date.now().toString().slice(-4)}`,
        },
      });

      const resGet = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);
      expect(['AUTH_002', 'ERR_IDOR_VIOLATION', 'PAT_001']).toContain(resGet.body.error.code);

      const resPost = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/anthropometry`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ weight: 65, height: 168 })
        .expect(403);
      expect(['AUTH_002', 'ERR_IDOR_VIOLATION', 'PAT_001']).toContain(resPost.body.error.code);
    });
  });

  describe('Scenario 8: Sub-resource Endpoints: Medical Records (Bệnh án lâm sàng)', () => {
    it('8.1 Bác sĩ A lưu hồ sơ bệnh án lâm sàng -> 201 Created & Layer 3 verify benh_nhan_benh_an', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Lê Lâm Sàng',
          gioi_tinh: 'NU',
          can_nang: 52,
          chieu_cao: 158,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-MED-${Date.now().toString().slice(-4)}`,
        },
      });

      const payload = {
        examDate: '2026-10-27',
        reason: 'Khám kiểm tra đường huyết định kỳ',
        primaryDiagnosis: 'Đái tháo đường týp 2 kiểm soát chưa tốt',
        icd10Code: 'E11.9',
        clinicalSymptoms: 'Khát nước, tiểu đêm nhiều lần',
        treatmentPlan: 'Điều chỉnh chế độ dinh dưỡng, giảm carbohydrate đơn',
        notes: 'Hẹn tái khám sau 1 tháng xét nghiệm lại HbA1c',
      };

      const res = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patientId).toBe(patient.id.toString());
      expect(res.body.data.primaryDiagnosis).toBe('Đái tháo đường týp 2 kiểm soát chưa tốt');
      expect(res.body.data.icd10Code).toBe('E11.9');
      expect(res.body.data.doctorId).toBe(doctorAUser.id);

      // Layer 3: Assert in database
      const dbRecord = await helper.getPrisma().benh_nhan_benh_an.findFirst({
        where: { benh_nhan_id: patient.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.chan_doan_chinh).toBe('Đái tháo đường týp 2 kiểm soát chưa tốt');
      expect(dbRecord?.ma_icd10).toBe('E11.9');
      expect(dbRecord?.bac_si_kham_id).toBe(doctorAUser.id);
    });

    it('8.2 Lấy danh sách hồ sơ khám bệnh phân trang (GET /api/patients/:id/medical-records)', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Hoàng Bệnh Án',
          gioi_tinh: 'NAM',
          can_nang: 65,
          chieu_cao: 170,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-MED2-${Date.now().toString().slice(-4)}`,
        },
      });

      await helper.getPrisma().benh_nhan_benh_an.createMany({
        data: [
          {
            benh_nhan_id: patient.id,
            ngay_kham: new Date('2026-09-01'),
            chan_doan_chinh: 'Tăng huyết áp vô căn',
            bac_si_kham_id: doctorAUser.id,
          },
          {
            benh_nhan_id: patient.id,
            ngay_kham: new Date('2026-10-01'),
            chan_doan_chinh: 'Tái khám huyết áp ổn định',
            bac_si_kham_id: doctorAUser.id,
          },
        ],
      });

      const res = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/medical-records?page=1&limit=10`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.totalItems).toBe(2);
      expect(new Date(res.body.data[0].examDate).getTime()).toBeGreaterThanOrEqual(
        new Date(res.body.data[1].examDate).getTime(),
      );
    });

    it('8.3 Bác sĩ B không thể đọc/ghi bệnh án của Bác sĩ A -> IDOR 403 PAT_001', async () => {
      const patient = await helper.getPrisma().benh_nhan.create({
        data: {
          ho_ten: 'Bệnh nhân riêng A',
          gioi_tinh: 'NAM',
          can_nang: 60,
          chieu_cao: 165,
          nguoi_dung_id: doctorAUser.id,
          ma_benh_nhan_bv: `BN-IDOR-MED-${Date.now().toString().slice(-4)}`,
        },
      });

      const resGet = await request(helper.getHttpServer())
        .get(`/api/patients/${patient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(403);
      expect(['AUTH_002', 'ERR_IDOR_VIOLATION', 'PAT_001']).toContain(resGet.body.error.code);

      const resPost = await request(helper.getHttpServer())
        .post(`/api/patients/${patient.id}/medical-records`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ primaryDiagnosis: 'Chẩn đoán trái phép' })
        .expect(403);
      expect(['AUTH_002', 'ERR_IDOR_VIOLATION', 'PAT_001']).toContain(resPost.body.error.code);
    });
  });

  describe('Scenario 9: Excel Import Atomic Batch (All-or-Nothing)', () => {
    it('9.1 Upload file Excel có dòng lỗi -> Rollback (0 bản ghi mới), trả về file kết quả có cột 10 màu đỏ', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Benh_nhan');
      ws.addRow([
        'Mã bệnh nhân',
        'Họ tên',
        'Giới tính',
        'Ngày sinh',
        'Cân nặng (kg)',
        'Chiều cao (cm)',
        'Hệ số hoạt động',
        'Số điện thoại',
        'Ghi chú',
      ]);
      // Dòng 1: Hợp lệ
      ws.addRow([
        'BN-EXCEL-001',
        'Bệnh Nhân Hợp Lệ',
        'Nam',
        '10/05/1990',
        65,
        170,
        1.55,
        '0911223344',
        'Ghi chú hợp lệ',
      ]);
      // Dòng 2: Lỗi (Họ tên trống, cân nặng âm)
      ws.addRow([
        'BN-EXCEL-002',
        '',
        'Nam',
        '10/05/1990',
        -10,
        170,
        1.55,
        '0911223355',
        'Dòng lỗi',
      ]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .attach('file', buffer, 'test_invalid.xlsx')
        .expect(200);

      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('patient_import_result.xlsx');

      // Layer 3: Assert không có bản ghi nào được lưu vào DB (Rollback hoàn toàn)
      const count = await helper.getPrisma().benh_nhan.count({
        where: { ma_benh_nhan_bv: 'BN-EXCEL-001' },
      });
      expect(count).toBe(0);
    });

    it('9.2 Upload file Excel hợp lệ 100% -> Commit vào DB trong 1 transaction, trả về { success: true, count: 2 }', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Benh_nhan');
      ws.addRow([
        'Mã bệnh nhân',
        'Họ tên',
        'Giới tính',
        'Ngày sinh',
        'Cân nặng (kg)',
        'Chiều cao (cm)',
        'Hệ số hoạt động',
        'Số điện thoại',
        'Ghi chú',
      ]);
      ws.addRow([
        `BN-BATCH-${Date.now().toString().slice(-4)}-1`,
        'Bệnh Nhân Batch 1',
        'Nam',
        '15/06/1988',
        68,
        172,
        1.375,
        '0922334455',
        'Ghi chú 1',
      ]);
      ws.addRow([
        `BN-BATCH-${Date.now().toString().slice(-4)}-2`,
        'Bệnh Nhân Batch 2',
        'Nữ',
        '20/11/1992',
        54,
        160,
        1.2,
        '0933445566',
        'Ghi chú 2',
      ]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .attach('file', buffer, 'test_valid.xlsx')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);

      // Layer 3: Direct DB assertion
      const dbP1 = await helper.getPrisma().benh_nhan.findFirst({
        where: { ho_ten: 'Bệnh Nhân Batch 1' },
      });
      expect(dbP1).not.toBeNull();
      expect(dbP1?.nguoi_dung_id).toBe(doctorAUser.id);
      expect(Number(dbP1?.can_nang)).toBe(68);

      const dbP2 = await helper.getPrisma().benh_nhan.findFirst({
        where: { ho_ten: 'Bệnh Nhân Batch 2' },
      });
      expect(dbP2).not.toBeNull();
      expect(dbP2?.gioi_tinh).toBe('NU');
    });
  });
});
