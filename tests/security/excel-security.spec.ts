import {
  BadRequestException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  ExcelSecurityUtil,
  ExcelMagicByteValidationPipe,
  getExcelMulterOptions,
} from '../../src/security/excel';

describe('ExcelSecurity & Validation Engine Unit Tests (CWE-1236 & Magic Bytes)', () => {
  describe('ExcelSecurityUtil (Formula Injection Defense)', () => {
    it('should sanitize cell values using sanitizeCell alias across all dangerous characters (=, @, -, +, \\t, \\r, %, |)', () => {
      const dangerousInputs = [
        { raw: '=1+1', expected: "'=1+1" },
        { raw: '@SUM(A1:A10)', expected: "'@SUM(A1:A10)" },
        { raw: "-cmd|' /C calc'!A0", expected: "'-cmd|' /C calc'!A0" },
        { raw: '+123', expected: "'+123" },
        { raw: '\t=cmd', expected: "'\t=cmd" },
        { raw: '\r-exec', expected: "'\r-exec" },
        { raw: '%SYSTEMROOT%', expected: "'%SYSTEMROOT%" },
        { raw: '|calc', expected: "'|calc" },
      ];

      for (const item of dangerousInputs) {
        expect(ExcelSecurityUtil.sanitizeCell(item.raw)).toBe(item.expected);
        expect(ExcelSecurityUtil.sanitizeCellValue(item.raw)).toBe(item.expected);
      }
    });

    it('should sanitize entire rows via sanitizeRow turning all formula payloads into raw text', () => {
      const maliciousRow = [
        '=1+1',
        '@SUM(A1:A10)',
        "-cmd|' /C calc'!A0",
        '+123',
        '\t=malicious',
        '\r-attack',
        '%WINDIR%',
        '|payload',
        42,
        true,
        'Bình thường',
      ];

      const sanitizedRow = ExcelSecurityUtil.sanitizeRow(maliciousRow);
      expect(sanitizedRow).toEqual([
        "'=1+1",
        "'@SUM(A1:A10)",
        "'-cmd|' /C calc'!A0",
        "'+123",
        "'\t=malicious",
        "'\r-attack",
        "'%WINDIR%",
        "'|payload",
        42,
        true,
        'Bình thường',
      ]);
    });

    it('should prepend apostrophe to formulas starting with =', () => {
      const payload = '=1+1';
      const sanitized = ExcelSecurityUtil.sanitizeCellValue(payload);
      expect(sanitized).toBe("'=1+1");
    });

    it('should prepend apostrophe to formulas starting with @', () => {
      const payload = '@SUM(A1:A10)';
      const sanitized = ExcelSecurityUtil.sanitizeCellValue(payload);
      expect(sanitized).toBe("'@SUM(A1:A10)");
    });

    it('should prepend apostrophe to DDE command injection starting with -', () => {
      const payload = "-cmd|' /C calc'!A0";
      const sanitized = ExcelSecurityUtil.sanitizeCellValue(payload);
      expect(sanitized).toBe("'-cmd|' /C calc'!A0");
    });

    it('should prepend apostrophe to formulas starting with +', () => {
      const payload = '+123';
      const sanitized = ExcelSecurityUtil.sanitizeCellValue(payload);
      expect(sanitized).toBe("'+123");
    });

    it('should prepend apostrophe to pipes, tabs, carriage returns, and percents', () => {
      expect(ExcelSecurityUtil.sanitizeCellValue('|calc')).toBe("'|calc");
      expect(ExcelSecurityUtil.sanitizeCellValue('\t=1+1')).toBe("'\t=1+1");
      expect(ExcelSecurityUtil.sanitizeCellValue('\r-CMD')).toBe("'\r-CMD");
      expect(ExcelSecurityUtil.sanitizeCellValue('%USERPROFILE%')).toBe("'%USERPROFILE%");
    });

    it('should handle strings with leading whitespace before dangerous prefixes', () => {
      expect(ExcelSecurityUtil.sanitizeCellValue('   =SUM(1,2)')).toBe("'   =SUM(1,2)");
      expect(ExcelSecurityUtil.sanitizeCellValue('  +cmd')).toBe("'  +cmd");
    });

    it('should preserve primitive types (numbers, booleans, Date, null, undefined)', () => {
      expect(ExcelSecurityUtil.sanitizeCellValue(42)).toBe(42);
      expect(ExcelSecurityUtil.sanitizeCellValue(-15.5)).toBe(-15.5);
      expect(ExcelSecurityUtil.sanitizeCellValue(0)).toBe(0);
      expect(ExcelSecurityUtil.sanitizeCellValue(true)).toBe(true);
      expect(ExcelSecurityUtil.sanitizeCellValue(false)).toBe(false);
      expect(ExcelSecurityUtil.sanitizeCellValue(null)).toBeNull();
      expect(ExcelSecurityUtil.sanitizeCellValue(undefined)).toBeUndefined();

      const now = new Date();
      expect(ExcelSecurityUtil.sanitizeCellValue(now)).toBe(now);
    });

    it('should keep normal benign strings unchanged', () => {
      expect(ExcelSecurityUtil.sanitizeCellValue('Nguyễn Văn A')).toBe('Nguyễn Văn A');
      expect(ExcelSecurityUtil.sanitizeCellValue('Bệnh nhân 01')).toBe('Bệnh nhân 01');
      expect(ExcelSecurityUtil.sanitizeCellValue('Thịt bò loại 1')).toBe('Thịt bò loại 1');
    });

    it('should sanitize whole array rows correctly via sanitizeRow', () => {
      const row = ['=2+2', 100, 'Bình thường', '-DDE|command', true];
      const sanitized = ExcelSecurityUtil.sanitizeRow(row);
      expect(sanitized).toEqual(["'=2+2", 100, 'Bình thường', "'-DDE|command", true]);
    });

    it('should sanitize object records correctly via sanitizeRecord / sanitizeObject', () => {
      const record = {
        name: '=cmd|calc',
        age: 30,
        note: '@AVERAGE(B1:B5)',
        status: 'Active',
      };
      const sanitized = ExcelSecurityUtil.sanitizeRecord(record);
      expect(sanitized).toEqual({
        name: "'=cmd|calc",
        age: 30,
        note: "'@AVERAGE(B1:B5)",
        status: 'Active',
      });
    });

    it('should truncate strings exceeding MAX_CELL_LENGTH (1000 chars)', () => {
      const longStr = 'A'.repeat(1200);
      const sanitized = ExcelSecurityUtil.sanitizeCellValue(longStr);
      expect(typeof sanitized).toBe('string');
      expect((sanitized as string).length).toBe(1000);
    });

    it('should detect formula payloads via isFormulaPayload', () => {
      expect(ExcelSecurityUtil.isFormulaPayload('=cmd')).toBe(true);
      expect(ExcelSecurityUtil.isFormulaPayload('+123')).toBe(true);
      expect(ExcelSecurityUtil.isFormulaPayload('Normal string')).toBe(false);
      expect(ExcelSecurityUtil.isFormulaPayload(12345)).toBe(false);
    });
  });

  describe('ExcelMagicByteValidationPipe (File Upload Gate)', () => {
    let pipe: ExcelMagicByteValidationPipe;

    beforeEach(() => {
      pipe = new ExcelMagicByteValidationPipe();
    });

    it('should reject missing file or empty buffer (0 bytes) with 400 Bad Request', async () => {
      await expect(pipe.transform(null as any)).rejects.toThrow(BadRequestException);
      await expect(pipe.transform({ buffer: null } as any)).rejects.toThrow(BadRequestException);
      await expect(pipe.transform({ buffer: Buffer.from([]) } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        pipe.transform({ buffer: Buffer.alloc(0), originalname: 'empty.xlsx' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 10);
      await expect(pipe.transform({ buffer: largeBuffer } as any)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('should reject legacy OLE2 XLS file (D0 CF 11 E0)', async () => {
      const ole2Buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      await expect(pipe.transform({ buffer: ole2Buffer } as any)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('should reject fake .xlsx containing Linux ELF binary executable', async () => {
      // ELF Magic bytes: 0x7F, 'E', 'L', 'F' (7F 45 4C 46)
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const file: Express.Multer.File = {
        buffer: elfBuffer,
        originalname: 'trojan_payload.xlsx',
      } as any;
      await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
    });

    it('should reject fake .xlsx containing Windows PE binary executable (MZ)', async () => {
      // PE Magic bytes: 'M', 'Z' (4D 5A)
      const peBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      const file: Express.Multer.File = {
        buffer: peBuffer,
        originalname: 'ransomware.xlsx',
      } as any;
      await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
    });

    it('should reject non-ZIP files (e.g. text or random binary)', async () => {
      const textBuffer = Buffer.from('Plain text file not excel');
      await expect(pipe.transform({ buffer: textBuffer } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept valid OpenXML zip archive (PK\\x03\\x04)', async () => {
      // 50 4B 03 04 followed by standard benign zip payload
      const validZipBuffer = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00,
      ]);
      const file: Express.Multer.File = {
        buffer: validZipBuffer,
        originalname: 'test_report.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: validZipBuffer.length,
      } as any;

      const result = await pipe.transform(file);
      expect(result).toBe(file);
    });

    it('should reject zip archive containing embedded VBA macros (vbaProject.bin)', async () => {
      const macroZipBuffer = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('xl/vbaProject.bin embedded macro binary payload'),
      ]);
      const file: Express.Multer.File = {
        buffer: macroZipBuffer,
        originalname: 'macro_exploit.xlsx',
      } as any;

      await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
      try {
        await pipe.transform(file);
      } catch (err: any) {
        expect(err.getResponse().code).toBe('EXCEL_SECURITY_VIOLATION');
      }
    });

    it('should reject zip archive containing macroEnabled markup', async () => {
      const macroZipBuffer = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('application/vnd.ms-excel.sheet.macroEnabled.main+xml'),
      ]);
      const file: Express.Multer.File = {
        buffer: macroZipBuffer,
        originalname: 'macro_sheet.xlsx',
      } as any;

      await expect(pipe.transform(file)).rejects.toThrow(BadRequestException);
      try {
        await pipe.transform(file);
      } catch (err: any) {
        expect(err.getResponse().code).toBe('EXCEL_SECURITY_VIOLATION');
      }
    });
  });

  describe('getExcelMulterOptions (Multer Filter)', () => {
    const multerOptions = getExcelMulterOptions();

    it('should accept .xlsx extension', (done) => {
      const file = { originalname: 'clinical_report.xlsx' } as Express.Multer.File;
      multerOptions.fileFilter(null, file, (err, accepted) => {
        expect(err).toBeNull();
        expect(accepted).toBe(true);
        done();
      });
    });

    it('should reject legacy .xls extension', (done) => {
      const file = { originalname: 'legacy_data.xls' } as Express.Multer.File;
      multerOptions.fileFilter(null, file, (err, accepted) => {
        expect(err).toBeInstanceOf(UnsupportedMediaTypeException);
        expect(accepted).toBe(false);
        done();
      });
    });

    it('should reject .xlsm and .xlsb extensions', (done) => {
      const file = { originalname: 'malicious.xlsm' } as Express.Multer.File;
      multerOptions.fileFilter(null, file, (err, accepted) => {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(accepted).toBe(false);
        done();
      });
    });
  });
});
