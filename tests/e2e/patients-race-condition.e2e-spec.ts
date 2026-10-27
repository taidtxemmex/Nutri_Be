import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';

jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 5 TEST SUITE 2: PATIENTS RACE CONDITION & CONCURRENCY ALLOCATOR
 * ============================================================================
 * Targets:
 * - 20 concurrent requests (Promise.all) creating patients with the SAME phone number
 * - Zero duplicate codes allocated (strictly unique codes)
 * - Sequential allocation: 0912345678, 0912345678-02, ..., 0912345678-20
 * - Gap-filling verification when an intermediate code is deleted
 * - Multi-Doctor isolation: Doctor A and Doctor B each have independent code sequence
 * - Mandatory 3-Layer Assertions (HTTP -> Payload Envelope -> Direct MySQL DB Query)
 * ============================================================================
 */
describe('Sprint 5 Suite 2: Patients Race Condition & Code Allocator (Task 5.2)', () => {
  const helper = new TestAppHelper();

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
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_nhan_trac`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan_benh_an`;').catch(() => {});
    await prisma.$executeRawUnsafe('DELETE FROM `benh_nhan`;').catch(() => {});
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    await helper.cleanDatabase();

    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const docA = await helper.createTestUser({
      username: `doc_race_a_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'BS Nguyễn Tuấn Vũ - Race A',
    });
    doctorAToken = docA.token;
    doctorAUser = docA.user;

    const docB = await helper.createTestUser({
      username: `doc_race_b_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'BS Trần Lan Hương - Race B',
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

  describe('Scenario 1: Concurrency Hammering (20 Concurrent Requests with Same Phone Number)', () => {
    it('1.1 Bắn đồng thời 20 request tạo bệnh nhân cùng SĐT 0912345678 -> Không bao giờ trùng mã, cấp tuần tự từ -02 đến -20', async () => {
      const TARGET_PHONE = '0912345678';
      const CONCURRENCY_COUNT = 20;

      // 1. Chuẩn bị 20 payload đồng thời
      const requests = Array.from({ length: CONCURRENCY_COUNT }, (_, index) => {
        const payload = {
          fullName: `Bệnh Nhân Cùng Số #${index + 1}`,
          phoneNumber: TARGET_PHONE,
          autoGenerateCode: true,
          gender: index % 2 === 0 ? 'NAM' : 'NU',
          weight: 60.0 + (index % 10),
          height: 165.0,
          activityFactor: 1.4,
          note: `Concurrent request #${index + 1}`,
        };

        return request(helper.getHttpServer())
          .post('/api/patients')
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send(payload);
      });

      // 2. Kích nổ 20 request song song dồn dập qua Promise.all
      const responses = await Promise.all(requests);

      // Layer 1: HTTP Status Code Validation (100% request phải thành công 201 Created)
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Layer 2: API Contract Envelope & Unique Code Assertions
      const allocatedCodes = responses.map((res) => res.body.data.patientCode);
      const allocatedIds = responses.map((res) => res.body.data.id);

      // KHẲNG ĐỊNH: Không có bất kỳ 2 mã bệnh nhân nào bị trùng lặp!
      const uniqueCodesSet = new Set(allocatedCodes);
      expect(uniqueCodesSet.size).toBe(CONCURRENCY_COUNT);

      // Khẳng định mã đầu tiên là chính SĐT, các mã tiếp theo có đuôi -02 đến -20
      expect(allocatedCodes).toContain(TARGET_PHONE);

      const expectedSuffixes = Array.from({ length: CONCURRENCY_COUNT - 1 }, (_, i) => {
        const num = i + 2;
        return `${TARGET_PHONE}-${num < 10 ? '0' + num : num}`;
      });

      for (const suffix of expectedSuffixes) {
        expect(allocatedCodes).toContain(suffix);
      }

      // Layer 3: Direct Database State Persistence Assertion (Golden Law)
      // Truy vấn trực tiếp MySQL bảng benh_nhan để chứng minh tính bền vững
      const dbPatients = await helper.getPrisma().benh_nhan.findMany({
        where: {
          nguoi_dung_id: doctorAUser.id,
          so_dien_thoai: TARGET_PHONE,
          deleted_at: null,
        },
        select: {
          id: true,
          ma_benh_nhan_bv: true,
          ho_ten: true,
        },
      });

      expect(dbPatients.length).toBe(CONCURRENCY_COUNT);

      const dbCodes = dbPatients.map((p) => p.ma_benh_nhan_bv);
      const dbUniqueCodes = new Set(dbCodes);
      expect(dbUniqueCodes.size).toBe(CONCURRENCY_COUNT);
      expect(dbCodes).toContain(TARGET_PHONE);

      for (const suffix of expectedSuffixes) {
        expect(dbCodes).toContain(suffix);
      }
    });
  });

  describe('Scenario 2: Gap-Filling Verification (Lấp chỗ trống sau khi xóa)', () => {
    it('2.1 Xóa bệnh nhân trung gian mang mã -02 -> Bệnh nhân mới tạo cùng SĐT tự động lấp vào mã -02 khuyết', async () => {
      const PHONE = '0933112233';

      // 1. Tạo 3 bệnh nhân cùng SĐT: sẽ nhận PHONE, PHONE-02, PHONE-03
      const p1 = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Bệnh Nhân Số 1',
          phoneNumber: PHONE,
          autoGenerateCode: true,
          gender: 'NAM',
          weight: 65,
          height: 170,
        })
        .expect(201);
      expect(p1.body.data.patientCode).toBe(PHONE);

      const p2 = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Bệnh Nhân Số 2',
          phoneNumber: PHONE,
          autoGenerateCode: true,
          gender: 'NU',
          weight: 52,
          height: 160,
        })
        .expect(201);
      expect(p2.body.data.patientCode).toBe(`${PHONE}-02`);

      const p3 = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Bệnh Nhân Số 3',
          phoneNumber: PHONE,
          autoGenerateCode: true,
          gender: 'NAM',
          weight: 70,
          height: 175,
        })
        .expect(201);
      expect(p3.body.data.patientCode).toBe(`${PHONE}-03`);

      // 2. Xóa bệnh nhân số 2 (mang mã -02)
      await request(helper.getHttpServer())
        .delete(`/api/patients/${p2.body.data.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      // Layer 3 verify soft delete
      const dbP2 = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(p2.body.data.id) },
      });
      expect(dbP2?.deleted_at).not.toBeNull();

      // 3. Tạo bệnh nhân thứ 4 cùng SĐT -> Bắt buộc thuật toán Gap-filling phải lấp vào mã -02 còn khuyết
      const p4 = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Bệnh Nhân Thứ 4 (Lấp khuyết)',
          phoneNumber: PHONE,
          autoGenerateCode: true,
          gender: 'NAM',
          weight: 68,
          height: 172,
        })
        .expect(201);

      expect(p4.body.data.patientCode).toBe(`${PHONE}-02`);

      // Layer 3 DB Verification
      const activePatients = await helper.getPrisma().benh_nhan.findMany({
        where: {
          nguoi_dung_id: doctorAUser.id,
          so_dien_thoai: PHONE,
          deleted_at: null,
        },
        select: { ma_benh_nhan_bv: true },
      });
      const activeCodes = activePatients.map((p) => p.ma_benh_nhan_bv);
      expect(activeCodes).toEqual(expect.arrayContaining([PHONE, `${PHONE}-02`, `${PHONE}-03`]));
    });
  });

  describe('Scenario 3: Multi-Doctor Code Space Isolation', () => {
    it('3.1 Bác sĩ A và Bác sĩ B cùng dùng SĐT 0944556677 -> Mỗi bác sĩ được cấp mã gốc 0944556677 độc lập', async () => {
      const COMMON_PHONE = '0944556677';

      // Doctor A tạo bệnh nhân
      const resA = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Bệnh Nhân Của BS A',
          phoneNumber: COMMON_PHONE,
          autoGenerateCode: true,
          gender: 'NAM',
          weight: 65,
          height: 170,
        })
        .expect(201);

      // Doctor B tạo bệnh nhân với cùng SĐT
      const resB = await request(helper.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          fullName: 'Bệnh Nhân Của BS B',
          phoneNumber: COMMON_PHONE,
          autoGenerateCode: true,
          gender: 'NU',
          weight: 55,
          height: 162,
        })
        .expect(201);

      // Cả 2 đều nhận mã chính SĐT vì mã bệnh nhân được scope độc lập theo bác sĩ điều trị
      expect(resA.body.data.patientCode).toBe(COMMON_PHONE);
      expect(resB.body.data.patientCode).toBe(COMMON_PHONE);

      // Layer 3 Verification
      const dbA = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(resA.body.data.id) },
      });
      const dbB = await helper.getPrisma().benh_nhan.findUnique({
        where: { id: BigInt(resB.body.data.id) },
      });

      expect(dbA?.nguoi_dung_id).toBe(doctorAUser.id);
      expect(dbB?.nguoi_dung_id).toBe(doctorBUser.id);
      expect(dbA?.ma_benh_nhan_bv).toBe(COMMON_PHONE);
      expect(dbB?.ma_benh_nhan_bv).toBe(COMMON_PHONE);
    });
  });
});
