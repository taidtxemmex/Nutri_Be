import { EXCEL_UPLOAD_CONFIG } from '../../config/constants/excel.constants';

/**
 * ExcelSecurityUtil
 * Phòng chống triệt để CSV/Excel Formula Injection (CWE-1236)
 * Tuân thủ Pillar I (Bảo mật) & Pillar II (Universal DRY Code Law)
 */
export class ExcelSecurityUtil {
  public static readonly DANGEROUS_PREFIXES: readonly string[] =
    EXCEL_UPLOAD_CONFIG?.DANGEROUS_PREFIXES || ['=', '+', '-', '@', '\t', '\r', '%', '|'];
  public static readonly MAX_CELL_LENGTH: number =
    EXCEL_UPLOAD_CONFIG?.MAX_CELL_LENGTH || 1000;

  /**
   * Kiểm tra xem giá trị chuỗi có nguy cơ là payload Formula Injection hay không
   */
  public static isFormulaPayload(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trimStart();
    if (trimmed.length === 0) return false;
    return this.DANGEROUS_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  }

  /**
   * Khử độc một giá trị ô (Cell) đơn lẻ
   * Nếu là chuỗi bắt đầu bằng các ký tự nguy hiểm (=, +, -, @, \t, \r, %, |),
   * tự động chèn tiền tố dấu nháy đơn (') để Excel hiểu là văn bản thuần túy (Raw Text).
   * Giữ nguyên kiểu nguyên thủy number, boolean, Date, null, undefined để không phá vỡ tính toán.
   */
  public static sanitizeCellValue<T>(value: T): T | string {
    if (value === null || value === undefined) {
      return value;
    }

    // Giữ nguyên kiểu nguyên thủy cho tính toán số học và định dạng ngày tháng
    if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
      return value;
    }

    let str = String(value);
    if (str.length > this.MAX_CELL_LENGTH) {
      str = str.substring(0, this.MAX_CELL_LENGTH);
    }

    const trimmed = str.trimStart();
    if (trimmed.length > 0 && this.DANGEROUS_PREFIXES.some((p) => trimmed.startsWith(p))) {
      return `'${str}`; // Prepend apostrophe để vô hiệu hóa thực thi công thức
    }

    return str;
  }

  /**
   * Bí danh ngắn gọn cho sanitizeCellValue
   */
  public static sanitizeCell<T>(value: T): T | string {
    return this.sanitizeCellValue(value);
  }

  /**
   * Khử độc toàn bộ các ô trong một mảng dòng dữ liệu (Row Array)
   */
  public static sanitizeRow(row: any[]): any[] {
    if (!Array.isArray(row)) return [];
    return row.map((cell) => this.sanitizeCellValue(cell));
  }

  /**
   * Khử độc toàn bộ các thuộc tính trong một đối tượng dữ liệu (Object Record)
   */
  public static sanitizeRecord<T extends Record<string, any>>(record: T): T {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return record;
    }

    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(record)) {
      sanitized[key] = this.sanitizeCellValue(val);
    }
    return sanitized as T;
  }

  /**
   * Bí danh cho sanitizeRecord
   */
  public static sanitizeObject<T extends Record<string, any>>(record: T): T {
    return this.sanitizeRecord(record);
  }
}
