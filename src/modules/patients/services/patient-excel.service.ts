import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TAG_PATIENTS } from '../../../config/constants/cache.constants';
import { PatientCodeAllocator } from './patient-code-allocator.service';
import { AnthropometryEngine } from './anthropometry.service';
import { ExcelStreamReader, ErrorRowItem } from '../../../core/excel-engine';
import { ExcelSecurityUtil } from '../../../security/excel/excel-security.util';

@Injectable()
export class PatientExcelService {
  private readonly logger = new Logger(PatientExcelService.name);

  private readonly EXPECTED_HEADERS = [
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

  private readonly ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9];

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * 1. Tải Template mẫu Excel import bệnh nhân
   * Bộ đệm CacheService 30 phút (0ms) & CWE-22 Path Traversal Protection
   */
  async getTemplateBuffer(): Promise<Buffer> {
    const cacheKey = 'patient:import-template:buffer';
    if (this.cacheService) {
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('🚀 [Cache Hit] Trả về template bệnh nhân từ CacheService (0ms)');
        return Buffer.from(cached, 'base64');
      }
    }

    const safeFileName = path.basename('Template_import_benh_nhan.xlsx');
    const templateLocations = [
      path.resolve(process.cwd(), 'public/uploads/public/templates', safeFileName),
      path.resolve(
        process.cwd(),
        '../server-old/backend/src/main/resources/templates',
        safeFileName,
      ),
      path.resolve(process.cwd(), 'src/main/resources/templates', safeFileName),
    ];

    let buffer: Buffer | null = null;
    for (const loc of templateLocations) {
      if (fs.existsSync(loc)) {
        buffer = await fs.promises.readFile(loc);
        break;
      }
    }

    if (!buffer) {
      // Nếu không tìm thấy file có sẵn, sinh động template bằng ExcelJS
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Benh_nhan');
      sheet.addRow(this.EXPECTED_HEADERS);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF107C41' },
      };
      sheet.columns.forEach((col) => (col.width = 20));

      // Thêm dòng ví dụ mẫu
      sheet.addRow([
        '0901234567',
        'Nguyễn Văn Mẫu',
        'Nam',
        '15/06/1985',
        65.5,
        170.0,
        1.55,
        '0901234567',
        'Ví dụ dòng mẫu hợp lệ',
      ]);

      buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    }

    if (this.cacheService && buffer && buffer.length <= 5 * 1024 * 1024) {
      await this.cacheService.set(cacheKey, buffer.toString('base64'), 1800, CACHE_TAG_PATIENTS);
      this.logger.debug('💾 Đã lưu template bệnh nhân vào CacheService (TTL 30m, tag=patients)');
    }

    return buffer;
  }

  /**
   * 2. Import danh sách bệnh nhân từ file Excel
   */
  async importExcel(
    fileBuffer: Buffer,
    currentUser: { id: string },
  ): Promise<{
    success: boolean;
    message: string;
    count?: number;
    total?: number;
    imported?: number;
    skipped?: number;
    errorFileBuffer?: Buffer;
    errorFileName?: string;
  }> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File không có dữ liệu để import');
    }

    // 1. Chuẩn bị allocator mã bệnh nhân từ DB (Pre-fetch in-memory O(1))
    const existingPatients = await this.prisma.benh_nhan.findMany({
      where: { nguoi_dung_id: currentUser.id, deleted_at: null },
      select: { ma_benh_nhan_bv: true, so_dien_thoai: true },
    });
    const existingCodes = existingPatients
      .map((p) => p.ma_benh_nhan_bv)
      .filter(Boolean) as string[];
    const existingPhones = existingPatients
      .map((p) => p.so_dien_thoai)
      .filter(Boolean) as string[];

    const allocator = new PatientCodeAllocator(existingCodes, existingPhones);
    const codesInFile = new Set<string>();

    // 2. Khởi tạo reader streaming O(1) RAM
    let reader: any;
    try {
      reader = ExcelStreamReader.createReader(fileBuffer);
    } catch {
      throw new BadRequestException('File không đúng định dạng Excel (.xlsx)');
    }

    let targetWorksheetFound = false;
    let dataRowCount = 0;
    let hasAnyError = false;
    const validPatientsData: any[] = [];
    const errorRowItems: ErrorRowItem[] = [];

    try {
      for await (const worksheetReader of reader) {
        let isTargetSheet = false;

        for await (const row of worksheetReader) {
          const rowNumber = row.number;

          if (rowNumber === 1) {
            const h: string[] = [];
            for (let c = 1; c <= 9; c++) {
              h.push(String(row.getCell(c)?.value || '').trim());
            }

            const isHeaderValid = this.EXPECTED_HEADERS.every(
              (expected, index) => h[index] === expected,
            );
            if (isHeaderValid) {
              isTargetSheet = true;
              targetWorksheetFound = true;
            }
            continue;
          }

          if (!isTargetSheet) continue;

          // Kiểm tra dòng có dữ liệu
          let hasData = false;
          const rawRowValues: any[] = [];
          for (let c = 1; c <= 9; c++) {
            const val = row.getCell(c)?.value;
            rawRowValues.push(val !== undefined ? val : '');
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              hasData = true;
            }
          }

          if (!hasData) continue;

          dataRowCount++;
          if (dataRowCount > 1000) {
            throw new BadRequestException('Chỉ cho phép import tối đa 1000 bệnh nhân / file');
          }

          const errors: string[] = [];
          const code = this.getCleanString(row.getCell(1).value);
          const fullName = this.getCleanString(row.getCell(2).value);
          const genderRaw = this.getCleanString(row.getCell(3).value);
          const dobRaw = row.getCell(4).value;
          const weightRaw = row.getCell(5).value;
          const heightRaw = row.getCell(6).value;
          const activityRaw = row.getCell(7).value;
          const phoneRaw = this.getCleanString(row.getCell(8).value);
          const note = this.getCleanString(row.getCell(9).value);

          // 1. Mã BN
          if (code) {
            if (code.length > 50) errors.push('Mã bệnh nhân tối đa 50 ký tự');
            else if (codesInFile.has(code)) errors.push('Trùng mã bệnh nhân trong file');
            else if (existingCodes.includes(code))
              errors.push('Mã bệnh nhân đã tồn tại trong hệ thống');
            codesInFile.add(code);
            allocator.reserve(code);
          }

          // 2. Họ tên
          if (!fullName) errors.push('Họ tên không được để trống');
          else if (fullName.length > 255) errors.push('Họ tên quá dài (tối đa 255 ký tự)');

          // 3. Giới tính
          let gender = 'NAM';
          if (!genderRaw) {
            errors.push('Giới tính không được để trống');
          } else {
            const g = genderRaw.toLowerCase();
            if (g === 'nam') gender = 'NAM';
            else if (g === 'nữ' || g === 'nu') gender = 'NU';
            else errors.push('Giới tính phải là Nam hoặc Nữ');
          }

          // 4. Ngày sinh
          let dobDate: Date | null = null;
          let birthYearOnly = false;
          if (!dobRaw) {
            errors.push('Ngày sinh không được để trống');
          } else {
            const parsed = this.parseDobValue(dobRaw);
            if (parsed.error) errors.push(parsed.error);
            else {
              dobDate = parsed.date;
              birthYearOnly = parsed.birthYearOnly;
            }
          }

          // 5. Cân nặng & Chiều cao
          const weight = Number(weightRaw);
          if (!weightRaw || isNaN(weight) || weight <= 0 || weight > 500) {
            errors.push('Cân nặng phải lớn hơn 0 và không quá 500 kg');
          }

          const height = Number(heightRaw);
          if (!heightRaw || isNaN(height) || height <= 0 || height > 300) {
            errors.push('Chiều cao phải lớn hơn 0 và không quá 300 cm');
          }

          // 6. Hệ số hoạt động
          const activity = this.parseActivityFactor(activityRaw);
          if (activity === null) {
            errors.push('Hệ số hoạt động không hợp lệ (chọn 1.2, 1.375, 1.55, 1.725, 1.9)');
          }

          // 7. Số điện thoại
          let phone = '';
          if (!phoneRaw) {
            errors.push('Số điện thoại không được để trống');
          } else {
            phone = phoneRaw.replace(/[\s.-]/g, '');
            if (/^[1-9]\d{8}$/.test(phone)) phone = '0' + phone;
            if (!/^\d{10}$/.test(phone)) {
              errors.push('Số điện thoại phải đủ 10 chữ số');
            }
          }

          // Sinh mã tự động nếu code trống
          let finalCode = code;
          if (!code && phone) {
            finalCode = allocator.next(phone);
          }

          if (errors.length > 0) {
            hasAnyError = true;
          } else {
            validPatientsData.push({
              nguoi_dung_id: currentUser.id,
              ma_benh_nhan_bv: finalCode,
              ho_ten: fullName,
              so_dien_thoai: phone,
              ngay_sinh: dobDate,
              chi_nam_sinh: birthYearOnly,
              gioi_tinh: gender,
              can_nang: weight,
              chieu_cao: height,
              he_so_hoat_dong: activity,
              ghi_chu: note,
              deleted_at: null,
              tao_luc: new Date(),
            });
          }

          errorRowItems.push({
            rowNumber,
            rawValues: rawRowValues,
            errors,
            successNote: !code ? `Hợp lệ (Mã tự sinh: ${finalCode})` : 'Hợp lệ',
          });
        }
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('File không đúng định dạng Excel (.xlsx)');
    }

    if (!targetWorksheetFound) {
      throw new BadRequestException('Template không đúng. Vui lòng dùng file mẫu tải từ hệ thống');
    }

    if (dataRowCount === 0) {
      throw new BadRequestException('File không có dữ liệu để import');
    }

    // NẾU CÓ LỖI: TRẢ VỀ FILE KẾT QUẢ TÔ ĐỎ (ROLLBACK TOÀN BỘ)
    if (hasAnyError) {
      const errorBuffer = await ExcelStreamReader.generateErrorWorkbook({
        headers: this.EXPECTED_HEADERS,
        rows: errorRowItems,
        sheetName: 'Benh_nhan',
        resultHeaderTitle: 'Kết quả import',
        resultColumnWidth: 40,
      });

      return {
        success: false,
        message: 'Import thất bại, vui lòng tải file để xem chi tiết lỗi',
        errorFileBuffer: errorBuffer,
        errorFileName: 'patient_import_result.xlsx',
        total: dataRowCount,
        imported: 0,
        skipped: 0,
      };
    }

    // NẾU HỢP LỆ: COMMIT TẤT CẢ VÀO CSDL THEO BATCH (Rule 20 BATCH_SIZE=100)
    // Tự động tính toán thể trạng AnthropometryEngine và lưu bản ghi nhân trắc ban đầu
    const BATCH_SIZE = 100;
    for (let i = 0; i < validPatientsData.length; i += BATCH_SIZE) {
      const chunk = validPatientsData.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(async (tx) => {
        for (const p of chunk) {
          const patient = await tx.benh_nhan.create({ data: p });

          // Đánh giá thể trạng qua AnthropometryEngine nếu có cân nặng & chiều cao
          if (p.can_nang && p.chieu_cao) {
            const bmiResult = AnthropometryEngine.calculateBmi(p.can_nang, p.chieu_cao);
            const age = AnthropometryEngine.calculateExactAge(p.ngay_sinh, p.chi_nam_sinh);
            const isMale = p.gioi_tinh === 'NAM';
            const bmr = AnthropometryEngine.calculateBmr(isMale, p.can_nang, p.chieu_cao, age);
            const tdee = AnthropometryEngine.calculateTdee(
              isMale,
              p.can_nang,
              p.chieu_cao,
              age,
              p.he_so_hoat_dong || 1.2,
            );

            await tx.benh_nhan_nhan_trac.create({
              data: {
                benh_nhan_id: patient.id,
                ngay_do: new Date(),
                can_nang: p.can_nang,
                chieu_cao: p.chieu_cao,
                bmi: bmiResult.bmi ?? 0,
                phan_loai_bmi: bmiResult.bmiStatus || 'Bình thường',
                bmr: bmr > 0 ? bmr : null,
                tdee: tdee > 0 ? tdee : null,
                he_so_hoat_dong: p.he_so_hoat_dong,
                nguoi_tao_id: currentUser.id,
              },
            });
          }
        }
      });
    }

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([CACHE_TAG_PATIENTS]);
    }

    return {
      success: true,
      message: `Import thành công ${validPatientsData.length} bệnh nhân`,
      count: validPatientsData.length,
      total: validPatientsData.length,
      imported: validPatientsData.length,
      skipped: 0,
    };
  }

  private getCleanString(val: any): string | null {
    if (val == null) return null;
    let str: string;
    if (typeof val === 'object' && val !== null) {
      if ('formula' in val) {
        str = String(val.formula || val.result || '').trim();
      } else if ('result' in val) {
        str = String(val.result || '').trim();
      } else if ('text' in val) {
        str = String(val.text || '').trim();
      } else {
        str = String(val).trim();
      }
    } else {
      str = String(val).trim();
    }
    if (str.length === 0) return null;
    if (/^[=+@\-\t\r]/.test(str)) {
      str = "'" + str;
    }
    return str;
  }

  private parseDobValue(val: any): {
    date: Date | null;
    birthYearOnly: boolean;
    error: string | null;
  } {
    const currentYear = new Date().getFullYear();
    if (val instanceof Date) {
      if (val.getFullYear() < 1900 || val.getFullYear() > currentYear) {
        return { date: null, birthYearOnly: false, error: 'Năm sinh không hợp lệ' };
      }
      return { date: val, birthYearOnly: false, error: null };
    }

    const str = String(val).trim();
    if (/^\d{4}$/.test(str)) {
      const y = parseInt(str, 10);
      if (y < 1900 || y > currentYear)
        return { date: null, birthYearOnly: false, error: 'Năm sinh phải từ 1900' };
      return { date: new Date(y, 0, 1), birthYearOnly: true, error: null };
    }

    // Hỗ trợ định dạng ISO YYYY-MM-DD hoặc YYYY/MM/DD
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)) {
      const [y, m, d] = str.split(/[\/\-]/).map(Number);
      const dt = new Date(y, m - 1, d);
      if (
        isNaN(dt.getTime()) ||
        dt.getFullYear() !== y ||
        dt.getMonth() !== m - 1 ||
        dt.getDate() !== d
      ) {
        return {
          date: null,
          birthYearOnly: false,
          error: 'Ngày sinh không đúng định dạng (dd/MM/yyyy hoặc yyyy-MM-dd)',
        };
      }
      if (dt > new Date()) {
        return { date: null, birthYearOnly: false, error: 'Ngày sinh không được ở tương lai' };
      }
      return { date: dt, birthYearOnly: false, error: null };
    }

    // Hỗ trợ định dạng Việt Nam DD/MM/YYYY hoặc DD-MM-YYYY
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getDate() !== d) {
        return {
          date: null,
          birthYearOnly: false,
          error: 'Ngày sinh không đúng định dạng (dd/MM/yyyy)',
        };
      }
      if (dt > new Date()) {
        return { date: null, birthYearOnly: false, error: 'Ngày sinh không được ở tương lai' };
      }
      return { date: dt, birthYearOnly: false, error: null };
    }

    return {
      date: null,
      birthYearOnly: false,
      error: 'Ngày sinh không hợp lệ (dd/MM/yyyy hoặc yyyy)',
    };
  }

  private parseActivityFactor(val: any): number | null {
    if (val == null) return null;
    const str = String(val);
    const match = str.match(/(\d+(?:[.,]\d+)?)\s*$/);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      for (const factor of this.ACTIVITY_FACTORS) {
        if (Math.abs(factor - num) < 1e-4) return factor;
      }
    }
    return null;
  }
}
