import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../core/database/prisma.service';
import { NutritionCalculatorService } from '../../../core/nutrition-engine/nutrition-calculator.service';
import { NUTRIENT_CODES } from '../../../core/nutrition-engine/nutrition.constants';
import { CacheService } from '../../../core/cache/cache.service';
import {
  DailyIntakeClinicalReportType,
  Gender,
  IntakeInputType,
} from '../../../config/enums/domain.enum';
import {
  EXCEL_FONT_FAMILY,
  EXCEL_LIMITS,
  EXCEL_STYLES,
  VIETNAM_NIN_RDA_STANDARDS,
  ENERGY_DISTRIBUTION_RECOMMENDED,
} from '../../../config/constants/excel.constants';
import {
  DailyIntakeExcelRowSchema,
  DailyIntakeRowValidationError,
} from '../schemas/daily-intake-row.schema';
import { Writable } from 'stream';

export interface DailyIntakeImportResult {
  success: boolean;
  importedCount: number;
  dailyIntakeId?: string | bigint;
  errorsCount?: number;
  totalRows?: number;
  errorRows?: DailyIntakeRowValidationError[];
  errorFileName?: string;
  errorFileBuffer?: Buffer;
  message: string;
}

export interface ImportDailyIntakeOptions {
  patientId: string | bigint | number;
  userId: string;
  date?: string | Date;
  overwrite?: boolean;
  notes?: string;
}

interface ParsedMealGroup {
  mealName: string;
  mealTime: string;
  order: number;
  items: Array<{
    ingredientId: bigint;
    ingredientName: string;
    netWeight: number;
    notes?: string;
  }>;
}

@Injectable()
export class DailyIntakeExcelService {
  private readonly logger = new Logger(DailyIntakeExcelService.name);

  private static readonly TEMPLATE_CACHE_KEY = 'daily_intake:import_template:buffer';
  private static readonly TEMPLATE_CACHE_TAG = 'ingredients';
  private static readonly TEMPLATE_CACHE_TTL = 1800; // 30 phút

  private static readonly DATA_SHEET = 'Khau_phan_24h';
  private static readonly REF_SHEET = 'DS_nguyen_lieu';
  private static readonly GUIDE_SHEET = 'Huong_dan';

  private static readonly EXPECTED_HEADERS = [
    'Bữa ăn',
    'Giờ ăn',
    'Tên nguyên liệu',
    'Khối lượng sống sạch (g)',
    'Ghi chú',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionCalculator: NutritionCalculatorService = new NutritionCalculatorService(),
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  // ==========================================
  // 1. TẠO FILE EXCEL MẪU (TEMPLATE) CÓ CACHE 0MS
  // ==========================================

  /**
   * Tạo template Excel mẫu để nhập khẩu phần 24h kèm bộ đệm CacheService (0ms)
   */
  async generateTemplate(): Promise<Buffer> {
    if (this.cacheService) {
      const cached = await this.cacheService.get<string>(
        DailyIntakeExcelService.TEMPLATE_CACHE_KEY,
      );
      if (cached) {
        this.logger.debug('🚀 [Cache Hit] Trả về template khẩu phần 24h từ bộ nhớ đệm (0ms)');
        return Buffer.from(cached, 'base64');
      }
    }

    this.logger.debug('🔄 [Cache Miss] Đang tạo mới template Excel khẩu phần 24h từ DB...');
    const buffer = await this.buildTemplateWorkbook();

    if (this.cacheService) {
      await this.cacheService.set(
        DailyIntakeExcelService.TEMPLATE_CACHE_KEY,
        buffer.toString('base64'),
        DailyIntakeExcelService.TEMPLATE_CACHE_TTL,
        DailyIntakeExcelService.TEMPLATE_CACHE_TAG,
      );
      this.logger.debug('💾 Đã lưu template khẩu phần 24h vào CacheService (tag=ingredients)');
    }

    return buffer;
  }

  private async buildTemplateWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical Intelligence';
    workbook.created = new Date();

    // 1. Sheet Khau_phan_24h (Nhập liệu)
    const dataSheet = workbook.addWorksheet(DailyIntakeExcelService.DATA_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });
    const guideSheet = workbook.addWorksheet(DailyIntakeExcelService.GUIDE_SHEET, {
      views: [{ showGridLines: true }],
    });
    const refSheet = workbook.addWorksheet(DailyIntakeExcelService.REF_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });

    // Cấu hình Header
    const headerRow = dataSheet.addRow(DailyIntakeExcelService.EXPECTED_HEADERS);
    headerRow.height = 30;
    headerRow.font = { name: EXCEL_FONT_FAMILY, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
    };

    dataSheet.getColumn(1).width = 24; // Bữa ăn
    dataSheet.getColumn(2).width = 16; // Giờ ăn
    dataSheet.getColumn(3).width = 42; // Tên nguyên liệu
    dataSheet.getColumn(4).width = 26; // Khối lượng sống sạch (g)
    dataSheet.getColumn(5).width = 30; // Ghi chú

    this.applyRowBorder(headerRow, 'medium');

    // Nạp danh sách nguyên liệu từ DB
    const ingredients = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null },
      select: { ten_nguyen_lieu: true },
      orderBy: { ten_nguyen_lieu: 'asc' },
    });

    const ingredientNames = ingredients
      .map((i) => i.ten_nguyen_lieu?.trim())
      .filter((name): name is string => !!name && name.length > 0);

    // 2. Sheet DS_nguyen_lieu (Tham chiếu cho Dropdown)
    const refHeaderRow = refSheet.addRow(['Tên nguyên liệu thực phẩm']);
    refHeaderRow.height = 26;
    refHeaderRow.font = {
      name: EXCEL_FONT_FAMILY,
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    refHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.MEDICAL_GREEN },
    };
    refHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    refSheet.getColumn(1).width = 45;

    ingredientNames.forEach((name, idx) => {
      const row = refSheet.addRow([name]);
      row.height = 20;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      if (idx % 2 === 1) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_STYLES.COLORS.ZEBRA_LIGHT },
        };
      }
      this.applyRowBorder(row, 'thin');
    });

    // Thiết lập Data Validation cho sheet Khau_phan_24h
    const totalRef = ingredientNames.length;
    for (let r = 2; r <= EXCEL_LIMITS.MAX_IMPORT_ROWS; r++) {
      // Dropdown nguyên liệu
      if (totalRef > 0) {
        dataSheet.getCell(`C${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`${DailyIntakeExcelService.REF_SHEET}!$A$2:$A$${totalRef + 1}`],
          showErrorMessage: true,
          errorTitle: 'Nguyên liệu không hợp lệ',
          error: 'Vui lòng chọn nguyên liệu từ danh mục hệ thống',
        };
      }

      // Giới hạn khối lượng
      dataSheet.getCell(`D${r}`).dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: [String(EXCEL_LIMITS.MIN_WEIGHT_GRAMS), String(EXCEL_LIMITS.MAX_WEIGHT_GRAMS)],
        showErrorMessage: true,
        errorTitle: 'Khối lượng sai định dạng',
        error: `Nhập số dương từ ${EXCEL_LIMITS.MIN_WEIGHT_GRAMS}g đến ${EXCEL_LIMITS.MAX_WEIGHT_GRAMS}g`,
      };
    }

    // 3. Sheet Huong_dan
    this.populateDailyIntakeGuideSheet(guideSheet);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private populateDailyIntakeGuideSheet(guideSheet: ExcelJS.Worksheet): void {
    const lines = [
      'HƯỚNG DẪN NHẬP KHẨU PHẦN 24 GIỜ (RECALL 24H)',
      'Quy tắc nhập liệu:',
      `• Nhập dữ liệu tại sheet '${DailyIntakeExcelService.DATA_SHEET}', bắt đầu từ dòng số 2.`,
      '• Không xóa hoặc thay đổi tiêu đề các cột ở dòng 1.',
      '• Bữa ăn: Bắt buộc điền ở dòng đầu tiên của mỗi bữa (VD: Bữa sáng, Bữa trưa, Bữa tối, Bữa phụ).',
      '  Các dòng tiếp theo thuộc cùng bữa ăn có thể để trống hoặc điền trùng tên bữa.',
      '• Giờ ăn: Định dạng giờ:phút HH:mm (VD: 07:00, 12:30, 18:45).',
      `• Tên nguyên liệu: Chọn từ menu thả xuống (dropdown) hoặc nhập đúng tên trong sheet '${DailyIntakeExcelService.REF_SHEET}'.`,
      '• Khối lượng sống sạch: Số gam thực tế ăn vào (sau khi đã trừ bỏ phần không ăn được như xương, vỏ, cuống).',
      '• Tránh bỏ sót các món ăn vặt, nước ngọt, dầu mỡ chế biến, gia vị đường muối.',
      `• Tối đa ${EXCEL_LIMITS.MAX_IMPORT_ROWS} dòng cho một ngày khảo sát.`,
      'Ví dụ minh họa (chỉ để tham khảo, không nhập vào sheet này):',
    ];

    for (let i = 0; i < lines.length; i++) {
      const row = guideSheet.addRow([lines[i]]);
      row.height = 20;
      if (i === 0) {
        row.height = 28;
        row.getCell(1).font = {
          name: EXCEL_FONT_FAMILY,
          size: 13,
          bold: true,
          color: { argb: 'FF1F497D' },
        };
      } else if (i === 1 || i === lines.length - 1) {
        row.getCell(1).font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true };
      } else {
        row.getCell(1).font = { name: EXCEL_FONT_FAMILY, size: 10 };
      }
    }

    // Bảng mẫu ví dụ
    const sampleHeaders = [
      'Bữa ăn',
      'Giờ ăn',
      'Tên nguyên liệu',
      'Khối lượng sống sạch (g)',
      'Ghi chú',
    ];
    const sampleRows = [
      ['Bữa sáng', '07:00', 'Bánh phở', 150, 'Phở bò tái'],
      ['', '', 'Thịt bò loại 1', 60, ''],
      ['', '', 'Hành lá', 10, ''],
      ['Bữa phụ sáng', '09:30', 'Sữa tươi tiệt trùng', 180, '1 hộp'],
      ['Bữa trưa', '12:00', 'Gạo tẻ giã', 100, 'Cơm trắng 1 bát rưỡi'],
      ['', '', 'Thịt lợn nạc', 80, 'Thịt rang cháy cạnh'],
      ['', '', 'Rau muống', 120, 'Rau luộc'],
    ];

    const sHeader = guideSheet.addRow(sampleHeaders);
    sHeader.height = 24;
    sHeader.eachCell((c) => {
      c.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    this.applyRowBorder(sHeader, 'thin');

    for (const rData of sampleRows) {
      const row = guideSheet.addRow(rData);
      row.height = 20;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
      this.applyRowBorder(row, 'thin');
    }

    guideSheet.getColumn(1).width = 22;
    guideSheet.getColumn(2).width = 16;
    guideSheet.getColumn(3).width = 38;
    guideSheet.getColumn(4).width = 24;
    guideSheet.getColumn(5).width = 28;
  }

  // ==========================================
  // 2. ATOMIC BATCH IMPORT VỚI ZOD VALIDATION
  // ==========================================

  /**
   * Đọc và parse Excel bảng kê ăn uống 24h, validate từng dòng với Zod.
   * Nếu có lỗi: trả về danh sách lỗi chi tiết kèm file Excel đánh dấu dòng lỗi.
   * Nếu hợp lệ: commit toàn bộ trong 1 transaction an toàn tuyệt đối.
   */
  async importDailyIntakeExcel(
    fileBuffer: Buffer,
    options: ImportDailyIntakeOptions,
  ): Promise<DailyIntakeImportResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có nội dung dữ liệu',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Kiểm tra bệnh nhân tồn tại
    const patientIdBigInt = BigInt(String(options.patientId));
    const patient = await this.prisma.benh_nhan.findFirst({
      where: { id: patientIdBigInt, deleted_at: null },
    });

    if (!patient) {
      throw new HttpException(
        {
          code: 'PATIENT_NOT_FOUND',
          message: `Không tìm thấy bệnh nhân với ID ${options.patientId}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Parse Workbook
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (err: any) {
      this.logger.error(`Lỗi đọc workbook: ${err.message}`, err.stack);
      throw new HttpException(
        {
          code: 'IMPORT_FILE_CORRUPTED',
          message: 'Tập tin Excel bị hỏng hoặc không đúng định dạng (.xlsx)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const sheet =
      workbook.getWorksheet(DailyIntakeExcelService.DATA_SHEET) || workbook.worksheets[0];

    if (!sheet || sheet.rowCount <= 1) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_SHEET',
          message: 'Tập tin Excel không có dòng dữ liệu nào',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Kiểm tra Header
    const headerRow = sheet.getRow(1);
    if (!this.validateHeaderRow(headerRow)) {
      throw new HttpException(
        {
          code: 'IMPORT_INVALID_HEADER',
          message:
            'Tiêu đề các cột không đúng định dạng quy định. Yêu cầu: [Bữa ăn, Giờ ăn, Tên nguyên liệu, Khối lượng sống sạch (g), Ghi chú]',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Nạp danh mục nguyên liệu vào RAM Map O(1)
    const allIngredients = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null },
      select: { id: true, ten_nguyen_lieu: true },
    });

    const ingredientLookup = new Map<string, bigint>();
    for (const ing of allIngredients) {
      if (ing.ten_nguyen_lieu) {
        ingredientLookup.set(this.normalizeVietnameseKey(ing.ten_nguyen_lieu), ing.id);
      }
    }

    // 5. Duyệt và Validate từng dòng với Zod
    const rowErrors: DailyIntakeRowValidationError[] = [];
    const validRows: Array<{
      rowNumber: number;
      mealName: string;
      mealTime: string;
      ingredientId: bigint;
      ingredientName: string;
      netWeight: number;
      notes?: string;
    }> = [];

    let currentMealName = '';
    let currentMealTime = '';
    const maxRow = Math.min(sheet.rowCount, EXCEL_LIMITS.MAX_IMPORT_ROWS + 1);

    for (let r = 2; r <= maxRow; r++) {
      const row = sheet.getRow(r);
      if (!this.hasRowContent(row)) continue;

      const rawMealName = this.readCellString(row.getCell(1));
      const rawMealTime = this.readCellString(row.getCell(2));
      const rawIngName = this.readCellString(row.getCell(3));
      const rawWeight = this.readCellNumber(row.getCell(4));
      const rawNotes = this.readCellString(row.getCell(5));

      // Cascade Meal name nếu dòng sau để trống
      if (rawMealName && rawMealName.trim().length > 0) {
        currentMealName = rawMealName.trim();
        currentMealTime = rawMealTime ? rawMealTime.trim() : '';
      }

      // Xây dựng đối tượng dòng dữ liệu thô
      const rowData: Record<string, any> = {
        rowNumber: r,
        mealName: currentMealName,
        mealTime: rawMealTime ? rawMealTime.trim() : currentMealTime,
        ingredientName: rawIngName ? rawIngName.trim() : '',
        netWeight: rawWeight,
        notes: rawNotes,
      };

      // Validate bằng Zod
      const parseResult = DailyIntakeExcelRowSchema.safeParse(rowData);

      if (!parseResult.success) {
        for (const issue of parseResult.error.issues) {
          const fieldKey = String(issue.path[0]);
          rowErrors.push({
            row: r,
            field: issue.path.join('.'),
            error: issue.message,
            value: rowData[fieldKey],
          });
        }
        continue;
      }

      const validItem = parseResult.data;

      // Kiểm tra nguyên liệu có tồn tại trong DB không
      const ingKey = this.normalizeVietnameseKey(validItem.ingredientName);
      const ingId = ingredientLookup.get(ingKey);

      if (!ingId) {
        rowErrors.push({
          row: r,
          field: 'ingredientName',
          error: `Không tìm thấy nguyên liệu '${validItem.ingredientName}' trong danh mục hệ thống`,
          value: validItem.ingredientName,
        });
        continue;
      }

      validRows.push({
        rowNumber: r,
        mealName: validItem.mealName,
        mealTime: validItem.mealTime || this.guessMealTime(validItem.mealName),
        ingredientId: ingId,
        ingredientName: validItem.ingredientName,
        netWeight: validItem.netWeight,
        notes: validItem.notes || undefined,
      });
    }

    // 6. Nếu có bất kỳ lỗi nào -> Tạo file Excel đánh dấu dòng lỗi và return ngay
    if (rowErrors.length > 0) {
      const errorBuffer = await this.generateErrorExcelFile(sheet, rowErrors);
      return {
        success: false,
        importedCount: 0,
        errorsCount: rowErrors.length,
        totalRows: sheet.rowCount - 1,
        errorRows: rowErrors,
        errorFileName: 'khau_phan_24h_loi_nhap_lieu.xlsx',
        errorFileBuffer: errorBuffer,
        message: `Import thất bại: Phát hiện ${rowErrors.length} lỗi trong bảng kê. Vui lòng kiểm tra file đính kèm để xem chi tiết.`,
      };
    }

    if (validRows.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_NO_DATA',
          message: 'Không tìm thấy dữ liệu nguyên liệu hợp lệ để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 7. Xác định ngày ăn
    const intakeDate = options.date ? new Date(options.date) : new Date();
    intakeDate.setHours(0, 0, 0, 0);

    // Kiểm tra ràng buộc duy nhất (benh_nhan_id, ngay_an)
    const existingIntake = await this.prisma.khau_phan_24h.findFirst({
      where: {
        benh_nhan_id: patientIdBigInt,
        ngay_an: intakeDate,
      },
    });

    if (existingIntake && !options.overwrite) {
      throw new HttpException(
        {
          code: 'DAILY_INTAKE_DUPLICATE',
          message: `Bệnh nhân đã có bản ghi khẩu phần 24h vào ngày ${intakeDate.toLocaleDateString('vi-VN')}. Sử dụng cờ 'overwrite=true' nếu muốn ghi đè.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 8. Nhóm nguyên liệu theo Bữa ăn
    const mealGroups = this.groupValidRowsByMeal(validRows);

    // 9. Thực thi Atomic Transaction trong Prisma
    const createdIntake = await this.prisma.$transaction(async (tx) => {
      // Nếu overwrite -> Xóa các bản ghi chi tiết cũ
      if (existingIntake && options.overwrite) {
        const oldMealIds = (
          await tx.khau_phan_24h_bua_an.findMany({
            where: { khau_phan_24h_id: existingIntake.id },
            select: { id: true },
          })
        ).map((m) => m.id);

        if (oldMealIds.length > 0) {
          await tx.khau_phan_24h_nguyen_lieu.deleteMany({
            where: { khau_phan_24h_bua_an_id: { in: oldMealIds } },
          });
          await tx.khau_phan_24h_bua_an.deleteMany({
            where: { khau_phan_24h_id: existingIntake.id },
          });
        }

        await tx.khau_phan_24h.delete({ where: { id: existingIntake.id } });
      }

      // Tạo bản ghi khau_phan_24h
      const newIntake = await tx.khau_phan_24h.create({
        data: {
          benh_nhan_id: patientIdBigInt,
          nguoi_dung_id: options.userId,
          ngay_an: intakeDate,
          kieu_nhap: IntakeInputType.BY_MEAL,
          ghi_chu: options.notes || 'Nhập từ file Excel',
          tao_luc: new Date(),
        },
      });

      // Tạo các bữa ăn và nguyên liệu chi tiết
      for (const mg of mealGroups) {
        const createdMeal = await tx.khau_phan_24h_bua_an.create({
          data: {
            khau_phan_24h_id: newIntake.id,
            ten_bua: mg.mealName,
            gio_an: mg.mealTime,
            thu_tu_bua: mg.order,
          },
        });

        for (const item of mg.items) {
          await tx.khau_phan_24h_nguyen_lieu.create({
            data: {
              khau_phan_24h_bua_an_id: createdMeal.id,
              nguyen_lieu_id: item.ingredientId,
              khoi_luong_song_sach: item.netWeight,
            },
          });
        }
      }

      return newIntake;
    });

    // 10. Invalidate cache liên quan
    if (this.cacheService) {
      await this.cacheService.invalidateTag(`daily_intake:${patientIdBigInt}`);
    }

    this.logger.log(
      `IMPORT 24H INTAKE SUCCESS | patientId=${options.patientId} | intakeId=${createdIntake.id} | totalRows=${validRows.length}`,
    );

    return {
      success: true,
      importedCount: validRows.length,
      dailyIntakeId: createdIntake.id,
      errorsCount: 0,
      totalRows: sheet.rowCount - 1,
      message: `Nhập thành công khẩu phần 24h gồm ${mealGroups.length} bữa ăn và ${validRows.length} nguyên liệu vào hồ sơ bệnh nhân`,
    };
  }

  // ==========================================
  // 3. XUẤT 4 MẪU BÁO CÁO LÂM SÀNG
  // ==========================================

  /**
   * Xuất 4 mẫu báo cáo lâm sàng chuyên sâu:
   * 1. RDA_COMPARISON: Báo cáo tổng hợp vi chất 24h đối chiếu RDA Viện Dinh Dưỡng
   * 2. PLC_STRUCTURE: Biểu đồ / Báo cáo cơ cấu năng lượng P:L:C
   * 3. MEAL_DISTRIBUTION: Báo cáo phân bố năng lượng theo bữa ăn
   * 4. INGREDIENT_DETAILS: Bảng chi tiết nguyên liệu thực phẩm tiêu thụ
   * 5. ALL_IN_ONE: Tập hợp cả 4 báo cáo vào 1 Workbook hoàn chỉnh
   */
  async exportClinicalReport(
    dailyIntakeIdOrData: string | number | bigint | any,
    reportType: DailyIntakeClinicalReportType = DailyIntakeClinicalReportType.ALL_IN_ONE,
    userId?: string,
  ): Promise<Buffer> {
    const isIdQuery =
      typeof dailyIntakeIdOrData === 'string' ||
      typeof dailyIntakeIdOrData === 'number' ||
      typeof dailyIntakeIdOrData === 'bigint';

    // 1. Kiểm tra cache
    let cacheKey = '';
    if (isIdQuery && this.cacheService) {
      cacheKey = this.cacheService.generateKey('daily_intake:report', {
        id: String(dailyIntakeIdOrData),
        reportType,
      });

      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug(
          `🚀 [Cache Hit] Trả về báo cáo lâm sàng 24h #${dailyIntakeIdOrData} tức thì (0ms)`,
        );
        return Buffer.from(cached, 'base64');
      }
    }

    // 2. Nạp dữ liệu Khẩu phần 24h
    const intake = isIdQuery
      ? await this.fetchDailyIntakeWithRelations(dailyIntakeIdOrData, userId)
      : dailyIntakeIdOrData;

    if (!intake) {
      throw new HttpException(
        {
          code: 'DAILY_INTAKE_NOT_FOUND',
          message: 'Không tìm thấy bản ghi khẩu phần 24h yêu cầu xuất báo cáo',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 3. Tính toán toàn bộ 86 chỉ tiêu dinh dưỡng bằng NutritionCalculatorService
    const calculatedNutrition = this.calculateIntakeNutrition(intake);

    // 4. Khởi tạo Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical Nutrition System';
    workbook.created = new Date();

    // 5. Thêm các sheet tương ứng theo reportType
    if (
      reportType === DailyIntakeClinicalReportType.ALL_IN_ONE ||
      reportType === DailyIntakeClinicalReportType.RDA_COMPARISON
    ) {
      this.buildRdaComparisonSheet(workbook, intake, calculatedNutrition);
    }

    if (
      reportType === DailyIntakeClinicalReportType.ALL_IN_ONE ||
      reportType === DailyIntakeClinicalReportType.PLC_STRUCTURE
    ) {
      this.buildPlcStructureSheet(workbook, intake, calculatedNutrition);
    }

    if (
      reportType === DailyIntakeClinicalReportType.ALL_IN_ONE ||
      reportType === DailyIntakeClinicalReportType.MEAL_DISTRIBUTION
    ) {
      this.buildMealDistributionSheet(workbook, intake, calculatedNutrition);
    }

    if (
      reportType === DailyIntakeClinicalReportType.ALL_IN_ONE ||
      reportType === DailyIntakeClinicalReportType.INGREDIENT_DETAILS
    ) {
      this.buildIngredientDetailsSheet(workbook, intake);
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // 6. Lưu vào cache
    if (cacheKey && this.cacheService) {
      await this.cacheService.set(
        cacheKey,
        buffer.toString('base64'),
        1800,
        `daily_intake_${intake.id}`,
      );
    }

    return buffer;
  }

  /**
   * Stream báo cáo lâm sàng trực tiếp ra HTTP response stream (Anti-OOM)
   */
  async streamClinicalReport(
    dailyIntakeIdOrData: string | number | bigint | any,
    outputStream: Writable,
    reportType: DailyIntakeClinicalReportType = DailyIntakeClinicalReportType.ALL_IN_ONE,
    userId?: string,
  ): Promise<void> {
    const buffer = await this.exportClinicalReport(dailyIntakeIdOrData, reportType, userId);
    outputStream.write(buffer);
    outputStream.end();
  }

  // ==========================================
  // XÂY DỰNG TỪNG SHEET BÁO CÁO LÂM SÀNG
  // ==========================================

  /**
   * Mẫu 1: Báo cáo tổng hợp vi chất 24h đối chiếu RDA Viện Dinh Dưỡng
   */
  private buildRdaComparisonSheet(
    workbook: ExcelJS.Workbook,
    intake: any,
    nutrition: { totalNutrients: Record<string, number>; tdee: number },
  ): void {
    const sheet = workbook.addWorksheet('Doi_chieu_RDA', {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    r = this.writeClinicalPatientHeader(
      sheet,
      intake,
      r,
      'BÁO CÁO ĐỐI CHIẾU VI CHẤT KHẨU PHẦN 24H VỚI KHUYẾN NGHỊ RDA',
    );
    r++; // Cách dòng

    // Header bảng
    const headerRow = sheet.getRow(r++);
    headerRow.height = 26;
    const headers = [
      'STT',
      'Chỉ tiêu dinh dưỡng',
      'Đơn vị',
      'Lượng thực nạp (24h)',
      'Khuyến nghị RDA',
      '% Đáp ứng RDA',
      'Đánh giá lâm sàng / Cảnh báo',
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'medium');

    const patient = intake.benh_nhan || intake.patient;
    const isMale = String(patient?.gioi_tinh || '').toUpperCase() === Gender.NAM;

    let stt = 1;
    for (const [code, rdaItem] of Object.entries(VIETNAM_NIN_RDA_STANDARDS)) {
      const row = sheet.getRow(r++);
      row.height = 22;

      const actualVal = Number(nutrition.totalNutrients[code] ?? 0);
      let rdaTarget = isMale ? rdaItem.rdaMale : rdaItem.rdaFemale;

      // Năng lượng đối chiếu theo TDEE thực tế nếu có
      if (code === 'energy' && nutrition.tdee > 0) {
        rdaTarget = nutrition.tdee;
      }

      const percentRda = rdaTarget > 0 ? Math.round((actualVal / rdaTarget) * 1000) / 10 : 0;

      // Đánh giá tình trạng
      let statusText = 'Đạt chuẩn (Tối ưu)';
      let statusFont: any = EXCEL_STYLES.FONTS.OPTIMAL;
      let statusFill: string = EXCEL_STYLES.COLORS.OPTIMAL_GREEN_FILL;

      if (percentRda < rdaItem.lowerLimitRatio * 100) {
        statusText = `Thiếu hụt nghiêm trọng (<${Math.round(rdaItem.lowerLimitRatio * 100)}%)`;
        statusFont = EXCEL_STYLES.FONTS.ERROR;
        statusFill = EXCEL_STYLES.COLORS.DEFICIENCY_RED_FILL;
      } else if (percentRda > rdaItem.upperLimitRatio * 100) {
        statusText = `Vượt ngưỡng khuyến nghị (>${Math.round(rdaItem.upperLimitRatio * 100)}%)`;
        statusFont = EXCEL_STYLES.FONTS.WARNING;
        statusFill = EXCEL_STYLES.COLORS.EXCESS_YELLOW_FILL;
      }

      row.getCell(1).value = stt++;
      row.getCell(2).value = rdaItem.nameVi;
      row.getCell(3).value = rdaItem.unit;
      row.getCell(4).value = this.round2(actualVal);
      row.getCell(5).value = rdaTarget;
      row.getCell(6).value = `${percentRda}%`;
      row.getCell(7).value = statusText;

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

      // Tô màu cột trạng thái và % RDA
      row.getCell(6).font = statusFont;
      row.getCell(7).font = statusFont;
      row.getCell(7).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusFill },
      };

      this.applyRowBorder(row, 'thin');
    }

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 34;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 22;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 34;
  }

  /**
   * Mẫu 2: Biểu đồ & Báo cáo cơ cấu năng lượng P:L:C
   */
  private buildPlcStructureSheet(
    workbook: ExcelJS.Workbook,
    intake: any,
    nutrition: { totalNutrients: Record<string, number> },
  ): void {
    const sheet = workbook.addWorksheet('Co_cau_PLC', {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    r = this.writeClinicalPatientHeader(
      sheet,
      intake,
      r,
      'BÁO CÁO CƠ CẤU NĂNG LƯỢNG SINH CHẤT (PROTEIN - LIPID - CARBOHYDRATE)',
    );
    r++;

    const pGrams = Number(nutrition.totalNutrients['protein'] || 0);
    const lGrams = Number(nutrition.totalNutrients['fat'] || 0);
    const cGrams = Number(nutrition.totalNutrients['carbohydrate'] || 0);

    const pKcal = pGrams * 4;
    const lKcal = lGrams * 9;
    const cKcal = cGrams * 4;
    const totalAtwaterKcal = pKcal + lKcal + cKcal;

    const pRatio = totalAtwaterKcal > 0 ? Math.round((pKcal / totalAtwaterKcal) * 1000) / 10 : 0;
    const lRatio = totalAtwaterKcal > 0 ? Math.round((lKcal / totalAtwaterKcal) * 1000) / 10 : 0;
    const cRatio = totalAtwaterKcal > 0 ? Math.round((cKcal / totalAtwaterKcal) * 1000) / 10 : 0;

    // Bảng cơ cấu P:L:C
    const headerRow = sheet.getRow(r++);
    headerRow.height = 26;
    const headers = [
      'Thành phần sinh chất',
      'Khối lượng (g)',
      'Năng lượng cung cấp (kcal)',
      'Tỷ lệ thực tế (%)',
      'Khoảng khuyến nghị NIN (%)',
      'Đánh giá cân đối sinh chất',
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'medium');

    const rowsData = [
      {
        name: 'Chất đạm (Protein - P)',
        grams: pGrams,
        kcal: pKcal,
        ratio: pRatio,
        rec: `${ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MIN}% - ${ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MAX}%`,
        status:
          pRatio < ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MIN
            ? 'Thiếu đạm so với nhu cầu'
            : pRatio > ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MAX
              ? 'Tỷ lệ đạm cao'
              : 'Cân đối chuẩn',
        isOptimal:
          pRatio >= ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MIN &&
          pRatio <= ENERGY_DISTRIBUTION_RECOMMENDED.PROTEIN_MAX,
      },
      {
        name: 'Chất béo (Lipid - L)',
        grams: lGrams,
        kcal: lKcal,
        ratio: lRatio,
        rec: `${ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MIN}% - ${ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MAX}%`,
        status:
          lRatio < ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MIN
            ? 'Thiếu chất béo'
            : lRatio > ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MAX
              ? 'Thừa chất béo (Nguy cơ tim mạch)'
              : 'Cân đối chuẩn',
        isOptimal:
          lRatio >= ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MIN &&
          lRatio <= ENERGY_DISTRIBUTION_RECOMMENDED.LIPID_MAX,
      },
      {
        name: 'Chất bột đường (Glucid / Carb - C)',
        grams: cGrams,
        kcal: cKcal,
        ratio: cRatio,
        rec: `${ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MIN}% - ${ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MAX}%`,
        status:
          cRatio < ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MIN
            ? 'Tỷ lệ bột đường thấp'
            : cRatio > ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MAX
              ? 'Quá nhiều tinh bột (Nguy cơ ĐTĐ)'
              : 'Cân đối chuẩn',
        isOptimal:
          cRatio >= ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MIN &&
          cRatio <= ENERGY_DISTRIBUTION_RECOMMENDED.CARBOHYDRATE_MAX,
      },
    ];

    for (const item of rowsData) {
      const row = sheet.getRow(r++);
      row.height = 24;

      row.getCell(1).value = item.name;
      row.getCell(2).value = this.round2(item.grams);
      row.getCell(3).value = this.round2(item.kcal);
      row.getCell(4).value = `${item.ratio}%`;
      row.getCell(5).value = item.rec;
      row.getCell(6).value = item.status;

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

      row.getCell(4).font = item.isOptimal
        ? EXCEL_STYLES.FONTS.OPTIMAL
        : EXCEL_STYLES.FONTS.WARNING;
      row.getCell(6).font = item.isOptimal
        ? EXCEL_STYLES.FONTS.OPTIMAL
        : EXCEL_STYLES.FONTS.WARNING;

      this.applyRowBorder(row, 'thin');
    }

    // Dòng Tổng năng lượng
    const sumRow = sheet.getRow(r++);
    sumRow.height = 24;
    sumRow.getCell(1).value = 'TỔNG CỘNG NĂNG LƯỢNG';
    sumRow.getCell(2).value = this.round2(pGrams + lGrams + cGrams);
    sumRow.getCell(3).value = this.round2(totalAtwaterKcal);
    sumRow.getCell(4).value = '100%';
    sumRow.getCell(5).value = '100%';
    sumRow.getCell(6).value = `Cơ cấu P:L:C đạt ${pRatio} : ${lRatio} : ${cRatio}`;
    this.formatTotalRowCells(sumRow, 6, 'FF1F497D', 'FFE8F0FE');

    r += 2; // Cách dòng

    // Bảng phân tích Nguồn gốc Động vật / Thực vật
    const originTitle = sheet.getRow(r++);
    originTitle.height = 24;
    originTitle.getCell(1).value = 'PHÂN TÍCH NGUỒN GỐC SINH CHẤT (ĐỘNG VẬT / THỰC VẬT)';
    originTitle.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 11,
      bold: true,
      color: { argb: 'FF1F497D' },
    };

    const pAnimal = Number(nutrition.totalNutrients['proteinAnimal'] || 0);
    const pPlant = Number(nutrition.totalNutrients['proteinPlant'] || 0);
    const animalProteinRatio = pGrams > 0 ? Math.round((pAnimal / pGrams) * 1000) / 10 : 0;

    const fAnimal = Number(nutrition.totalNutrients['fatAnimal'] || 0);
    const fPlant = Number(nutrition.totalNutrients['fatPlant'] || 0);
    const plantFatRatio = lGrams > 0 ? Math.round((fPlant / lGrams) * 1000) / 10 : 0;

    const originHeader = sheet.getRow(r++);
    originHeader.height = 24;
    const oHeaders = [
      'Chỉ tiêu nguồn gốc',
      'Động vật (g)',
      'Thực vật (g)',
      'Tỷ lệ thực tế (%)',
      'Khuyến cáo y khoa',
    ];
    for (let i = 0; i < oHeaders.length; i++) {
      const cell = originHeader.getCell(i + 1);
      cell.value = oHeaders[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.MEDICAL_GREEN },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(originHeader, 'thin');

    const oRow1 = sheet.getRow(r++);
    oRow1.height = 22;
    oRow1.getCell(1).value = 'Chất đạm (Đạm ĐV / Tổng đạm)';
    oRow1.getCell(2).value = this.round2(pAnimal);
    oRow1.getCell(3).value = this.round2(pPlant);
    oRow1.getCell(4).value = `${animalProteinRatio}%`;
    oRow1.getCell(5).value = 'Khuyến nghị đạm động vật ≥ 30 - 35% tổng đạm';
    this.applyRowBorder(oRow1, 'thin');

    const oRow2 = sheet.getRow(r++);
    oRow2.height = 22;
    oRow2.getCell(1).value = 'Chất béo (Béo TV / Tổng béo)';
    oRow2.getCell(2).value = this.round2(fAnimal);
    oRow2.getCell(3).value = this.round2(fPlant);
    oRow2.getCell(4).value = `${plantFatRatio}%`;
    oRow2.getCell(5).value = 'Khuyến nghị dầu thực vật chiếm ≥ 40 - 50% tổng béo';
    this.applyRowBorder(oRow2, 'thin');

    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 26;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 28;
    sheet.getColumn(6).width = 34;
  }

  /**
   * Mẫu 3: Báo cáo phân bố năng lượng theo bữa ăn
   */
  private buildMealDistributionSheet(
    workbook: ExcelJS.Workbook,
    intake: any,
    nutrition: { totalNutrients: Record<string, number> },
  ): void {
    const sheet = workbook.addWorksheet('Phan_bo_bua_an', {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    r = this.writeClinicalPatientHeader(
      sheet,
      intake,
      r,
      'BÁO CÁO PHÂN BỐ NĂNG LƯỢNG VÀ VI CHẤT THEO BỮA ĂN TRONG NGÀY',
    );
    r++;

    const totalDayEnergy = Number(nutrition.totalNutrients['energy'] || 1);

    // Header bảng
    const headerRow = sheet.getRow(r++);
    headerRow.height = 26;
    const headers = [
      'STT',
      'Bữa ăn',
      'Thời gian',
      'Số món / NL',
      'Năng lượng (kcal)',
      'Tỷ lệ năng lượng (%)',
      'Khuyến nghị chuẩn NIN (%)',
      'Đánh giá phân bố',
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'medium');

    const meals = intake.khau_phan_24h_bua_an || intake.meals || [];
    let stt = 1;

    for (const m of meals) {
      const mealName = m.ten_bua || m.mealName || 'Bữa ăn';
      const mealItems = m.khau_phan_24h_nguyen_lieu || m.items || [];

      // Tính năng lượng bữa ăn
      let mealEnergy = 0;
      for (const item of mealItems) {
        const ing = item.nguyen_lieu || item.ingredient;
        const net = Number(item.khoi_luong_song_sach ?? item.netWeight ?? 0);
        if (ing && net > 0) {
          const rawE = Number(
            ing.energy ??
              Number(ing.protein || 0) * 4 +
                Number(ing.fat || 0) * 9 +
                Number(ing.carbohydrate || 0) * 4,
          );
          mealEnergy += (rawE * net) / 100.0;
        }
      }

      const mealRatio =
        totalDayEnergy > 0 ? Math.round((mealEnergy / totalDayEnergy) * 1000) / 10 : 0;
      const rec = this.getMealRecommendedRatio(mealName);

      const row = sheet.getRow(r++);
      row.height = 22;

      row.getCell(1).value = stt++;
      row.getCell(2).value = mealName;
      row.getCell(3).value = m.gio_an || m.time || '';
      row.getCell(4).value = mealItems.length;
      row.getCell(5).value = this.round2(mealEnergy);
      row.getCell(6).value = `${mealRatio}%`;
      row.getCell(7).value = `${rec.min}% - ${rec.max}%`;
      row.getCell(8).value =
        mealRatio < rec.min
          ? 'Bữa ăn nhẹ / Năng lượng thấp'
          : mealRatio > rec.max
            ? 'Bữa ăn nặng / Vượt mức khuyến nghị'
            : 'Phân bố lý tưởng';

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };

      const isOptimal = mealRatio >= rec.min && mealRatio <= rec.max;
      row.getCell(6).font = isOptimal ? EXCEL_STYLES.FONTS.OPTIMAL : EXCEL_STYLES.FONTS.WARNING;
      row.getCell(8).font = isOptimal ? EXCEL_STYLES.FONTS.OPTIMAL : EXCEL_STYLES.FONTS.WARNING;

      this.applyRowBorder(row, 'thin');
    }

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 22;
    sheet.getColumn(7).width = 26;
    sheet.getColumn(8).width = 34;
  }

  /**
   * Mẫu 4: Bảng chi tiết nguyên liệu thực phẩm tiêu thụ
   */
  private buildIngredientDetailsSheet(workbook: ExcelJS.Workbook, intake: any): void {
    const sheet = workbook.addWorksheet('Chi_tiet_nguyen_lieu', {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    r = this.writeClinicalPatientHeader(
      sheet,
      intake,
      r,
      'BẢNG KÊ CHI TIẾT NGUYÊN LIỆU THỰC PHẨM TIÊU THỤ TRONG 24 GIỜ',
    );
    r++;

    const headerRow = sheet.getRow(r++);
    headerRow.height = 26;
    const headers = [
      'STT',
      'Bữa ăn',
      'Tên nguyên liệu thực phẩm',
      'Sống sạch (g)',
      'Ăn được (%)',
      'Sống thô (g)',
      'Năng lượng (kcal)',
      'Đạm (g)',
      'Béo (g)',
      'Carb (g)',
      'Canxi (mg)',
      'Sắt (mg)',
      'Vitamin C (mg)',
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'medium');

    const meals = intake.khau_phan_24h_bua_an || intake.meals || [];
    let stt = 1;
    let sumNet = 0;
    let sumRaw = 0;
    let sumEnergy = 0;
    let sumP = 0;
    let sumF = 0;
    let sumC = 0;

    for (const m of meals) {
      const mealName = m.ten_bua || m.mealName || 'Bữa ăn';
      const items = m.khau_phan_24h_nguyen_lieu || m.items || [];

      for (const item of items) {
        const ing = item.nguyen_lieu || item.ingredient;
        const net = Number(item.khoi_luong_song_sach ?? item.netWeight ?? 0);
        const edible = Number(ing?.ty_le_an_duoc ?? ing?.edible ?? 100);
        const raw = edible > 0 ? net / (edible / 100.0) : net;

        const ratio = net / 100.0;
        const e =
          Number(ing?.energy ?? 0) * ratio ||
          (Number(ing?.protein || 0) * 4 +
            Number(ing?.fat || 0) * 9 +
            Number(ing?.carbohydrate || 0) * 4) *
            ratio;
        const p = Number(ing?.protein ?? 0) * ratio;
        const f = Number(ing?.fat ?? 0) * ratio;
        const c = Number(ing?.carbohydrate ?? 0) * ratio;
        const ca = Number(ing?.calci ?? 0) * ratio;
        const fe = Number(ing?.iron ?? 0) * ratio;
        const vc = Number(ing?.vitaminC ?? 0) * ratio;

        sumNet += net;
        sumRaw += raw;
        sumEnergy += e;
        sumP += p;
        sumF += f;
        sumC += c;

        const row = sheet.getRow(r++);
        row.height = 20;

        row.getCell(1).value = stt++;
        row.getCell(2).value = mealName;
        row.getCell(3).value =
          ing?.ten_nguyen_lieu ||
          ing?.material ||
          `NL #${item.nguyen_lieu_id || item.ingredientId}`;
        row.getCell(4).value = this.round2(net);
        row.getCell(5).value = this.round2(edible);
        row.getCell(6).value = this.round2(raw);
        row.getCell(7).value = this.round2(e);
        row.getCell(8).value = this.round2(p);
        row.getCell(9).value = this.round2(f);
        row.getCell(10).value = this.round2(c);
        row.getCell(11).value = this.round2(ca);
        row.getCell(12).value = this.round2(fe);
        row.getCell(13).value = this.round2(vc);

        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
        for (let colIdx = 4; colIdx <= 13; colIdx++) {
          row.getCell(colIdx).alignment = { vertical: 'middle', horizontal: 'right' };
        }
        this.applyRowBorder(row, 'thin');
      }
    }

    // Dòng Tổng cộng
    const sumRow = sheet.getRow(r++);
    sumRow.height = 24;
    sumRow.getCell(1).value = 'TỔNG CỘNG TIÊU THỤ 24H';
    sumRow.getCell(4).value = this.round2(sumNet);
    sumRow.getCell(6).value = this.round2(sumRaw);
    sumRow.getCell(7).value = this.round2(sumEnergy);
    sumRow.getCell(8).value = this.round2(sumP);
    sumRow.getCell(9).value = this.round2(sumF);
    sumRow.getCell(10).value = this.round2(sumC);
    sheet.mergeCells(r - 1, 1, r - 1, 3);
    this.formatTotalRowCells(sumRow, 13, 'FF1F497D', 'FFE8F0FE');

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 38;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 16;
    for (let c = 7; c <= 13; c++) {
      sheet.getColumn(c).width = 18;
    }
  }

  // ==========================================
  // CÁC HÀM TRỢ GIÚP DỮ LIỆU & FORMATTING
  // ==========================================

  private async fetchDailyIntakeWithRelations(
    dailyIntakeId: string | number | bigint,
    userId?: string,
  ): Promise<any> {
    const where: any = {
      id: BigInt(String(dailyIntakeId)),
    };

    if (userId) {
      where.nguoi_dung_id = userId;
    }

    return this.prisma.khau_phan_24h.findFirst({
      where,
      include: {
        benh_nhan: true,
        khau_phan_24h_bua_an: {
          include: {
            khau_phan_24h_nguyen_lieu: {
              include: {
                nguyen_lieu: true,
              },
            },
          },
          orderBy: { thu_tu_bua: 'asc' },
        },
      },
    });
  }

  private calculateIntakeNutrition(intake: any): {
    totalNutrients: Record<string, number>;
    tdee: number;
  } {
    const totalNutrients: Record<string, number> = {};
    const meals = intake.khau_phan_24h_bua_an || intake.meals || [];

    for (const m of meals) {
      const items = m.khau_phan_24h_nguyen_lieu || m.items || [];
      for (const item of items) {
        const ing = item.nguyen_lieu || item.ingredient;
        const net = Number(item.khoi_luong_song_sach ?? item.netWeight ?? 0);
        if (!ing || net <= 0) continue;

        const ratio = net / 100.0;
        for (const code of NUTRIENT_CODES) {
          const rawVal = Number(ing[code] ?? 0);
          totalNutrients[code] = (totalNutrients[code] || 0) + rawVal * ratio;
        }
      }
    }

    // Làm tròn 2 số thập phân
    for (const k of Object.keys(totalNutrients)) {
      totalNutrients[k] = this.round2(totalNutrients[k]);
    }

    // Tính TDEE của bệnh nhân
    const patient = intake.benh_nhan || intake.patient;
    let tdee = 2000;
    if (patient) {
      const weight = Number(patient.can_nang ?? patient.weight ?? 0);
      const height = Number(patient.chieu_cao ?? patient.height ?? 0);
      const dob = patient.ngay_sinh ? new Date(patient.ngay_sinh) : null;
      const age = dob
        ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
        : patient.age || 30;
      const isMale = String(patient.gioi_tinh ?? '').toUpperCase() === Gender.NAM;
      const pal = Number(patient.he_so_hoat_dong ?? patient.activityFactor ?? 1.2);

      if (weight > 0 && height > 0) {
        const bmr = isMale
          ? 10 * weight + 6.25 * height - 5 * age + 5
          : 10 * weight + 6.25 * height - 5 * age - 161;
        tdee = Math.round(bmr * pal);
      }
    }

    return { totalNutrients, tdee };
  }

  private writeClinicalPatientHeader(
    sheet: ExcelJS.Worksheet,
    intake: any,
    startRow: number,
    reportTitle: string,
  ): number {
    let r = startRow;
    const titleRow = sheet.getRow(r++);
    titleRow.height = 28;
    titleRow.getCell(1).value = reportTitle;
    titleRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 13,
      bold: true,
      color: { argb: 'FF1F497D' },
    };

    r++; // Cách dòng
    const patient = intake.benh_nhan || intake.patient;
    const intakeDateStr = intake.ngay_an
      ? new Date(intake.ngay_an).toLocaleDateString('vi-VN')
      : 'Hôm nay';

    r = this.writeKeyValue(sheet, r, 'Ngày khảo sát 24h:', intakeDateStr);
    if (patient) {
      const isMale = String(patient.gioi_tinh ?? '').toUpperCase() === Gender.NAM;
      const weight = Number(patient.can_nang ?? 0);
      const height = Number(patient.chieu_cao ?? 0);
      const heightM = height > 0 ? height / 100 : 0;
      const bmi =
        heightM > 0 && weight > 0 ? Math.round((weight / (heightM * heightM)) * 10) / 10 : 0;

      r = this.writeKeyValue(
        sheet,
        r,
        'Họ tên bệnh nhân:',
        patient.ho_ten || patient.fullName || '',
      );
      r = this.writeKeyValue(
        sheet,
        r,
        'Mã bệnh nhân:',
        patient.ma_benh_nhan_bv || patient.patientCode || '',
      );
      r = this.writeKeyValue(
        sheet,
        r,
        'Giới tính / Cân nặng / Chiều cao:',
        `${isMale ? 'Nam' : 'Nữ'} | ${weight}kg | ${height}cm`,
      );
      r = this.writeKeyValue(
        sheet,
        r,
        'BMI thể trạng:',
        bmi > 0 ? `${bmi} (${this.classifyBmi(bmi)})` : 'Chưa đo',
      );
    }

    return r;
  }

  private writeKeyValue(sheet: ExcelJS.Worksheet, r: number, key: string, val: any): number {
    const row = sheet.getRow(r);
    row.height = 20;
    row.getCell(1).value = key;
    row.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 10,
      bold: true,
      color: { argb: 'FF333333' },
    };
    row.getCell(2).value = val != null ? val : '';
    row.getCell(2).font = { name: EXCEL_FONT_FAMILY, size: 10 };
    return r + 1;
  }

  private async generateErrorExcelFile(
    sourceSheet: ExcelJS.Worksheet,
    errors: DailyIntakeRowValidationError[],
  ): Promise<Buffer> {
    const errWorkbook = new ExcelJS.Workbook();
    const errSheet = errWorkbook.addWorksheet('Ket_qua_kiem_tra', {
      views: [{ showGridLines: true }],
    });

    const errorByRow = new Map<number, string[]>();
    for (const err of errors) {
      if (!errorByRow.has(err.row)) {
        errorByRow.set(err.row, []);
      }
      errorByRow.get(err.row)!.push(`[${err.field}]: ${err.error}`);
    }

    // Sao chép dòng header + thêm cột lỗi
    const headerRow = errSheet.getRow(1);
    headerRow.height = 28;
    for (let c = 1; c <= DailyIntakeExcelService.EXPECTED_HEADERS.length; c++) {
      headerRow.getCell(c).value = sourceSheet.getRow(1).getCell(c).value;
      headerRow.getCell(c).font = EXCEL_STYLES.FONTS.HEADER;
      headerRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      headerRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
    }

    const errColIdx = DailyIntakeExcelService.EXPECTED_HEADERS.length + 1;
    headerRow.getCell(errColIdx).value = 'Chi tiết lỗi kiểm tra (Validation Errors)';
    headerRow.getCell(errColIdx).font = EXCEL_STYLES.FONTS.HEADER;
    headerRow.getCell(errColIdx).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC00000' }, // Đỏ đậm cảnh báo
    };
    headerRow.getCell(errColIdx).alignment = { vertical: 'middle', horizontal: 'center' };
    this.applyRowBorder(headerRow, 'medium');

    // Sao chép từng dòng dữ liệu và highlight dòng lỗi
    for (let r = 2; r <= sourceSheet.rowCount; r++) {
      const srcRow = sourceSheet.getRow(r);
      const isError = errorByRow.has(r);
      const targetRow = errSheet.getRow(r);
      targetRow.height = 22;

      for (let c = 1; c <= DailyIntakeExcelService.EXPECTED_HEADERS.length; c++) {
        targetRow.getCell(c).value = srcRow.getCell(c).value;
        if (isError) {
          targetRow.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: EXCEL_STYLES.COLORS.DEFICIENCY_RED_FILL },
          };
        }
      }

      if (isError) {
        targetRow.getCell(errColIdx).value = errorByRow.get(r)!.join(' | ');
        targetRow.getCell(errColIdx).font = EXCEL_STYLES.FONTS.ERROR;
        targetRow.getCell(errColIdx).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_STYLES.COLORS.DEFICIENCY_RED_FILL },
        };
      }

      this.applyRowBorder(targetRow, 'thin');
    }

    errSheet.getColumn(1).width = 20;
    errSheet.getColumn(2).width = 16;
    errSheet.getColumn(3).width = 38;
    errSheet.getColumn(4).width = 24;
    errSheet.getColumn(5).width = 24;
    errSheet.getColumn(errColIdx).width = 50;

    return Buffer.from(await errWorkbook.xlsx.writeBuffer());
  }

  private validateHeaderRow(row: ExcelJS.Row): boolean {
    if (!row) return false;
    for (let i = 0; i < 4; i++) {
      const cellVal = this.readCellString(row.getCell(i + 1)).toLowerCase();
      const expected = DailyIntakeExcelService.EXPECTED_HEADERS[i].toLowerCase();
      // Chấp nhận tương đối các header tiếng Việt
      if (!cellVal.includes(expected.split(' ')[0])) {
        return false;
      }
    }
    return true;
  }

  private groupValidRowsByMeal(rows: any[]): ParsedMealGroup[] {
    const mealMap = new Map<string, ParsedMealGroup>();
    let order = 1;

    for (const r of rows) {
      const key = r.mealName.trim().toLowerCase();
      if (!mealMap.has(key)) {
        mealMap.set(key, {
          mealName: r.mealName,
          mealTime: r.mealTime,
          order: order++,
          items: [],
        });
      }

      mealMap.get(key)!.items.push({
        ingredientId: r.ingredientId,
        ingredientName: r.ingredientName,
        netWeight: r.netWeight,
        notes: r.notes,
      });
    }

    return Array.from(mealMap.values());
  }

  private guessMealTime(mealName: string): string {
    const lower = mealName.toLowerCase();
    if (lower.includes('sáng') && !lower.includes('phụ')) return '07:00';
    if (lower.includes('phụ sáng')) return '09:30';
    if (lower.includes('trưa') && !lower.includes('phụ')) return '12:00';
    if (lower.includes('chiều') || lower.includes('xế')) return '15:30';
    if (lower.includes('tối') && !lower.includes('phụ')) return '18:30';
    if (lower.includes('phụ tối') || lower.includes('đêm')) return '21:00';
    return '12:00';
  }

  private getMealRecommendedRatio(mealName: string): { min: number; max: number } {
    const lower = mealName.toLowerCase();
    if (lower.includes('sáng') && !lower.includes('phụ')) {
      return {
        min: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_BREAKFAST_MIN,
        max: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_BREAKFAST_MAX,
      };
    }
    if (lower.includes('trưa') && !lower.includes('phụ')) {
      return {
        min: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_LUNCH_MIN,
        max: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_LUNCH_MAX,
      };
    }
    if (lower.includes('tối') && !lower.includes('phụ')) {
      return {
        min: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_DINNER_MIN,
        max: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_DINNER_MAX,
      };
    }
    return {
      min: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_SNACK_MIN,
      max: ENERGY_DISTRIBUTION_RECOMMENDED.MEAL_SNACK_MAX,
    };
  }

  private normalizeVietnameseKey(str: string): string {
    if (!str) return '';
    return str.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private hasRowContent(row: ExcelJS.Row): boolean {
    for (let c = 1; c <= 5; c++) {
      const val = this.readCellString(row.getCell(c));
      if (val && val.length > 0) return true;
    }
    return false;
  }

  private readCellString(cell?: ExcelJS.Cell | null): string {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    const val = cell.value;
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val).trim();
    if (typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      if ('text' in val && typeof (val as any).text === 'string') {
        return (val as any).text.trim();
      }
      if ('result' in val && (val as any).result !== undefined && (val as any).result !== null) {
        return String((val as any).result).trim();
      }
    }
    return String(val).trim();
  }

  private readCellNumber(cell?: ExcelJS.Cell | null): number {
    if (!cell || cell.value === null || cell.value === undefined) return 0;
    const val = cell.value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const normalized = val.replace(',', '.').trim();
      const num = Number(normalized);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private formatTotalRowCells(
    row: ExcelJS.Row,
    totalCols: number,
    textArgb: string,
    fillArgb: string,
  ): void {
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: textArgb } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillArgb },
      };
      if (c >= 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    }
    this.applyRowBorder(row, 'medium');
  }

  private applyRowBorder(row: ExcelJS.Row, borderStyle: 'thin' | 'medium'): void {
    const count = Math.max(row.cellCount, 8);
    for (let c = 1; c <= count; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        bottom: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        left: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        right: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      };
    }
  }

  private classifyBmi(bmi: number): string {
    if (bmi <= 0) return '';
    if (bmi < 18.5) return 'Gầy';
    if (bmi <= 22.9) return 'Bình thường';
    if (bmi <= 24.9) return 'Tiền béo phì';
    if (bmi <= 29.9) return 'Béo phì độ 1';
    return 'Béo phì độ 2';
  }

  private round2(val: number): number {
    return Math.round((Number(val) || 0) * 100) / 100;
  }
}
