import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { Writable } from 'stream';
import { ExcelSecurityUtil } from '../../security/excel/excel-security.util';
import {
  EXCEL_STYLES,
  EXCEL_FONT_FAMILY,
} from '../../config/constants/excel.constants';

export interface ExcelStreamOptions {
  sheetName?: string;
  defaultColWidth?: number;
  freezeHeader?: boolean;
  freezeSplitY?: number;
}

export interface ExcelColumnDefinition {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
}

export interface TitleOptions {
  subtitle?: string;
  dateInfo?: string;
  spanCols?: number;
  height?: number;
}

export interface SectionHeaderOptions {
  spanCols?: number;
  bgColor?: string;
  textColor?: string;
  height?: number;
}

export interface SummaryRowOptions {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
  height?: number;
}

/**
 * BaseExcelStreamer<TRecord>
 * Lõi xuất file Excel dạng Stream chuẩn y tế với bộ nhớ O(1) < 35MB RAM
 * Sử dụng exceljs.stream.xlsx.WorkbookWriter với useSharedStrings: false
 * Tuân thủ Pillar III (Memory Protection Anti-OOM) & CWE-1236 Formula Injection Mitigation
 */
export abstract class BaseExcelStreamer<TRecord = any> {
  protected workbook: ExcelJS.stream.xlsx.WorkbookWriter;
  protected worksheet: ExcelJS.Worksheet;
  protected rowCount = 0;
  protected readonly isHttpResponse: boolean;

  constructor(
    protected readonly outputStream: Response | Writable,
    options: ExcelStreamOptions = {},
  ) {
    this.isHttpResponse =
      Boolean(this.outputStream) &&
      typeof (this.outputStream as any).setHeader === 'function';

    // 1. Cấu hình HTTP Response Headers nếu stream là Express Response
    if (this.isHttpResponse) {
      const res = this.outputStream as Response;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Accel-Buffering', 'no'); // Tắt buffering phía proxy Nginx
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // 2. Khởi tạo WorkbookWriter - BẮT BUỘC useSharedStrings = false để không gom string table vào RAM
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this.outputStream,
      useStyles: true,
      useSharedStrings: false, // Tiết kiệm tuyệt đối RAM (< 35MB delta)
    });

    const sheetName = options.sheetName || 'Data';
    const worksheetOptions: Partial<ExcelJS.AddWorksheetOptions> = {};

    // 3. Freeze Header (Cố định dòng tiêu đề để cuộn xem dữ liệu)
    if (options.freezeHeader !== false) {
      const splitY = options.freezeSplitY ?? 1;
      worksheetOptions.views = [{ state: 'frozen', ySplit: splitY }];
    }

    this.worksheet = this.workbook.addWorksheet(sheetName, worksheetOptions);
  }

  /**
   * Xử lý Backpressure khi buffer của Writable Stream bị đầy (Client mạng yếu hoặc download chậm)
   * Tránh tràn bộ nhớ đệm Buffer của Node.js Process
   */
  protected async handleBackpressure(): Promise<void> {
    const stream = this.outputStream as any;
    if (stream && typeof stream.once === 'function') {
      if (stream.writableNeedDrain || stream._writableState?.needDrain) {
        await new Promise<void>((resolve) => {
          stream.once('drain', resolve);
        });
      }
    }
  }

  /**
   * Thiết lập dòng tiêu đề bảng (Header Row) chuẩn y tế
   * Màu Navy chuẩn #1F497D, chữ trắng, in đậm, căn giữa
   */
  public setHeaders(
    headers: Array<ExcelColumnDefinition>,
    options?: {
      height?: number;
      bgColor?: string;
      textColor?: string;
      font?: Partial<ExcelJS.Font>;
    },
  ): void {
    // Đặt cấu hình columns (key, width, style) mà không gán header trong defn
    // nhằm tránh việc ExcelJS tự động gọi getRow(1) gây lỗi "row has been committed" khi đã có title trước đó
    this.worksheet.columns = headers.map((h) => ({
      key: h.key,
      width: h.width || 18,
      style: h.style,
    }));

    const headerRow = this.worksheet.getRow(this.rowCount + 1);
    headerRow.values = headers.map((h) => h.header);
    headerRow.font = options?.font || {
      name: EXCEL_FONT_FAMILY,
      size: 10,
      bold: true,
      color: { argb: options?.textColor || 'FFFFFFFF' },
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options?.bgColor || EXCEL_STYLES.COLORS.PRIMARY_NAVY }, // Navy y tế chuẩn FF1F497D
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = options?.height || 26;
    headerRow.commit(); // Xả dòng tiêu đề ra stream ngay lập tức
    this.rowCount++;
  }

  /**
   * Thêm tiêu đề báo cáo y tế (Medical Report Title)
   */
  public addTitle(title: string, options: TitleOptions = {}): void {
    const titleRowNumber = this.rowCount + 1;
    const titleRow = this.worksheet.getRow(titleRowNumber);
    titleRow.getCell(1).value = ExcelSecurityUtil.sanitizeCellValue(title);
    titleRow.font = EXCEL_STYLES.FONTS.TITLE;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.height = options.height || 30;

    if (options.spanCols && options.spanCols > 1) {
      this.worksheet.mergeCells(titleRowNumber, 1, titleRowNumber, options.spanCols);
    }
    titleRow.commit();
    this.rowCount++;

    if (options.subtitle || options.dateInfo) {
      const subText = [options.subtitle, options.dateInfo].filter(Boolean).join(' | ');
      const subRowNumber = this.rowCount + 1;
      const subRow = this.worksheet.getRow(subRowNumber);
      subRow.getCell(1).value = ExcelSecurityUtil.sanitizeCellValue(subText);
      subRow.font = EXCEL_STYLES.FONTS.SUBTITLE;
      subRow.alignment = { vertical: 'middle', horizontal: 'center' };
      subRow.height = 20;

      if (options.spanCols && options.spanCols > 1) {
        this.worksheet.mergeCells(subRowNumber, 1, subRowNumber, options.spanCols);
      }
      subRow.commit();
      this.rowCount++;
    }

    // Thêm dòng trống ngăn cách
    const emptyRow = this.worksheet.getRow(this.rowCount + 1);
    emptyRow.height = 10;
    emptyRow.commit();
    this.rowCount++;
  }

  /**
   * Thêm tiêu đề phân mục y tế (Section Header)
   * Ví dụ: "I. DANH SÁCH BỆNH NHÂN", "II. PHÂN TÍCH NHU CẦU DINH DƯỠNG"
   */
  public addSectionHeader(sectionTitle: string, options: SectionHeaderOptions = {}): void {
    const rowNumber = this.rowCount + 1;
    const row = this.worksheet.getRow(rowNumber);
    row.getCell(1).value = ExcelSecurityUtil.sanitizeCellValue(sectionTitle);
    row.font = {
      name: EXCEL_FONT_FAMILY,
      size: 11,
      bold: true,
      color: { argb: options.textColor || 'FFFFFFFF' },
    };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options.bgColor || EXCEL_STYLES.COLORS.MEDICAL_GREEN },
    };
    row.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    row.height = options.height || 22;

    if (options.spanCols && options.spanCols > 1) {
      this.worksheet.mergeCells(rowNumber, 1, rowNumber, options.spanCols);
    }

    row.commit();
    this.rowCount++;
  }

  /**
   * Thêm 1 dòng dữ liệu kèm khử độc Formula Injection và commit cuốn chiếu
   */
  public async addRow(
    data: any[] | Record<string, any>,
    options?: {
      height?: number;
      font?: Partial<ExcelJS.Font>;
      fill?: ExcelJS.Fill;
      alignment?: Partial<ExcelJS.Alignment>;
      border?: Partial<ExcelJS.Borders>;
    },
  ): Promise<void> {
    const sanitizedData = Array.isArray(data)
      ? ExcelSecurityUtil.sanitizeRow(data)
      : ExcelSecurityUtil.sanitizeRecord(data);

    const row = this.worksheet.addRow(sanitizedData);

    if (options?.height) {
      row.height = options.height;
    }
    if (options?.font) {
      row.font = options.font;
    } else {
      row.font = EXCEL_STYLES.FONTS.DATA;
    }
    if (options?.fill) {
      row.fill = options.fill;
    }
    if (options?.alignment) {
      row.alignment = options.alignment;
    } else {
      row.alignment = { vertical: 'middle' };
    }
    if (options?.border) {
      row.border = options.border;
    }

    row.commit(); // Giải phóng object dòng khỏi bộ nhớ V8 ngay lập tức
    this.rowCount++;

    // Xử lý Backpressure khi stream bị nghẽn
    await this.handleBackpressure();
  }

  /**
   * Thêm dòng cảnh báo lâm sàng (Clinical Indicator Row)
   * Tô màu cảnh báo vi chất thiếu hụt (DEFICIENCY), dư thừa (EXCESS) hoặc đạt chuẩn (OPTIMAL)
   */
  public async addClinicalAlertRow(
    data: any[] | Record<string, any>,
    indicator: 'DEFICIENCY' | 'EXCESS' | 'OPTIMAL' | 'WARNING' = 'OPTIMAL',
  ): Promise<void> {
    let fillArgb: string = EXCEL_STYLES.COLORS.OPTIMAL_GREEN_FILL;
    let fontColorArgb: string = EXCEL_STYLES.COLORS.OPTIMAL_GREEN_TEXT;

    switch (indicator) {
      case 'DEFICIENCY':
        fillArgb = EXCEL_STYLES.COLORS.DEFICIENCY_RED_FILL;
        fontColorArgb = EXCEL_STYLES.COLORS.DEFICIENCY_RED_TEXT;
        break;
      case 'EXCESS':
        fillArgb = EXCEL_STYLES.COLORS.EXCESS_YELLOW_FILL;
        fontColorArgb = EXCEL_STYLES.COLORS.EXCESS_YELLOW_TEXT;
        break;
      case 'WARNING':
        fillArgb = EXCEL_STYLES.COLORS.LIGHT_YELLOW_MEAL;
        fontColorArgb = 'FF8A6D3B';
        break;
      case 'OPTIMAL':
      default:
        fillArgb = EXCEL_STYLES.COLORS.OPTIMAL_GREEN_FILL;
        fontColorArgb = EXCEL_STYLES.COLORS.OPTIMAL_GREEN_TEXT;
        break;
    }

    await this.addRow(data, {
      font: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: fontColorArgb } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillArgb },
      },
    });
  }

  /**
   * Thêm dòng tổng kết (Summary Row)
   * Nền xanh nhạt, chữ đậm, viền trên mảnh viền dưới đôi chuẩn kế toán y tế
   */
  public async addSummaryRow(
    data: any[] | Record<string, any>,
    options?: SummaryRowOptions,
  ): Promise<void> {
    await this.addRow(data, {
      height: options?.height || 24,
      font: options?.font || EXCEL_STYLES.FONTS.TOTAL,
      fill: options?.fill || {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.LIGHT_BLUE_TOTAL },
      },
      border: options?.border || {
        top: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        bottom: { style: 'double', color: { argb: EXCEL_STYLES.COLORS.BORDER_MEDIUM } },
      },
    });
  }

  /**
   * Thêm 1 lô bản ghi (Batch Chunk)
   */
  public async addBatch(records: Array<any[] | Record<string, any>>): Promise<void> {
    for (const record of records) {
      await this.addRow(record);
    }
  }

  /**
   * Gộp các ô trong trang tính (Merge Cells)
   * Lưu ý: Trong streaming mode, việc gộp ô phải thực hiện trước khi các dòng tương ứng bị commit
   */
  public mergeCells(
    topOrRange: number | string,
    left?: number,
    bottom?: number,
    right?: number,
  ): void {
    if (typeof topOrRange === 'string') {
      this.worksheet.mergeCells(topOrRange);
    } else if (
      typeof topOrRange === 'number' &&
      typeof left === 'number' &&
      typeof bottom === 'number' &&
      typeof right === 'number'
    ) {
      this.worksheet.mergeCells(topOrRange, left, bottom, right);
    }
  }

  /**
   * Phương thức trừu tượng / ảo để các lớp kế thừa triển khai luồng nạp dữ liệu
   */
  public async streamData(items?: TRecord[]): Promise<void> {
    if (Array.isArray(items)) {
      for (const item of items) {
        await this.addRow(item as any);
      }
    }
  }

  /**
   * Tạo thêm một trang tính mới trong cùng file Excel (hỗ trợ báo cáo đa sheet như Template 4)
   * Tự động commit trang tính hiện tại trước khi tạo mới để giải phóng RAM
   */
  public async addWorksheet(
    sheetName: string,
    options: ExcelStreamOptions = {},
  ): Promise<ExcelJS.Worksheet> {
    if (this.worksheet) {
      await this.worksheet.commit();
    }
    const worksheetOptions: Partial<ExcelJS.AddWorksheetOptions> = {};
    if (options.freezeHeader !== false) {
      const splitY = options.freezeSplitY ?? 1;
      worksheetOptions.views = [{ state: 'frozen', ySplit: splitY }];
    }
    this.worksheet = this.workbook.addWorksheet(sheetName, worksheetOptions);
    this.rowCount = 0;
    return this.worksheet;
  }

  public getWorksheet(): ExcelJS.Worksheet {
    return this.worksheet;
  }

  public getWorkbook(): ExcelJS.stream.xlsx.WorkbookWriter {
    return this.workbook;
  }

  /**
   * Hoàn tất xuất file - Commit Worksheet và Workbook
   */
  public async finalize(): Promise<void> {
    if (this.worksheet) {
      await this.worksheet.commit();
    }
    await this.workbook.commit();
    if (
      this.outputStream &&
      typeof (this.outputStream as any).end === 'function' &&
      !(this.outputStream as any).writableEnded
    ) {
      (this.outputStream as any).end();
    }
  }

  /**
   * Bí danh tương đương cho finalize()
   */
  public async finish(): Promise<void> {
    await this.finalize();
  }

  /**
   * Lấy số dòng đã xuất ra trang tính
   */
  public getRowCount(): number {
    return this.rowCount;
  }
}
