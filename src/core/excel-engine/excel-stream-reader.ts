import { Readable, PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { ExcelSecurityUtil } from '../../security/excel/excel-security.util';

export interface SheetSignature {
  name?: string;
  requiredHeaders: string[];
}

export interface DetectedSheet {
  worksheetReader: any;
  sheetName: string;
  headerRowNumber: number;
  headers: string[];
  headerMap: Map<string, number>; // normalized header -> 1-based colIndex
  matchedSignature?: SheetSignature;
}

export interface ErrorRowItem {
  rowNumber: number;
  rawValues: any[];
  errors: string[];
  successNote?: string;
}

export interface GenerateErrorWorkbookOptions {
  headers: string[];
  rows: ErrorRowItem[];
  sheetName?: string;
  resultHeaderTitle?: string;
  resultColumnWidth?: number;
}

export interface ReadCellStringParamDto {
  cell: any;
  sanitize?: boolean;
}

export interface MatchSignatureParamDto {
  actualHeaders: string[];
  requiredHeaders: string[];
}

/**
 * ExcelStreamReader
 * Lõi phân tích file Excel hướng sự kiện O(1) RAM sử dụng ExcelJS WorkbookReader
 * Tích hợp Smart Sheet Signature Detection, Phòng chống Formula Injection (CWE-1236)
 * và Streaming Error Workbook Generator chuẩn y tế Nutri Clinical System
 */
export class ExcelStreamReader {
  /**
   * Tạo WorkbookReader từ Buffer hoặc Readable Stream
   */
  public static createReader(fileInput: Buffer | Readable): any {
    let inputStream: Readable;
    if (Buffer.isBuffer(fileInput)) {
      const pass = new PassThrough();
      pass.end(fileInput);
      inputStream = pass;
    } else {
      inputStream = fileInput;
    }

    // Khởi tạo WorkbookReader với cấu hình streaming tối ưu RAM
    const ExcelJSStream = (ExcelJS as any).stream?.xlsx;
    if (!ExcelJSStream?.WorkbookReader) {
      throw new Error('ExcelJS WorkbookReader is not available in current environment');
    }

    return new ExcelJSStream.WorkbookReader(inputStream, {
      entries: 'emit',
      sharedStrings: 'cache',
      worksheets: 'emit',
    });
  }

  /**
   * Chuẩn hóa chuỗi văn bản tiếng Việt NFC, cắt khoảng trắng và viết thường để so sánh
   */
  public static normalizeKey(text: string): string {
    if (!text) return '';
    return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Đọc giá trị chuỗi từ ô, tự động bóc tách formula/richText, chuẩn hóa NFC và khử độc Formula Injection
   */
  public static readCellString(
    paramOrCell: ReadCellStringParamDto | any,
    legacySanitize = true,
  ): string | null {
    let cell: any;
    let sanitize = true;

    if (
      paramOrCell &&
      typeof paramOrCell === 'object' &&
      'cell' in paramOrCell &&
      (paramOrCell.cell !== undefined || 'sanitize' in paramOrCell)
    ) {
      cell = paramOrCell.cell;
      sanitize = paramOrCell.sanitize !== false;
    } else {
      cell = paramOrCell;
      sanitize = legacySanitize;
    }

    if (cell === null || cell === undefined) return null;

    let rawValue: any = cell;
    if (typeof cell === 'object') {
      if (cell.result !== undefined && cell.result !== null) {
        rawValue = cell.result;
      } else if (cell.text !== undefined && cell.text !== null) {
        rawValue = cell.text;
      } else if (cell.value !== undefined && cell.value !== null) {
        rawValue = cell.value;
      } else if (cell.richText && Array.isArray(cell.richText)) {
        rawValue = cell.richText.map((t: any) => t.text || '').join('');
      }
    }

    if (rawValue === null || rawValue === undefined) return null;

    let str = String(rawValue).normalize('NFC').trim();
    if (str.length === 0) return null;

    if (sanitize) {
      str = ExcelSecurityUtil.sanitizeCellValue(str) as string;
    }

    return str;
  }

  /**
   * Đọc giá trị số an toàn từ ô, hỗ trợ cả dấu phẩy và dấu chấm thập phân
   */
  public static readCellNumber(cell: any): number | null {
    if (cell === null || cell === undefined) return null;

    let rawValue: any = cell;
    if (typeof cell === 'object') {
      if (cell.result !== undefined && cell.result !== null) {
        rawValue = cell.result;
      } else if (cell.value !== undefined && cell.value !== null) {
        rawValue = cell.value;
      } else if (cell.text !== undefined && cell.text !== null) {
        rawValue = cell.text;
      }
    }

    if (rawValue === null || rawValue === undefined || rawValue === '') return null;

    if (typeof rawValue === 'number') {
      return isNaN(rawValue) ? null : rawValue;
    }

    const str = String(rawValue).trim().replace(',', '.');
    const num = Number(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Đọc ngày tháng từ ô (hỗ trợ Date, serial number của Excel, chuỗi dd/MM/yyyy hoặc yyyy)
   */
  public static readCellDate(cell: any): {
    date: Date | null;
    birthYearOnly: boolean;
    error?: string;
  } {
    if (cell === null || cell === undefined) {
      return { date: null, birthYearOnly: false };
    }

    let val: any = cell;
    if (typeof cell === 'object' && !(cell instanceof Date)) {
      val =
        cell.result !== undefined ? cell.result : cell.value !== undefined ? cell.value : cell.text;
    }

    if (val === null || val === undefined || val === '') {
      return { date: null, birthYearOnly: false };
    }

    // 1. Nếu là đối tượng Date
    if (val instanceof Date) {
      if (isNaN(val.getTime())) {
        return { date: null, birthYearOnly: false, error: 'Ngày tháng không hợp lệ' };
      }
      return { date: val, birthYearOnly: false };
    }

    // 2. Nếu là số (Excel date serial number)
    if (typeof val === 'number') {
      const utcDays = Math.floor(val - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (isNaN(date.getTime())) {
        return { date: null, birthYearOnly: false, error: 'Ngày tháng không hợp lệ' };
      }
      return { date, birthYearOnly: false };
    }

    // 3. Nếu là chuỗi
    const str = String(val).trim();
    if (!str) return { date: null, birthYearOnly: false };

    // Năm sinh duy nhất (chỉ gồm 4 chữ số, e.g. "1985")
    if (/^\d{4}$/.test(str)) {
      const year = parseInt(str, 10);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        return {
          date: null,
          birthYearOnly: true,
          error: `Năm sinh phải từ 1900 đến ${currentYear}`,
        };
      }
      return { date: new Date(year, 0, 1), birthYearOnly: true };
    }

    // Định dạng dd/MM/yyyy hoặc d/M/yyyy
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return { date: null, birthYearOnly: false, error: 'Ngày tháng không hợp lệ (dd/MM/yyyy)' };
      }
      return { date, birthYearOnly: false };
    }

    // Định dạng ISO yyyy-MM-dd
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return { date: null, birthYearOnly: false, error: 'Ngày tháng không hợp lệ' };
      }
      return { date, birthYearOnly: false };
    }

    // Fallback qua Date parser
    const fallback = new Date(str);
    if (isNaN(fallback.getTime())) {
      return {
        date: null,
        birthYearOnly: false,
        error: 'Ngày sinh không hợp lệ (dd/MM/yyyy hoặc yyyy)',
      };
    }

    return { date: fallback, birthYearOnly: false };
  }

  /**
   * Đọc giờ phút HH:mm từ ô Excel
   */
  public static readCellTime(cell: any): { time: string | null; error?: string } {
    if (cell === null || cell === undefined) return { time: null };

    let val: any = cell;
    if (typeof cell === 'object' && !(cell instanceof Date)) {
      val =
        cell.result !== undefined ? cell.result : cell.value !== undefined ? cell.value : cell.text;
    }

    if (val === null || val === undefined || val === '') return { time: null };

    // Excel Time fraction (number between 0 and 1)
    if (typeof val === 'number') {
      const fraction = val % 1;
      let totalMinutes = Math.round(fraction * 24 * 60);
      if (totalMinutes === 24 * 60) totalMinutes = 0;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      return { time: formatted };
    }

    const str = String(val).trim();
    const timeMatch = str.match(/^(\d{1,2})[:hH](\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return { time: formatted };
      }
    }

    return { time: null, error: 'Giờ không hợp lệ (định dạng HH:mm)' };
  }

  /**
   * Kiểm tra dòng tiêu đề có khớp với chữ ký cột yêu cầu hay không
   */
  public static matchSignature(
    paramOrActual: MatchSignatureParamDto | string[],
    legacyRequired?: string[],
  ): boolean {
    let actualHeaders: string[];
    let requiredHeaders: string[];

    if (
      paramOrActual &&
      typeof paramOrActual === 'object' &&
      !Array.isArray(paramOrActual) &&
      'actualHeaders' in paramOrActual &&
      'requiredHeaders' in paramOrActual
    ) {
      const dto = paramOrActual as MatchSignatureParamDto;
      actualHeaders = dto.actualHeaders;
      requiredHeaders = dto.requiredHeaders;
    } else {
      actualHeaders = paramOrActual as string[];
      requiredHeaders = legacyRequired!;
    }

    const actualNormalized = actualHeaders.map((h) => this.normalizeKey(h));
    return requiredHeaders.every((req) => actualNormalized.includes(this.normalizeKey(req)));
  }

  /**
   * Sinh file Excel kết quả chi tiết lỗi sử dụng WorkbookWriter (Streaming chống tràn RAM)
   * Cột cuối cùng "Kết quả import" được tô chữ đỏ cho dòng lỗi và chữ xanh cho dòng hợp lệ
   */
  public static async generateErrorWorkbook(
    options: GenerateErrorWorkbookOptions,
  ): Promise<Buffer> {
    const {
      headers,
      rows,
      sheetName = 'Ket_qua_import',
      resultHeaderTitle = 'Kết quả import',
      resultColumnWidth = 40,
    } = options;

    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on('data', (chunk) => chunks.push(chunk));

    const ExcelJSStream = (ExcelJS as any).stream?.xlsx;
    const writer = new ExcelJSStream.WorkbookWriter({
      stream: pass,
      useStyles: true,
      useSharedStrings: false,
    });

    const worksheet = writer.addWorksheet(sheetName);

    // Cấu hình các cột tiêu đề
    const resultColIndex = headers.length + 1;
    worksheet.columns = [
      ...headers.map((h, i) => ({ header: h, key: `col_${i}`, width: 22 })),
      { header: resultHeaderTitle, key: 'import_result', width: resultColumnWidth },
    ];

    // Tạo Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' }, // Navy y tế chuẩn
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // Tô đỏ riêng cho ô tiêu đề Kết quả import
    const resHeaderCell = headerRow.getCell(resultColIndex);
    resHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32F2F' }, // Đỏ cảnh báo
    };
    headerRow.commit();

    // Duyệt qua từng dòng dữ liệu và commit cuốn chiếu O(1) RAM
    for (const r of rows) {
      const hasErrors = r.errors && r.errors.length > 0;
      const statusText = hasErrors
        ? r.errors.join('; ').includes('❌ LỖI')
          ? r.errors.join('; ')
          : `❌ LỖI: ${r.errors.join('; ')}`
        : r.successNote || 'Hợp lệ';

      // Khử độc formula injection trước khi ghi
      const sanitizedValues = r.rawValues.map((v) => ExcelSecurityUtil.sanitizeCellValue(v));
      sanitizedValues.push(statusText);

      const addedRow = worksheet.addRow(sanitizedValues);
      addedRow.alignment = { vertical: 'middle' };

      const statusCell = addedRow.getCell(resultColIndex);
      if (hasErrors) {
        statusCell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFFF0000' }, // Đỏ rực
        };
      } else {
        statusCell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF2E7D32' }, // Xanh lá
        };
      }

      addedRow.commit();
    }

    await worksheet.commit();
    await writer.commit();

    return Buffer.concat(chunks);
  }
}
