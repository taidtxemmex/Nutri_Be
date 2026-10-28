import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import { TestAppHelper } from '../helpers/test-app.helper';
import { IntakeInputType } from '../../src/config/enums/domain.enum';
import { ExcelThrottleGuard } from '../../src/security/excel/excel-throttle.guard';

jest.setTimeout(60000);

describe('Sprint 6: Multi-Patient Excel Export & Route Aliases E2E Suite', () => {
  const helper = new TestAppHelper();

  let regularToken: string;
  let regularUser: any;
  let testPatient: any;
  let category: any;
  let ingredient1: any;
  let ingredient2: any;
  let intakeRecord: any;

  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  beforeAll(async () => {
    await helper.init();
    const prisma = helper.getPrisma();

    // 1. Tạo user test
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const regular = await helper.createTestUser({
      username: `doctor_exp_${uniqueSuffix}`,
      role: 'USER',
      password: 'P@ssw0rd123!',
      fullName: 'Bác Sĩ Test Export',
    });
    regularToken = regular.token;
    regularUser = regular.user;

    // 2. Tạo category test
    category = await prisma.danh_muc.create({
      data: {
        ten_danh_muc: `Nhóm Test Export ${Date.now()}`,
      },
    });

    // 3. Tạo nguyên liệu test
    ingredient1 = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: `Nguyên Liệu Thực Vật ${Date.now()}`,
        danh_muc: category.id,
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 14.0,
        protein: 8.0,
        fat: 1.0,
        ash: 1.0,
        fiber: 0.5,
      },
    });

    ingredient2 = await prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: `Nguyên Liệu Động Vật ${Date.now()}`,
        danh_muc: category.id,
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 70.0,
        protein: 20.0,
        fat: 5.0,
        ash: 1.0,
        fiber: 0.0,
      },
    });

    // 4. Tạo bệnh nhân test
    testPatient = await prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: regularUser.id,
        ho_ten: 'Bệnh Nhân Test Multi Export',
        gioi_tinh: 'NAM',
        ngay_sinh: new Date('1990-05-15'),
        ma_benh_nhan_bv: `BN-EXP-${Date.now()}`,
      },
    });

    // 5. Tạo khẩu phần ăn 24h test
    intakeRecord = await prisma.khau_phan_24h.create({
      data: {
        benh_nhan_id: testPatient.id,
        nguoi_dung_id: regularUser.id,
        ngay_an: new Date('2026-10-15T00:00:00.000Z'),
        kieu_nhap: IntakeInputType.BY_MEAL,
        ghi_chu: 'Khẩu phần test xuất báo cáo',
        khau_phan_24h_bua_an: {
          create: [
            {
              thu_tu_bua: 1,
              ten_bua: 'Bữa sáng',
              gio_an: '07:30',
              khau_phan_24h_nguyen_lieu: {
                create: [
                  {
                    nguyen_lieu_id: ingredient1.id,
                    khoi_luong_song_sach: 100,
                  },
                  {
                    nguyen_lieu_id: ingredient2.id,
                    khoi_luong_song_sach: 150,
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const prisma = helper.getPrisma();
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
      if (intakeRecord) {
        await prisma
          .$executeRawUnsafe(
            `DELETE FROM \`khau_phan_24h_nguyen_lieu\` WHERE \`khau_phan_24h_bua_an_id\` IN (SELECT \`id\` FROM \`khau_phan_24h_bua_an\` WHERE \`khau_phan_24h_id\` = ${intakeRecord.id});`,
          )
          .catch(() => {});
        await prisma
          .$executeRawUnsafe(
            `DELETE FROM \`khau_phan_24h_bua_an\` WHERE \`khau_phan_24h_id\` = ${intakeRecord.id};`,
          )
          .catch(() => {});
        await prisma
          .$executeRawUnsafe(`DELETE FROM \`khau_phan_24h\` WHERE \`id\` = ${intakeRecord.id};`)
          .catch(() => {});
      }
      if (testPatient) {
        await prisma
          .$executeRawUnsafe(`DELETE FROM \`benh_nhan\` WHERE \`id\` = ${testPatient.id};`)
          .catch(() => {});
      }
      if (ingredient1 && ingredient2) {
        await prisma
          .$executeRawUnsafe(
            `DELETE FROM \`nguyen_lieu\` WHERE \`id\` IN (${ingredient1.id}, ${ingredient2.id});`,
          )
          .catch(() => {});
      }
      if (category) {
        await prisma
          .$executeRawUnsafe(`DELETE FROM \`danh_muc\` WHERE \`id\` = ${category.id};`)
          .catch(() => {});
      }
      if (regularUser) {
        await prisma
          .$executeRawUnsafe(
            `DELETE FROM \`ho_so_ca_nhan\` WHERE \`nguoi_dung_id\` = '${regularUser.id}';`,
          )
          .catch(() => {});
        await prisma
          .$executeRawUnsafe(`DELETE FROM \`nguoi_dung\` WHERE \`id\` = '${regularUser.id}';`)
          .catch(() => {});
      }
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch {}
    await helper.close();
  });

  let ipCounter = 1;
  const getClientIp = () => `10.0.9.${ipCounter++}`;

  beforeEach(() => {
    ExcelThrottleGuard.resetActiveJobs();
  });

  describe('1. Ràng buộc dải ngày y tế (Days <= 31, HTTP 422)', () => {
    it('chặn xuất báo cáo khi dải ngày > 31 ngày (HTTP 422 EXPORT_DATE_RANGE_EXCEEDED)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .send({
          templateType: 1,
          fromDate: '2026-10-01',
          toDate: '2026-11-15', // 46 ngày
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EXPORT_DATE_RANGE_EXCEEDED');
      expect(res.body.error.message).toContain('31 ngày');
    });

    it('chặn xuất báo cáo khi fromDate > toDate (HTTP 400 INVALID_DATE_RANGE)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .send({
          templateType: 1,
          fromDate: '2026-10-25',
          toDate: '2026-10-10',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('2. Mẫu 1: TOTAL_FOOD_GROUP_MULTI_PATIENTS', () => {
    it('xuất file Excel mẫu 1 thành công qua POST /api/daily-intakes/export', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .buffer(true)
        .parse(binaryBufferParser)
        .send({
          templateType: 1,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('tong_hop_nhom_thuc_pham.xlsx');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(1000);
    });

    it('xuất file Excel mẫu 1 thành công qua alias POST /api/daily-intake/export', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intake/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .buffer(true)
        .parse(binaryBufferParser)
        .send({
          templateType: 1,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('tong_hop_nhom_thuc_pham.xlsx');
    });
  });

  describe('3. Mẫu 2: AVG_GROUP_WEIGHT_PER_PATIENT', () => {
    it('xuất file Excel mẫu 2 thành công', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .buffer(true)
        .parse(binaryBufferParser)
        .send({
          templateType: 2,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain(
        'trung_binh_nhom_thuc_pham_tren_nguoi.xlsx',
      );
    });
  });

  describe('4. Mẫu 3: DAILY_NUTRIENT_INTAKE_PATIENT', () => {
    it('bắt buộc patientId và mode (HTTP 400)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .send({
          templateType: 3,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXPORT_PATIENT_REQUIRED');
    });

    it('xuất file Excel mẫu 3 thành công khi đầy đủ thông tin (BY_MEAL)', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .buffer(true)
        .parse(binaryBufferParser)
        .send({
          templateType: 3,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
          patientId: testPatient.id.toString(),
          mode: 'BY_MEAL',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('dinh_duong_24h_benh_nhan.xlsx');
    });
  });

  describe('5. Mẫu 4: TOTAL_WEIGHT_FOOD_GROUP_MULTI_PATIENTS', () => {
    it('xuất file Excel mẫu 4 (2 Sheets) thành công', async () => {
      const res = await request(helper.getHttpServer())
        .post('/api/daily-intakes/export')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-Forwarded-For', getClientIp())
        .buffer(true)
        .parse(binaryBufferParser)
        .send({
          templateType: 4,
          fromDate: '2026-10-01',
          toDate: '2026-10-20',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('tong_khoi_luong_nhom_thuc_pham.xlsx');
    });
  });

  describe('6. Layer 3: Database State Assertion', () => {
    it('khẳng định trạng thái dữ liệu trong CSDL khớp với tham số báo cáo', async () => {
      const prisma = helper.getPrisma();
      const count = await prisma.khau_phan_24h.count({
        where: {
          benh_nhan_id: testPatient.id,
          ngay_an: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-20T23:59:59.999Z'),
          },
        },
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
