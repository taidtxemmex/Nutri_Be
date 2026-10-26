import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../core/database/prisma.service';
import { NutritionCalculatorService } from '../../../core/nutrition-engine/nutrition-calculator.service';
import {
  ALL_INDICATOR_CODES,
  NUTRIENT_METADATA_MAP,
} from '../../../core/nutrition-engine/nutrition.constants';
import {
  computeRecipeHash,
  RecipeComponentInput,
} from '../../../core/nutrition-engine/recipe-hash.util';
import { ExportDishDto } from '../dto/export-dish.dto';
import { CacheService } from '../../../core/cache/cache.service';

export interface DishImportResult {
  success: boolean;
  importedCount: number;
  message?: string;
  errorFileName?: string;
  errorFileBuffer?: Buffer;
  errorsCount?: number;
  totalRows?: number;
}

export interface DishExportColumn {
  key: string;
  header: string;
  unit: string;
}

export function normalizeVietnameseNFC(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').trim();
}

export function normalizeDishKey(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export const DEFAULT_DISH_EXPORT_KEYS: string[] = [
  'energy',
  'protein',
  'fat',
  'carbohydrate',
  'fiber',
  'calci',
  'iron',
  'sodium',
  'potassium',
  'vitaminC',
  'vitaminARae',
];

interface DishDraft {
  name: string;
  weights: Map<bigint, number>;
  components: RecipeComponentInput[];
}

@Injectable()
export class DishExcelService {
  private readonly logger = new Logger(DishExcelService.name);

  private static readonly DATA_SHEET = 'Mon_an';
  private static readonly GUIDE_SHEET = 'Huong_dan';
  private static readonly INGREDIENT_SHEET = 'DS_nguyen_lieu';
  private static readonly EXPORT_SHEET = 'Dish_Nutrition_Detail';
  private static readonly RESULT_HEADER = 'Kết quả import';

  private static readonly MAX_ROWS = 1000;
  private static readonly MAX_NAME_LENGTH = 255;
  private static readonly MAX_WEIGHT = 100000;

  private static readonly EXPECTED_HEADERS = ['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)'];

  private static readonly TEMPLATE_CACHE_KEY = 'dish:import-template:buffer';
  private static readonly TEMPLATE_CACHE_TAG = 'ingredients';
  private static readonly TEMPLATE_CACHE_TTL_MS = 1800000; // 30 phút

  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionCalculator: NutritionCalculatorService = new NutritionCalculatorService(),
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Tạo template Excel mẫu để import món ăn kèm bộ đệm CacheService (0ms response)
   * Kiểm tra xem danh sách nguyên liệu liên quan đã mới nhất chưa, tránh query database liên tục
   */
  async generateTemplate(): Promise<Buffer> {
    return this.generateImportTemplate();
  }

  async generateImportTemplate(): Promise<Buffer> {
    // 1. Kiểm tra cache trong RAM trước tiên
    if (this.cacheService) {
      const cached = this.cacheService.get<Buffer>(DishExcelService.TEMPLATE_CACHE_KEY);
      if (cached && Buffer.isBuffer(cached)) {
        this.logger.debug('🚀 [Cache Hit] Trả về template import món ăn tức thì từ bộ đệm (0ms)');
        return cached;
      }
    }

    this.logger.debug(
      '🔄 [Cache Miss] Đang tạo mới file Excel mẫu và nạp danh mục nguyên liệu từ DB...',
    );

    // 2. Tạo mới Workbook với thiết kế giao diện y khoa hiện đại, rõ ràng, đẹp mắt
    const buffer = await this.buildTemplateWorkbook();

    // 3. Lưu vào CacheService với tag 'ingredients' (tự động invalidate khi nguyên liệu thay đổi)
    if (this.cacheService) {
      this.cacheService.set(
        DishExcelService.TEMPLATE_CACHE_KEY,
        buffer,
        DishExcelService.TEMPLATE_CACHE_TTL_MS,
        DishExcelService.TEMPLATE_CACHE_TAG,
      );
      this.logger.debug('💾 Đã lưu template Excel vào bộ nhớ đệm (TTL 30m, tag=ingredients)');
    }

    return buffer;
  }

  /**
   * Xây dựng Workbook mẫu với định dạng chuẩn mực, sang trọng và rõ ràng
   */
  private async buildTemplateWorkbook(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical Intelligence';
    workbook.created = new Date();

    // 1. Sheet Mon_an (Sheet chính để người dùng nhập liệu)
    const dataSheet = workbook.addWorksheet(DishExcelService.DATA_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });
    const guideSheet = workbook.addWorksheet(DishExcelService.GUIDE_SHEET, {
      views: [{ showGridLines: true }],
    });
    const refSheet = workbook.addWorksheet(DishExcelService.INGREDIENT_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });

    // Cấu hình Header cho Mon_an: Đẹp, trang nhã, màu đỏ cảnh báo bắt buộc
    const headerRow = dataSheet.addRow(DishExcelService.EXPECTED_HEADERS);
    headerRow.height = 30;
    headerRow.font = { bold: true, color: { argb: 'FFFF0000' }, size: 11, name: 'Calibri' };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4F6F9' },
    };

    // Độ rộng các cột chuẩn hóa (khớp 1:1 với Java cũ: 11000/256 ≈ 43, 6000/256 ≈ 23.5)
    dataSheet.getColumn(1).width = 43; // Tên món ăn
    dataSheet.getColumn(2).width = 43; // Tên nguyên liệu
    dataSheet.getColumn(3).width = 24; // KL sống sạch (g)

    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        bottom: { style: 'medium', color: { argb: 'FF1F497D' } },
        left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      };
    });

    // Lấy danh sách nguyên liệu từ CSDL
    const ingredients = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null },
      select: { ten_nguyen_lieu: true },
      orderBy: { ten_nguyen_lieu: 'asc' },
    });

    const ingredientNames = ingredients
      .map((i) => i.ten_nguyen_lieu)
      .filter((name): name is string => !!name && name.trim().length > 0);

    // 2. Sheet DS_nguyen_lieu (Danh sách nguyên liệu để làm menu thả xuống)
    const refHeaderRow = refSheet.addRow(['Tên nguyên liệu']);
    refHeaderRow.height = 28;
    refHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    refHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' }, // Xanh Navy sang trọng
    };
    refHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    refSheet.getColumn(1).width = 45;

    // Zebra striping tinh tế cho danh sách nguyên liệu
    ingredientNames.forEach((name, index) => {
      const row = refSheet.addRow([name]);
      row.height = 20;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(1).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (index % 2 === 1) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    });

    // Thiết lập Data Validation cho sheet Mon_an (hàng 2 đến 1000)
    const totalRefIngredients = ingredientNames.length;
    for (let r = 2; r <= DishExcelService.MAX_ROWS; r++) {
      if (totalRefIngredients > 0) {
        dataSheet.getCell(`B${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`${DishExcelService.INGREDIENT_SHEET}!$A$2:$A$${totalRefIngredients + 1}`],
          showErrorMessage: true,
          errorTitle: 'Tên nguyên liệu',
          error: 'Vui lòng chọn từ danh sách',
        };
      }

      dataSheet.getCell(`C${r}`).dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: ['0.001', String(DishExcelService.MAX_WEIGHT)],
        showErrorMessage: true,
        errorTitle: 'Khối lượng',
        error: 'Nhập số lớn hơn 0 (gam)',
      };
    }

    // 3. Sheet Huong_dan (Hướng dẫn quy tắc nhập liệu và ví dụ mẫu)
    this.populateGuideSheet(guideSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Tạo sheet Hướng dẫn nhập liệu đẹp mắt, chuẩn 1:1 với Java cũ
   */
  private populateGuideSheet(guideSheet: ExcelJS.Worksheet): void {
    const boldFont = { bold: true, size: 11, name: 'Calibri' };

    const lines = [
      'HƯỚNG DẪN IMPORT MÓN ĂN',
      'Quy tắc:',
      `• Nhập dữ liệu ở sheet '${DishExcelService.DATA_SHEET}', bắt đầu từ dòng 2. Không sửa / đổi thứ tự dòng tiêu đề.`,
      '• Cả 3 cột đều bắt buộc. Mỗi dòng = 1 nguyên liệu của món.',
      '• Tên món: CHỈ điền ở dòng ĐẦU TIÊN của mỗi món, các dòng sau ĐỂ TRỐNG = cùng món với dòng phía trên.',
      '• KHÔNG sort / lọc lại dữ liệu trước khi import (sẽ làm sai món).',
      `• Tên nguyên liệu: chọn từ dropdown (lấy từ sheet '${DishExcelService.INGREDIENT_SHEET}') hoặc nhập tay đúng tên nguyên liệu.`,
      '• Khối lượng nhập là khối lượng SỐNG SẠCH (g).',
      '• Nguyên liệu trùng trong cùng 1 món sẽ được cộng dồn khối lượng.',
      '• Tên món không được trùng món bạn đã có, và không được xuất hiện ở 2 khối khác nhau trong file.',
      `• Tối đa ${DishExcelService.MAX_ROWS} dòng / file.`,
      'Ví dụ dữ liệu (chỉ để tham khảo, KHÔNG nhập vào sheet này):',
    ];

    for (let i = 0; i < lines.length; i++) {
      const row = guideSheet.addRow([lines[i]]);
      row.height = 20;
      if (i === 0) {
        row.height = 26;
        row.getCell(1).font = {
          bold: true,
          size: 13,
          name: 'Calibri',
          color: { argb: 'FF1F497D' },
        };
      } else if (i === 1 || i === lines.length - 1) {
        row.getCell(1).font = boldFont;
      }
    }

    // Ví dụ mẫu khớp 1:1 với Java cũ
    const example: [string, string, any][] = [
      ['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)'],
      ['Phở bò', 'Bánh phở', 120],
      ['', 'Thịt bò', 50],
      ['Cơm trắng', 'Gạo tẻ', 80],
    ];

    for (let r = 0; r < example.length; r++) {
      const row = guideSheet.addRow(example[r]);
      row.height = 22;
      if (r === 0) {
        row.height = 26;
        row.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2E7D32' }, // Xanh lá cây y tế nổi bật
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      } else {
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      }
      this.applyRowBorder(row);
    }

    guideSheet.getColumn(1).width = 43;
    guideSheet.getColumn(2).width = 43;
    guideSheet.getColumn(3).width = 24;
  }

  /**
   * Import danh sách món ăn từ Excel với atomic transaction và validation theo khối dòng liên tiếp
   */
  async importExcel(fileBuffer: Buffer, userId: string): Promise<DishImportResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có dữ liệu để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (err: any) {
      this.logger.error(`Lỗi đọc tập tin Excel: ${err.message}`, err.stack);
      throw new HttpException(
        {
          code: 'IMPORT_FILE_CORRUPTED',
          message: 'Tập tin Excel bị hỏng hoặc không đúng định dạng (.xlsx)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const sheet = workbook.getWorksheet(DishExcelService.DATA_SHEET) || workbook.worksheets[0];

    if (!sheet || sheet.rowCount <= 1) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có dữ liệu để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Kiểm tra Tiêu đề ở dòng 1
    const headerRow = sheet.getRow(1);
    if (!this.validateHeaderRow(headerRow)) {
      throw new HttpException(
        {
          code: 'IMPORT_INVALID_TEMPLATE',
          message:
            'Tiêu đề các cột không đúng mẫu quy định. Yêu cầu đúng: [Tên món ăn, Tên nguyên liệu, KL sống sạch (g)]',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Nạp toàn bộ nguyên liệu vào RAM Map để tra cứu O(1)
    const allIngredients = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null },
      select: { id: true, ten_nguyen_lieu: true },
    });

    const ingredientMap = new Map<string, bigint>();
    for (const ing of allIngredients) {
      if (ing.ten_nguyen_lieu) {
        ingredientMap.set(normalizeVietnameseNFC(ing.ten_nguyen_lieu).toLowerCase(), ing.id);
      }
    }

    // Nạp các món ăn hiện có của user để chống trùng lặp
    const existingDishes = await this.prisma.mon_an.findMany({
      where: { nguoi_dung_id: userId, deleted_at: null },
      select: { ten_mon: true },
    });
    const userDishNames = new Set<string>();
    for (const d of existingDishes) {
      if (d.ten_mon) {
        userDishNames.add(normalizeDishKey(d.ten_mon));
      }
    }

    const seenDishNamesInFile = new Set<string>();
    const dishDrafts: DishDraft[] = [];
    let currentDraft: DishDraft | null = null;
    const rowErrors: Map<number, string> = new Map();

    const maxRow = Math.min(sheet.rowCount, DishExcelService.MAX_ROWS + 1);

    for (let r = 2; r <= maxRow; r++) {
      const row = sheet.getRow(r);
      const isBlank = !this.hasRowValues(row);
      if (isBlank) continue;

      const rawDishName = this.readCellString(row.getCell(1));
      const rawIngName = this.readCellString(row.getCell(2));
      const rawWeight = this.readCellString(row.getCell(3));

      // 1. Kiểm tra tên món
      if (rawDishName && rawDishName.length > 0) {
        if (rawDishName.length > DishExcelService.MAX_NAME_LENGTH) {
          rowErrors.set(r, `Tên món vượt quá ${DishExcelService.MAX_NAME_LENGTH} ký tự`);
        }
        const key = normalizeDishKey(rawDishName);
        if (seenDishNamesInFile.has(key)) {
          rowErrors.set(r, `Tên món '${rawDishName}' xuất hiện ở nhiều khối rời rạc trong file`);
        } else if (userDishNames.has(key)) {
          rowErrors.set(r, `Bạn đã có món '${rawDishName}'`);
        } else {
          seenDishNamesInFile.add(key);
        }

        currentDraft = {
          name: rawDishName,
          weights: new Map(),
          components: [],
        };
        dishDrafts.push(currentDraft);
      }

      if (!currentDraft) {
        if (!rowErrors.has(r)) {
          rowErrors.set(
            r,
            'Dòng nguyên liệu không thuộc món ăn nào (thiếu tên món ở dòng đầu khối)',
          );
        }
        continue;
      }

      // 2. Kiểm tra tên nguyên liệu
      if (!rawIngName || rawIngName.length === 0) {
        if (!rowErrors.has(r)) {
          rowErrors.set(r, 'Tên nguyên liệu không được để trống');
        }
        continue;
      }

      const ingKey = normalizeVietnameseNFC(rawIngName).toLowerCase();
      const ingId = ingredientMap.get(ingKey);
      if (!ingId) {
        if (!rowErrors.has(r)) {
          rowErrors.set(r, `Không tìm thấy nguyên liệu '${rawIngName}' trong hệ thống`);
        }
        continue;
      }

      // 3. Kiểm tra khối lượng sống sạch
      const { weight, error: weightError } = this.parseWeight(rawWeight);
      if (weightError || weight === null) {
        if (!rowErrors.has(r)) {
          rowErrors.set(r, weightError || 'Khối lượng sống sạch không hợp lệ');
        }
        continue;
      }

      // Cộng dồn nguyên liệu trùng trong cùng một món
      const prevWeight = currentDraft.weights.get(ingId) || 0;
      currentDraft.weights.set(ingId, prevWeight + weight);
    }

    // Nếu có lỗi -> Trả về file Excel kèm cột Kết quả import
    if (rowErrors.size > 0) {
      const errorBuffer = await this.generateErrorExcelFile(sheet, rowErrors);
      return {
        success: false,
        importedCount: 0,
        errorsCount: rowErrors.size,
        totalRows: sheet.rowCount - 1,
        message: `Import thất bại: Phát hiện ${rowErrors.size} dòng bị lỗi. Vui lòng tải file lỗi để xem chi tiết.`,
        errorFileName: 'dish_import_errors.xlsx',
        errorFileBuffer: errorBuffer,
      };
    }

    if (dishDrafts.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_NO_VALID_DISHES',
          message: 'Không tìm thấy món ăn nào hợp lệ để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Lưu vào CSDL trong 1 atomic transaction
    await this.prisma.$transaction(async (tx) => {
      for (const draft of dishDrafts) {
        const components: RecipeComponentInput[] = [];
        for (const [ingId, weight] of draft.weights.entries()) {
          components.push({
            ingredientId: ingId,
            weight: weight,
          });
        }

        const recipeHash = computeRecipeHash(components);

        const newDish = await tx.mon_an.create({
          data: {
            nguoi_dung_id: userId,
            ten_mon: draft.name,
            trang_thai: 'RIENG_TU',
            recipe_hash: recipeHash,
            ngay_tao: new Date(),
          },
        });

        const detailRows = components.map((c) => ({
          mon_an_id: newDish.id,
          nguyen_lieu_id: BigInt(c.ingredientId),
          khoi_luong_song_sach: Number(c.weight) || 0,
        }));

        for (const row of detailRows) {
          await tx.chi_tiet_mon_an.create({ data: row });
        }
      }
    });

    this.logger.log(
      `IMPORT DISHES SUCCESS | userId=${userId} | importedCount=${dishDrafts.length}`,
    );

    return {
      success: true,
      importedCount: dishDrafts.length,
      errorsCount: 0,
      totalRows: sheet.rowCount - 1,
      message: `Nhập thành công ${dishDrafts.length} món ăn vào hệ thống`,
    };
  }

  /**
   * Xuất danh sách món ăn ra Excel kèm 86 chỉ tiêu vi chất (Hỗ trợ cả ExportDishDto và danh sách món trực tiếp)
   */
  async exportDishes(
    dtoOrDishes: ExportDishDto | any[],
    currentUserOrColumns?: any,
  ): Promise<Buffer> {
    let dishes: any[] = [];
    let selectedColumns: string[] | undefined = undefined;

    if (Array.isArray(dtoOrDishes)) {
      dishes = dtoOrDishes;
      selectedColumns = Array.isArray(currentUserOrColumns) ? currentUserOrColumns : undefined;
    } else {
      const dto = dtoOrDishes as ExportDishDto;
      const currentUser = currentUserOrColumns as { id: string };
      selectedColumns = dto.columns;

      const whereClause: any = {
        deleted_at: null,
      };

      if (currentUser?.id) {
        whereClause.nguoi_dung_id = currentUser.id;
      }

      if (dto.keyword && dto.keyword.trim()) {
        whereClause.ten_mon = { contains: dto.keyword.trim() };
      }

      dishes = await this.prisma.mon_an.findMany({
        where: whereClause,
        include: {
          chi_tiet_mon_an: {
            include: { nguyen_lieu: true },
          },
        },
        orderBy: { id: 'desc' },
      });
    }

    const columnsToExport = this.resolveExportColumns(selectedColumns);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical Intelligence';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(DishExcelService.EXPORT_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });

    const fixedHeaders = ['Món ăn', 'Tên TP', 'Sống sạch (g)', 'Ăn được (%)', 'Sống thô (g)'];

    const allHeaders = [...fixedHeaders, ...columnsToExport.map((c) => c.header)];
    const headerRow = sheet.addRow(allHeaders);
    headerRow.height = 28;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' }, // Navy sang trọng
    };

    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 16;
    for (let c = 6; c <= allHeaders.length; c++) {
      sheet.getColumn(c).width = 18;
    }

    let currentRowIdx = 2;

    for (const dish of dishes) {
      const details = dish.chi_tiet_mon_an || [];
      const dishStartRow = currentRowIdx;
      const dishName = dish.ten_mon || dish.name || '';

      const detailNutrientList: Array<Record<string, number>> = [];

      for (let i = 0; i < details.length; i++) {
        const d = details[i];
        const ing = d.nguyen_lieu || d.ingredient;
        const net = Number(d.khoi_luong_song_sach ?? d.netWeight ?? 0);
        const edible = Number(ing?.ty_le_an_duoc ?? ing?.edible ?? 100);
        const raw = edible > 0 ? (net / edible) * 100 : 0;

        const rowValues: any[] = [
          i === 0 ? dishName : '',
          ing?.ten_nguyen_lieu ?? ing?.material ?? `NL #${d.nguyen_lieu_id}`,
          this.round2(net),
          this.round2(edible),
          this.round2(raw),
        ];

        const ingNutrients: Record<string, number> = {};
        if (ing) {
          const ratio = net / 100.0;
          for (const col of columnsToExport) {
            const rawVal = Number(ing[col.key] ?? 0);
            const val = this.round2(rawVal * ratio);
            ingNutrients[col.key] = val;
            rowValues.push(val);
          }
        } else {
          for (const col of columnsToExport) {
            ingNutrients[col.key] = 0;
            rowValues.push(0);
          }
        }

        detailNutrientList.push(ingNutrients);

        const dataRow = sheet.addRow(rowValues);
        dataRow.height = 20;
        this.applyRowBorder(dataRow);
        dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        for (let colIdx = 3; colIdx <= allHeaders.length; colIdx++) {
          dataRow.getCell(colIdx).alignment = { vertical: 'middle', horizontal: 'right' };
        }

        currentRowIdx++;
      }

      // Merge ô Món ăn theo chiều dọc nếu món có từ 2 nguyên liệu trở lên
      if (details.length > 1) {
        sheet.mergeCells(`A${dishStartRow}:A${currentRowIdx - 1}`);
      }

      // Dòng TỔNG MÓN
      const totalRowValues: any[] = ['TỔNG MÓN', '', '', '', ''];
      for (const col of columnsToExport) {
        const sumVal = detailNutrientList.reduce((acc, curr) => acc + (curr[col.key] || 0), 0);
        totalRowValues.push(this.round2(sumVal));
      }

      const totalRow = sheet.addRow(totalRowValues);
      totalRow.height = 24;
      sheet.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);

      totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      totalRow.getCell(1).font = { bold: true, color: { argb: 'FF1A73E8' } };
      totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F0FE' },
      };

      for (let colIdx = 6; colIdx <= allHeaders.length; colIdx++) {
        const cell = totalRow.getCell(colIdx);
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.font = { bold: true, color: { argb: 'FF1A73E8' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F0FE' },
        };
      }

      this.applyRowBorder(totalRow);
      currentRowIdx++;

      // Dòng trống ngăn cách giữa các món
      const emptyRow = sheet.addRow([]);
      emptyRow.height = 12;
      currentRowIdx++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===== PRIVATE HELPERS =====

  private validateHeaderRow(row: ExcelJS.Row): boolean {
    if (!row) return false;
    for (let i = 0; i < DishExcelService.EXPECTED_HEADERS.length; i++) {
      const cellText = this.readCellString(row.getCell(i + 1));
      if (cellText !== DishExcelService.EXPECTED_HEADERS[i]) {
        return false;
      }
    }
    return true;
  }

  private hasRowValues(row: ExcelJS.Row): boolean {
    for (let c = 1; c <= DishExcelService.EXPECTED_HEADERS.length; c++) {
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
      if ('richText' in val && Array.isArray((val as any).richText)) {
        return (val as any).richText
          .map((t: any) => t.text || '')
          .join('')
          .trim();
      }
    }
    return String(val).trim();
  }

  private parseWeight(raw: string): { weight: number | null; error?: string } {
    if (!raw || raw.length === 0) {
      return { weight: null, error: 'Khối lượng sống sạch không được để trống' };
    }
    const normalized = raw.replace(',', '.');
    const num = Number(normalized);
    if (isNaN(num)) {
      return { weight: null, error: 'Khối lượng sống sạch không phải là số hợp lệ' };
    }
    if (num <= 0 || num > DishExcelService.MAX_WEIGHT) {
      return {
        weight: null,
        error: `Khối lượng phải lớn hơn 0 và không quá ${DishExcelService.MAX_WEIGHT}g`,
      };
    }
    return { weight: num };
  }

  private resolveExportColumns(selectedColumns?: string[]): DishExportColumn[] {
    const allAvailableColumns: DishExportColumn[] = ALL_INDICATOR_CODES.map((code) => {
      const meta = NUTRIENT_METADATA_MAP[code];
      return {
        key: code,
        header: meta ? `${meta.nameVi} (${meta.unit})` : `${code}`,
        unit: meta ? meta.unit : '',
      };
    });

    if (!selectedColumns || !Array.isArray(selectedColumns) || selectedColumns.length === 0) {
      return allAvailableColumns.filter((col) => DEFAULT_DISH_EXPORT_KEYS.includes(col.key));
    }

    const lowerRequested = selectedColumns.map((c) => c.trim().toLowerCase());

    const matched = allAvailableColumns.filter((col) => {
      const keyLower = col.key.toLowerCase();
      const headerLower = col.header.toLowerCase();
      return lowerRequested.some(
        (req) => req === keyLower || headerLower.includes(req) || req.includes(keyLower),
      );
    });

    if (matched.length === 0) {
      return allAvailableColumns.filter((col) => DEFAULT_DISH_EXPORT_KEYS.includes(col.key));
    }

    return matched;
  }

  private applyRowBorder(row: ExcelJS.Row): void {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
        right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      };
    });
  }

  private round2(value: number): number {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Math.round(value * 100.0) / 100.0;
  }

  private async generateErrorExcelFile(
    sourceSheet: ExcelJS.Worksheet,
    rowErrors: Map<number, string>,
  ): Promise<Buffer> {
    const errorWorkbook = new ExcelJS.Workbook();
    const errorSheet = errorWorkbook.addWorksheet(DishExcelService.DATA_SHEET, {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });

    const newHeaders = [...DishExcelService.EXPECTED_HEADERS, DishExcelService.RESULT_HEADER];
    const headerRow = errorSheet.addRow(newHeaders);
    headerRow.height = 30;
    headerRow.font = { bold: true, color: { argb: 'FFC62828' }, size: 11, name: 'Calibri' };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4F6F9' },
    };

    errorSheet.getColumn(1).width = 38;
    errorSheet.getColumn(2).width = 38;
    errorSheet.getColumn(3).width = 24;
    errorSheet.getColumn(4).width = 45;

    for (let r = 2; r <= sourceSheet.rowCount; r++) {
      const srcRow = sourceSheet.getRow(r);
      const isBlank = !this.hasRowValues(srcRow);
      if (isBlank) continue;

      const errorMsg = rowErrors.get(r);
      const rowValues = [
        this.readCellString(srcRow.getCell(1)),
        this.readCellString(srcRow.getCell(2)),
        this.readCellString(srcRow.getCell(3)),
        errorMsg ? `LỖI: ${errorMsg}` : 'HỢP LỆ',
      ];

      const newRow = errorSheet.addRow(rowValues);
      newRow.height = 22;
      this.applyRowBorder(newRow);

      const statusCell = newRow.getCell(4);
      if (errorMsg) {
        statusCell.font = { bold: true, color: { argb: 'FFD32F2F' } };
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' },
        };
      } else {
        statusCell.font = { bold: true, color: { argb: 'FF2E7D32' } };
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F5E9' },
        };
      }
    }

    const buffer = await errorWorkbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
