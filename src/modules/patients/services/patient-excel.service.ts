import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../core/database/prisma.service';
import { PatientCodeAllocator } from './patient-code-allocator.service';

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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Tải Template mẫu Excel import bệnh nhân
   */
  async getTemplateBuffer(): Promise<Buffer> {
    const templateLocations = [
      path.resolve(process.cwd(), 'public/uploads/public/templates/Template_import_benh_nhan.xlsx'),
      path.resolve(
        process.cwd(),
        '../server-old/backend/src/main/resources/templates/Template_import_benh_nhan.xlsx',
      ),
      path.resolve(process.cwd(), 'src/main/resources/templates/Template_import_benh_nhan.xlsx'),
    ];

    for (const loc of templateLocations) {
      if (fs.existsSync(loc)) {
        return fs.promises.readFile(loc);
      }
    }

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

    return Buffer.from(await workbook.xlsx.writeBuffer());
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
    errorFileBuffer?: Buffer;
    errorFileName?: string;
  }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new BadRequestException('File không đúng định dạng Excel (.xlsx)');
    }

    const sheet = workbook.getWorksheet('Benh_nhan') || workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('File Excel không có sheet dữ liệu');
    }

    // Kiểm tra header
    const firstRow = sheet.getRow(1);
    const headers: string[] = [];
    firstRow.eachCell((cell) => headers.push(String(cell.value || '').trim()));

    const isHeaderValid = this.EXPECTED_HEADERS.every(
      (expected, index) => headers[index] === expected,
    );
    if (!isHeaderValid) {
      throw new BadRequestException('Template không đúng. Vui lòng dùng file mẫu tải từ hệ thống');
    }

    // Lấy các dòng có dữ liệu
    const rows: ExcelJS.Row[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        let hasData = false;
        row.eachCell(() => {
          hasData = true;
        });
        if (hasData) rows.push(row);
      }
    });

    if (rows.length === 0) {
      throw new BadRequestException('File không có dữ liệu để import');
    }
    if (rows.length > 1000) {
      throw new BadRequestException('Chỉ cho phép import tối đa 1000 bệnh nhân / file');
    }

    // Chuẩn bị allocator mã bệnh nhân
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

    // Giữ chỗ trước các mã nhập tay trong file
    rows.forEach((row) => {
      const code = this.getCleanString(row.getCell(1).value);
      if (code) allocator.reserve(code);
    });

    // Cột kết quả import (cột 10)
    const resultColIndex = 10;
    firstRow.getCell(resultColIndex).value = 'Kết quả import';
    sheet.getColumn(resultColIndex).width = 40;

    let hasAnyError = false;
    const validPatientsData: any[] = [];

    // Duyệt từng dòng
    for (const row of rows) {
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

      const resultCell = row.getCell(resultColIndex);
      if (errors.length > 0) {
        hasAnyError = true;
        resultCell.value = errors.join('; ');
        resultCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      } else {
        resultCell.value = !code ? `Hợp lệ (Mã tự sinh: ${finalCode})` : 'Hợp lệ';
        resultCell.font = { color: { argb: 'FF008000' } };

        validPatientsData.push({
          nguoi_dung_id: currentUser.id,
          ma_benh_nhan_bv: finalCode,
          ho_ten: fullName,
          so_dien_thoai: phone,
          ngay_sinh: dobDate,
          gioi_tinh: gender,
          can_nang: weight,
          chieu_cao: height,
          he_so_hoat_dong: activity,
          ghi_chu: note,
          tao_luc: new Date(),
        });
      }
    }

    // NẾU CÓ LỖI: TRẢ VỀ FILE KẾT QUẢ TÔ ĐỎ (ROLLBACK TOÀN BỘ)
    if (hasAnyError) {
      const errorBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return {
        success: false,
        message: 'Import thất bại, vui lòng tải file để xem chi tiết lỗi',
        errorFileBuffer: errorBuffer,
        errorFileName: 'patient_import_result.xlsx',
      };
    }

    // NẾU HỢP LỆ: COMMIT TẤT CẢ VÀO CSDL THEO BATCH
    await this.prisma.$transaction(async (tx) => {
      for (const p of validPatientsData) {
        await tx.benh_nhan.create({ data: p });
      }
    });

    return {
      success: true,
      message: `Import thành công ${validPatientsData.length} bệnh nhân`,
      count: validPatientsData.length,
    };
  }

  private getCleanString(val: any): string | null {
    if (val == null) return null;
    const str = String(val).trim();
    return str.length > 0 ? str : null;
  }

  private parseDobValue(
    val: any,
  ): { date: Date | null; birthYearOnly: boolean; error: string | null } {
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
