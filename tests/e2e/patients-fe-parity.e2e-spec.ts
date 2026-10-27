import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';

/**
 * ============================================================================
 * SPRINT 5 TEST SUITE 1: NUTRI-FE PARITY & CONTRACT COMPATIBILITY
 * ============================================================================
 * Targets:
 * - 100% Compatibility with NutriFE components: PatientTable.jsx, PatientFormDialog.jsx, usePatients.js
 * - bmiLevel CSS class keys: underweight, normal, overweight, obese1, obese2, obese3
 * - bmiStatus Vietnamese descriptions
 * - dob / dateOfBirth aliases, birthYearOnly boolean flag
 * - note / notes aliases
 * - Gregorian civil age and Mifflin-St Jeor TDEE calculation
 * - Mandatory 3-Layer Assertions (HTTP Route -> Payload Envelope -> MySQL DB)
 * ============================================================================
 */
describe('Sprint 5 Suite 1: NutriFE Parity & Contract Compatibility (Task 5.1)', () => {
  const helper = new TestAppHelper();

  let doctorToken: string;
  let doctorUser: any;

  // Mirroring NutriFE PatientTable.jsx BMI_CLASS registry
  const FE_BMI_CLASS: Record<string, string> = {
    underweight: 'bmiUnderweight',
    normal: 'bmiNormal',
    overweight: 'bmiOverweight',
    obese1: 'bmiObese1',
    obese2: 'bmiObese2',
    obese3: 'bmiObese3',
  };

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();
    await prisma.$connect();
  });

  beforeEach(async () => {
    const prisma = helper.getPrisma();
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_nhan_trac`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_benh_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const doc = await helper.createTestUser({
      username: `doc_fe_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'BS Chuyên Khoa FE Parity',
    });
    doctorToken = doc.token;
    doctorUser = doc.user;
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

  describe('Scenario 1: NutriFE Form Submission (PatientFormDialog.jsx) & Field Aliases', () => {
    it('1.1 FE tạo bệnh nhân bằng dateOfBirth, note, autoGenerateCode: true -> Layer 3 verify MySQL', async () => {
      // FE Payload exactly as emitted by PatientFormDialog.jsx handleSubmit
      const fePayload = {
        autoGenerateCode: true,
        patientCode: null,
        fullName: 'Nguyễn Văn Parity',
        phoneNumber: '0981112233',
        dateOfBirth: '1992-08-20',
        birthYearOnly: false,
        gender: 'NAM',
        weight: 68.0,
        height: 170.0,
        activityFactor: 1.55,
        note: 'Bệnh nhân khám sức khỏe định kỳ theo form NutriFE',
      };

      // Layer 1: HTTP Status Code 201 Created
      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(fePayload)
        .expect(201);

      // Layer 2: Payload Integrity & Contract Aliases Validation
      const body = res.body.data;
      expect(body).toHaveProperty('id');
      expect(body.fullName).toBe('Nguyễn Văn Parity');
      expect(body.phoneNumber).toBe('0981112233');
      expect(body.patientCode).toBe('0981112233');
      expect(body.dob).toBe('1992-08-20');
      expect(body.dateOfBirth).toBe('1992-08-20');
      expect(body.birthYearOnly).toBe(false);
      expect(body.gender).toBe('NAM');
      expect(body.weight).toBe(68.0);
      expect(body.height).toBe(170.0);
      expect(body.activityFactor).toBe(1.55);
      expect(body.note).toBe('Bệnh nhân khám sức khỏe định kỳ theo form NutriFE');
      expect(body.notes).toBe('Bệnh nhân khám sức khỏe định kỳ theo form NutriFE');

      // Parity check with FE CSS mapping:
      expect(body.bmi).toBeCloseTo(23.5, 1);
      expect(body.bmiLevel).toBe('overweight');
      expect(FE_BMI_CLASS[body.bmiLevel]).toBe('bmiOverweight');
      expect(body.bmiStatus).toBe('Thừa cân');

      // TDEE calculation check: BMR = 10*68 + 6.25*170 - 5*age + 5
      expect(body.age).toBeGreaterThanOrEqual(30);
      expect(body.tdee).toBeGreaterThan(1800);

      const patientId = BigInt(body.id);

      // Layer 3: Direct Database State Persistence Assertion (Golden Law)
      const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: patientId },
      });
      expect(dbPatient).not.toBeNull();
      expect(dbPatient?.ho_ten).toBe('Nguyễn Văn Parity');
      expect(dbPatient?.so_dien_thoai).toBe('0981112233');
      expect(dbPatient?.ma_benh_nhan_bv).toBe('0981112233');
      expect(dbPatient?.ghi_chu).toBe('Bệnh nhân khám sức khỏe định kỳ theo form NutriFE');
      expect(dbPatient?.chi_nam_sinh).toBe(false);
      expect(Number(dbPatient?.can_nang)).toBe(68.0);
      expect(Number(dbPatient?.chieu_cao)).toBe(170.0);
    });

    it('1.2 FE tạo bệnh nhân chỉ có năm sinh (birthYearOnly: true) -> Layer 3 verify chi_nam_sinh', async () => {
      const payload = {
        autoGenerateCode: true,
        fullName: 'Bà Cụ U80',
        phoneNumber: '0988776655',
        dateOfBirth: '1945',
        birthYearOnly: true,
        gender: 'NU',
        weight: 48.0,
        height: 152.0,
        activityFactor: 1.2,
        note: 'Chỉ nhớ năm sinh 1945',
      };

      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(payload)
        .expect(201);

      const body = res.body.data;
      expect(body.birthYearOnly).toBe(true);
      expect(body.dob).toBe('1945-01-01');
      expect(body.dateOfBirth).toBe('1945-01-01');
      expect(body.gender).toBe('NU');

      const currentYear = new Date().getFullYear();
      expect(body.age).toBe(currentYear - 1945);

      // Layer 3 Assertion
      const dbRecord = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(body.id) },
      });
      expect(dbRecord?.chi_nam_sinh).toBe(true);
      expect(dbRecord?.ngay_sinh?.toISOString().slice(0, 10)).toBe('1945-01-01');
    });

    it('1.3 FE cập nhật thông tin bệnh nhân qua PUT bằng note và dateOfBirth -> Layer 3 verify', async () => {
      // 1. Khởi tạo bệnh nhân trước
      const created = await helper.getPrisma().benh_nhan.create({
        data: {
          nguoi_dung_id: doctorUser.id,
          ho_ten: 'Lê Văn Cũ',
          so_dien_thoai: '0919998877',
          ma_benh_nhan_bv: '0919998877',
          gioi_tinh: 'NAM',
          can_nang: 60.0,
          chieu_cao: 165.0,
          ghi_chu: 'Ghi chú ban đầu',
          tao_luc: new Date(),
        },
      });

      // 2. Gọi PUT cập nhật bằng FE schema
      const updatePayload = {
        fullName: 'Lê Văn Cũ Mới',
        note: 'Đã cập nhật chế độ ăn kiêng',
        dateOfBirth: '1988-11-15',
        birthYearOnly: false,
        weight: 62.5,
        height: 165.0,
      };

      const res = await request(helper.getHttpServer())
        .put(`/api/patients/${created.id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.fullName).toBe('Lê Văn Cũ Mới');
      expect(res.body.data.note).toBe('Đã cập nhật chế độ ăn kiêng');
      expect(res.body.data.dateOfBirth).toBe('1988-11-15');
      expect(res.body.data.weight).toBe(62.5);

      // Layer 3 Assertion
      const dbUpdated = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: created.id },
      });
      expect(dbUpdated?.ho_ten).toBe('Lê Văn Cũ Mới');
      expect(dbUpdated?.ghi_chu).toBe('Đã cập nhật chế độ ăn kiêng');
      expect(Number(dbUpdated?.can_nang)).toBe(62.5);
    });
  });

  describe('Scenario 2: Toàn diện 6 Phân nhóm BMI Chuẩn CSS NutriFE (Task 5.1 Requirement)', () => {
    const bmiTestCases = [
      {
        name: 'Thiếu cân (underweight)',
        weight: 42.0,
        height: 160.0,
        expectedBmi: 16.4,
        expectedLevel: 'underweight',
        expectedClass: 'bmiUnderweight',
        expectedStatus: 'Thiếu cân',
      },
      {
        name: 'Bình thường (normal)',
        weight: 56.0,
        height: 160.0,
        expectedBmi: 21.9,
        expectedLevel: 'normal',
        expectedClass: 'bmiNormal',
        expectedStatus: 'Bình thường',
      },
      {
        name: 'Thừa cân (overweight)',
        weight: 62.0,
        height: 160.0,
        expectedBmi: 24.2,
        expectedLevel: 'overweight',
        expectedClass: 'bmiOverweight',
        expectedStatus: 'Thừa cân',
      },
      {
        name: 'Béo phì độ I (obese1)',
        weight: 70.0,
        height: 160.0,
        expectedBmi: 27.3,
        expectedLevel: 'obese1',
        expectedClass: 'bmiObese1',
        expectedStatus: 'Béo phì độ I',
      },
      {
        name: 'Béo phì độ II (obese2)',
        weight: 82.0,
        height: 160.0,
        expectedBmi: 32.0,
        expectedLevel: 'obese2',
        expectedClass: 'bmiObese2',
        expectedStatus: 'Béo phì độ II',
      },
      {
        name: 'Béo phì độ III (obese3)',
        weight: 98.0,
        height: 160.0,
        expectedBmi: 38.3,
        expectedLevel: 'obese3',
        expectedClass: 'bmiObese3',
        expectedStatus: 'Béo phì độ III',
      },
    ];

    for (const tc of bmiTestCases) {
      it(`2.X Kiểm tra phân loại ${tc.name} -> bmiLevel=${tc.expectedLevel}, CSS class không bị undefined`, async () => {
        const payload = {
          fullName: `BN Test ${tc.expectedLevel}`,
          gender: 'NAM',
          weight: tc.weight,
          height: tc.height,
          phoneNumber: '0970000000',
          autoGenerateCode: false,
          patientCode: `CODE-${tc.expectedLevel.toUpperCase()}`,
        };

        const res = await request(helper.getHttpServer())
          .post('/api/patients')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send(payload)
          .expect(201);

        const data = res.body.data;
        expect(data.bmi).toBeCloseTo(tc.expectedBmi, 1);
        expect(data.bmiLevel).toBe(tc.expectedLevel);
        expect(data.bmiStatus).toBe(tc.expectedStatus);

        // Đảm bảo ánh xạ FE BMI_CLASS[patient.bmiLevel] KHÔNG BAO GIỜ bị undefined!
        expect(FE_BMI_CLASS[data.bmiLevel]).toBe(tc.expectedClass);

        // Layer 3 Assertion
        const dbPatient = await helper.getPrisma().benh_nhan.findUnique({
          where: { id: BigInt(data.id) },
        });
        expect(dbPatient).not.toBeNull();
        expect(Number(dbPatient?.can_nang)).toBe(tc.weight);
        expect(Number(dbPatient?.chieu_cao)).toBe(tc.height);
      });
    }
  });

  describe('Scenario 3: Persona Attack Injections (Amateur Hacker & Stupid Bot)', () => {
    it('3.1 Amateur Hacker: Tiêm mã XSS script tags và SQLi quote vào trường fullName và note -> Lưu an toàn, không thực thi mã', async () => {
      const hackerPayload = {
        fullName: '<script>alert("XSS")</script>',
        phoneNumber: '0989998888',
        autoGenerateCode: true,
        gender: 'NAM',
        weight: 65.0,
        height: 170.0,
        note: '\'; DROP TABLE benh_nhan; --',
      };

      const res = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(hackerPayload)
        .expect(201);

      expect(res.body.data.fullName).toBe('<script>alert("XSS")</script>');
      expect(res.body.data.note).toBe('\'; DROP TABLE benh_nhan; --');

      // Layer 3 DB check: Bảng `benh_nhan` còn nguyên vẹn, bản ghi lưu dạng text an toàn
      const count = await helper.getPrisma().benh_nhan.count();
      expect(count).toBeGreaterThan(0);

      const dbRow = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(res.body.data.id) },
      });
      expect(dbRow?.ho_ten).toBe('<script>alert("XSS")</script>');
      expect(dbRow?.ghi_chu).toBe('\'; DROP TABLE benh_nhan; --');
    });

    it('3.2 Stupid Bot: Gửi 15 request dồn dập đọc danh sách /api/patients -> Server đáp ứng ổn định 200 OK', async () => {
      const requests = Array.from({ length: 15 }, () =>
        request(helper.getHttpServer())
          .get('/api/patients')
          .set('Authorization', `Bearer ${doctorToken}`)
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('3.3 Boundary Value Analysis (BVA): Cân nặng và chiều cao vượt ngưỡng cho phép -> Bị chặn 400 Bad Request', async () => {
      // Cân nặng âm
      await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          fullName: 'BVA Weight Negative',
          gender: 'NAM',
          weight: -5,
          height: 170,
        })
        .expect(400);

      // Chiều cao > 300cm
      await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          fullName: 'BVA Height Giant',
          gender: 'NAM',
          weight: 70,
          height: 350,
        })
        .expect(400);
    });
  });
});
