import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { TestAppHelper } from '../helpers/test-app.helper';
import { UserRole } from '../../src/config/enums/role.enum';

jest.setTimeout(60000);

/**
 * ============================================================================
 * SPRINT 5 TEST SUITE 3: PATIENTS EXCEL IMPORT & FORMULA INJECTION (Task 5.4)
 * ============================================================================
 * Targets:
 * - Formula Injection Defense: =1+1, @SUM, -cmd, +calc sanitized with leading single-quote
 * - Malformed, empty, and invalid header templates rejected with 400 Bad Request
 * - Atomic All-or-Nothing Batch Rollback: 1 invalid row rolls back entire batch (0 committed)
 * - Error file returned with column 10 formatted in red text with detailed reasons
 * - Successful 100% import commits in a single transaction
 * - Mandatory 3-Layer Assertions (HTTP Status -> Payload / Excel -> MySQL DB Query)
 * ============================================================================
 */
describe('Sprint 5 Suite 3: Patients Excel Import & Formula Injection (Task 5.4)', () => {
  const helper = new TestAppHelper();

  let doctorToken: string;
  let doctorUser: any;

  const EXPECTED_HEADERS = [
    'Mã bệnh nhân',
    'Họ tên',
    'Giới tính',
    'Ngày sinh',
    'Cân nặng (kg)',
    'Chiều cao (cm)',
    'Hệ số hoạt động',
    'Số điện thoại',
    'Ghi chú',
  ];

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
      username: `doc_excel_${unique}`,
      role: UserRole.USER,
      password: 'P@ssw0rd123!',
      fullName: 'BS Nguyễn Hải Đăng - Excel QA',
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

  const binaryBufferParser = (res: any, callback: (err: any, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  /**
   * Helper: Sinh buffer Excel từ mảng dữ liệu các dòng
   */
  async function createWorkbookBuffer(rows: any[][], headers = EXPECTED_HEADERS): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Benh_nhan');
    sheet.addRow(headers);
    rows.forEach((r) => sheet.addRow(r));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  describe('Scenario 1: Template Download & Malformed File Attacks', () => {
    it('1.1 Tải template mẫu qua GET /api/patients/import-template -> 200 OK & Header đúng chuẩn', async () => {
      // Layer 1: HTTP Status Code
      const res = await request(helper.getHttpServer())
        .get('/api/patients/import-template')
        .set('Authorization', `Bearer ${doctorToken}`)
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      // Layer 2: Excel binary integrity validation
      expect(res.header['content-type']).toContain('spreadsheetml.sheet');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '').trim()));

      for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
        expect(headers[i]).toBe(EXPECTED_HEADERS[i]);
      }
    });

    it('1.2 Upload file rỗng (0 bytes) -> Bị chặn 400 Bad Request', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', emptyBuffer, 'empty.xlsx')
        .expect(400);
    });

    it('1.3 Upload file sai định dạng hoặc hỏng binary -> Bị chặn 400 Bad Request', async () => {
      const corruptedBuffer = Buffer.from('NOT_A_VALID_EXCEL_ZIP_BINARY_STRING_CONTENT');

      await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', corruptedBuffer, 'corrupted.xlsx')
        .expect(400);
    });

    it('1.4 Upload file có header sai lệch với mẫu chuẩn hệ thống -> Bị từ chối 400 Bad Request', async () => {
      const wrongHeaders = ['Họ Tên Lộn Xộn', 'Cột Không Hợp Lệ', 'Email'];
      const fileBuffer = await createWorkbookBuffer([['A', 'B', 'C']], wrongHeaders);

      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', fileBuffer, 'wrong_headers.xlsx')
        .expect(400);

      const errMsg = res.body?.error?.message || res.body?.message || '';
      expect(errMsg).toContain('Template không đúng');
    });
  });

  describe('Scenario 2: Formula Injection Attack (Amateur Hacker Persona)', () => {
    it('2.1 Tấn công công thức Excel (=1+1, @SUM, -cmd, +calc) -> Bị khử độc an toàn bằng dấu nháy đơn', async () => {
      const injectionRows = [
        [
          '', // mã tự sinh
          '=1+1', // họ tên là formula
          'Nam',
          '15/05/1990',
          70,
          175,
          1.2,
          '0985554433',
          '@SUM(A1:A10)', // note chứa @SUM
        ],
        [
          '-CMD_CODE', // mã chứa - prefix
          '+Dương Văn Tính', // họ tên chứa + prefix
          'Nữ',
          '1995-10-20',
          52,
          160,
          1.55,
          '0985554434',
          '-2+5+cmd|"/C calc"!A0', // note độc hại
        ],
      ];

      const fileBuffer = await createWorkbookBuffer(injectionRows);

      // Layer 1: HTTP 200 OK
      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', fileBuffer, 'injection_test.xlsx')
        .expect(200);

      // Layer 2: API Response Envelope
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);

      // Layer 3: Direct Database State Persistence (Golden Law)
      // Kiểm tra chuỗi trong MySQL đã được prepend nháy đơn an toàn hoặc lưu text nguyên vẹn
      const dbRows = await helper.getPrisma().benh_nhan.findMany({
        where: { nguoi_dung_id: doctorUser.id },
        orderBy: { id: 'asc' },
      });

      expect(dbRows.length).toBe(2);

      // Khẳng định dấu nháy đơn bảo vệ công thức không thực thi
      expect(dbRows[0].ho_ten).toBe("'=1+1");
      expect(dbRows[0].ghi_chu).toBe("'@SUM(A1:A10)");
      expect(dbRows[1].ho_ten).toBe("'+Dương Văn Tính");
      expect(dbRows[1].ghi_chu).toBe('\'-2+5+cmd|"/C calc"!A0');
      expect(dbRows[1].ma_benh_nhan_bv).toBe("'-CMD_CODE");
    });
  });

  describe('Scenario 3: Atomic Batch All-or-Nothing & Error Highlighting', () => {
    it('3.1 File có 1 dòng hợp lệ và 1 dòng sai dữ liệu -> ROLLBACK 100% (0 bản ghi vào DB) & Trả về file kết quả có cột 10 màu đỏ', async () => {
      const mixedRows = [
        [
          '', // Dòng 1: Hợp lệ
          'Nguyễn Văn Hợp Lệ',
          'Nam',
          '10/05/1992',
          65.0,
          170.0,
          1.55,
          '0971234567',
          'Dòng này hoàn toàn hợp lệ',
        ],
        [
          '', // Dòng 2: Sai giới tính ('GAY') và cân nặng âm (-10)
          'Trần Thị Lỗi',
          'KHONG_HOP_LE',
          '15/06/1995',
          -10.0,
          160.0,
          1.2,
          '0971234568',
          'Dòng này bị lỗi',
        ],
      ];

      const fileBuffer = await createWorkbookBuffer(mixedRows);

      // Layer 1: HTTP Status Code 200 (trả về file nhị phân báo lỗi)
      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', fileBuffer, 'batch_fail.xlsx')
        .buffer(true)
        .parse(binaryBufferParser)
        .expect(200);

      // Layer 2: File kết quả có content-disposition attachment
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('patient_import_result.xlsx');

      // Đọc file kết quả trả về để kiểm tra cột 10 (Kết quả import)
      const resultWb = new ExcelJS.Workbook();
      await resultWb.xlsx.load(res.body);
      const resultSheet = resultWb.worksheets[0];

      // Kiểm tra cột 10 của dòng tiêu đề
      expect(resultSheet.getRow(1).getCell(10).value).toBe('Kết quả import');

      // Dòng 2 (dòng dữ liệu 1 - hợp lệ)
      const row1Result = resultSheet.getRow(2).getCell(10);
      expect(String(row1Result.value)).toContain('Hợp lệ');

      // Dòng 3 (dòng dữ liệu 2 - có lỗi)
      const row2Result = resultSheet.getRow(3).getCell(10);
      expect(String(row2Result.value)).toContain('Giới tính phải là Nam hoặc Nữ');
      expect(String(row2Result.value)).toContain('Cân nặng');

      // Kiểm tra màu đỏ (ARGB: FFFF0000)
      expect(row2Result.font?.color?.argb).toBe('FFFF0000');

      // Layer 3: DIRECT DATABASE STATE PERSISTENCE ASSERTION (GOLDEN LAW)
      // KHẲNG ĐỊNH: ZERO bản ghi nào được ghi vào CSDL! Dòng 1 hợp lệ cũng phải bị ROLLBACK triệt để!
      const countInDb = await helper.getPrisma().benh_nhan.count({
        where: { nguoi_dung_id: doctorUser.id },
      });
      expect(countInDb).toBe(0);
    });

    it('3.2 File 100% hợp lệ -> Commit toàn bộ trong 1 transaction và trả về JSON { success: true, count: 3 }', async () => {
      const validRows = [
        [
          'MANUAL-001',
          'Vũ Quang Huy',
          'Nam',
          '1985-04-12',
          72.0,
          175.0,
          1.55,
          '0961112233',
          'Nhập tay mã',
        ],
        [
          '', // Tự sinh theo SĐT
          'Đỗ Thị Thảo',
          'Nữ',
          '1992-09-25',
          50.5,
          158.0,
          1.375,
          '0962223344',
          'Tự sinh mã',
        ],
        [
          '', // Tự sinh cùng SĐT người trước -> sẽ nhận -02
          'Đỗ Văn Con',
          'Nam',
          '2015-01-01',
          30.0,
          135.0,
          1.725,
          '0962223344',
          'Con đi khám cùng mẹ',
        ],
      ];

      const fileBuffer = await createWorkbookBuffer(validRows);

      const res = await request(helper.getHttpServer())
        .post('/api/patients/import')
        .set('Authorization', `Bearer ${doctorToken}`)
        .attach('file', fileBuffer, 'valid_batch.xlsx')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);

      // Layer 3: Database Verification
      const committed = await helper.getPrisma().benh_nhan.findMany({
        where: { nguoi_dung_id: doctorUser.id },
        orderBy: { id: 'asc' },
      });

      expect(committed.length).toBe(3);
      expect(committed[0].ma_benh_nhan_bv).toBe('MANUAL-001');
      expect(committed[1].ma_benh_nhan_bv).toBe('0962223344');
      expect(committed[2].ma_benh_nhan_bv).toBe('0962223344-02');
      expect(committed[0].ho_ten).toBe('Vũ Quang Huy');
      expect(committed[1].ho_ten).toBe('Đỗ Thị Thảo');
      expect(committed[2].ho_ten).toBe('Đỗ Văn Con');
    });
  });
});
