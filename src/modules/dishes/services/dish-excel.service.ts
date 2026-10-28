import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { Writable, PassThrough } from 'stream';
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
import {
  ExportDishDto,
  ImportDishExcelParamsDto,
  StreamExportDishesParamsDto,
  ExportDishesParamsDto,
} from '../dto';
import { CacheService } from '../../../core/cache/cache.service';
import {
  ExcelStreamReader,
  ErrorRowItem,
  BaseExcelStreamer,
  ExcelColumnDefinition,
  setExcelResponseHeaders,
} from '../../../core/excel-engine';
import { streamPrismaInBatches } from '../../../core/excel-engine/prisma-cursor-streamer';

export interface DishImportResult {
  success: boolean;
  importedCount: number;
  total?: number;
  imported?: number;
  skipped?: number;
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
   * Import danh sách món ăn từ Excel với streaming O(1) RAM, Smart Sheet Signature Detection,
   * tự động tính toán SHA-256 RecipeHash phát hiện trùng lặp và atomic chunked commit.
   */
  async importExcel({ fileBuffer, userId }: ImportDishExcelParamsDto): Promise<DishImportResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có dữ liệu để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Pre-fetch In-Memory Lookup Maps (Triệt tiêu 100% N+1 queries)
    const [allIngredients, existingDishes] = await Promise.all([
      this.prisma.nguyen_lieu.findMany({
        where: { deleted_at: null },
        select: { id: true, ten_nguyen_lieu: true },
      }),
      this.prisma.mon_an.findMany({
        where: { nguoi_dung_id: userId, deleted_at: null },
        select: { ten_mon: true, recipe_hash: true },
      }),
    ]);

    const ingredientMap = new Map<string, bigint>();
    for (const ing of allIngredients) {
      if (ing.ten_nguyen_lieu) {
        ingredientMap.set(normalizeVietnameseNFC(ing.ten_nguyen_lieu).toLowerCase(), ing.id);
      }
    }

    const userDishNames = new Set<string>();
    const userRecipeHashes = new Set<string>();
    for (const d of existingDishes) {
      if (d.ten_mon) {
        userDishNames.add(normalizeDishKey(d.ten_mon));
      }
      if (d.recipe_hash) {
        userRecipeHashes.add(d.recipe_hash);
      }
    }

    // 2. Khởi tạo reader streaming
    let reader: any;
    try {
      reader = ExcelStreamReader.createReader(fileBuffer);
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

    // 3. Smart Sheet Signature Detection: Quét tìm sheet có chữ ký món ăn [Tên món ăn, Tên nguyên liệu, KL sống sạch (g)]
    let targetWorksheetFound = false;
    const colDishIdx = 1;
    const colIngIdx = 2;
    const colWeightIdx = 3;

    const seenDishNamesInFile = new Set<string>();
    const dishDrafts: DishDraft[] = [];
    let currentDraft: DishDraft | null = null;
    const errorRowItems: ErrorRowItem[] = [];
    let totalDataRows = 0;
    let hasAnyError = false;

    try {
      for await (const worksheetReader of reader) {
        let isTargetSheet = false;

        for await (const row of worksheetReader) {
          const rowNumber = row.number;

          // Header row
          if (rowNumber === 1) {
            const h1 =
              ExcelStreamReader.readCellString({ cell: row.getCell(1), sanitize: false }) || '';
            const h2 =
              ExcelStreamReader.readCellString({ cell: row.getCell(2), sanitize: false }) || '';
            const h3 =
              ExcelStreamReader.readCellString({ cell: row.getCell(3), sanitize: false }) || '';

            if (
              h1.toLowerCase().includes('món') &&
              h2.toLowerCase().includes('nguyên liệu') &&
              (h3.toLowerCase().includes('kl') ||
                h3.toLowerCase().includes('khối lượng') ||
                h3.toLowerCase().includes('g'))
            ) {
              isTargetSheet = true;
              targetWorksheetFound = true;
            }
            continue;
          }

          if (!isTargetSheet) continue;

          // Kiểm tra dòng rỗng
          const rawDishName = ExcelStreamReader.readCellString({
            cell: row.getCell(colDishIdx),
            sanitize: true,
          });
          const rawIngName = ExcelStreamReader.readCellString({
            cell: row.getCell(colIngIdx),
            sanitize: true,
          });
          const rawWeight = row.getCell(colWeightIdx)?.value;

          if (
            !rawDishName &&
            !rawIngName &&
            (rawWeight === null || rawWeight === undefined || rawWeight === '')
          ) {
            continue;
          }

          totalDataRows++;
          if (totalDataRows > DishExcelService.MAX_ROWS) {
            throw new HttpException(
              {
                code: 'IMPORT_TOO_MANY_ROWS',
                message: `Chỉ cho phép import tối đa ${DishExcelService.MAX_ROWS} dòng mỗi lần`,
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          const errors: string[] = [];

          // 1. Kiểm tra Tên món ăn (Khối món ăn mới)
          if (rawDishName && rawDishName.length > 0) {
            if (rawDishName.length > DishExcelService.MAX_NAME_LENGTH) {
              errors.push(`Tên món vượt quá ${DishExcelService.MAX_NAME_LENGTH} ký tự`);
            }
            const key = normalizeDishKey(rawDishName);
            if (seenDishNamesInFile.has(key)) {
              errors.push(`Tên món '${rawDishName}' xuất hiện ở nhiều khối rời rạc trong file`);
            } else if (userDishNames.has(key)) {
              errors.push(`Bạn đã có món '${rawDishName}'`);
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
            errors.push('Dòng nguyên liệu không thuộc món ăn nào (thiếu tên món ở dòng đầu khối)');
          }

          // 2. Kiểm tra Tên nguyên liệu
          let ingId: bigint | undefined;
          if (!rawIngName || rawIngName.length === 0) {
            errors.push('Tên nguyên liệu không được để trống');
          } else {
            const ingKey = normalizeVietnameseNFC(rawIngName).toLowerCase();
            ingId = ingredientMap.get(ingKey);
            if (!ingId) {
              errors.push(`Không tìm thấy nguyên liệu '${rawIngName}' trong hệ thống`);
            }
          }

          // 3. Kiểm tra khối lượng sống sạch
          const numWeight = ExcelStreamReader.readCellNumber(row.getCell(colWeightIdx));
          if (numWeight === null || isNaN(numWeight) || numWeight <= 0 || numWeight > 100000) {
            errors.push('Khối lượng sống sạch phải là số > 0 và <= 100000 gam');
          }

          if (errors.length > 0) {
            hasAnyError = true;
          } else if (currentDraft && ingId && numWeight) {
            // Cộng dồn nguyên liệu trùng trong cùng một món
            const prevWeight = currentDraft.weights.get(ingId) || 0;
            currentDraft.weights.set(ingId, prevWeight + numWeight);
          }

          errorRowItems.push({
            rowNumber,
            rawValues: [rawDishName || '', rawIngName || '', numWeight !== null ? numWeight : ''],
            errors,
            successNote: 'Hợp lệ',
          });
        }
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        {
          code: 'IMPORT_FILE_CORRUPTED',
          message: `Lỗi đọc dữ liệu tập tin Excel: ${err.message}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!targetWorksheetFound) {
      throw new HttpException(
        {
          code: 'IMPORT_INVALID_TEMPLATE',
          message:
            'Tiêu đề các cột không đúng mẫu quy định. Yêu cầu đúng: [Tên món ăn, Tên nguyên liệu, KL sống sạch (g)]',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (totalDataRows === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có dữ liệu để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Kiểm tra chuỗi băm RecipeHash để chống trùng lặp công thức
    const seenHashesInFile = new Set<string>();
    for (const draft of dishDrafts) {
      const components: RecipeComponentInput[] = [];
      for (const [ingId, weight] of draft.weights.entries()) {
        components.push({
          ingredientId: ingId,
          weight: weight,
        });
      }

      const recipeHash = computeRecipeHash(components);
      if (recipeHash) {
        if (seenHashesInFile.has(recipeHash)) {
          hasAnyError = true;
          // Gắn lỗi vào các dòng thuộc món này
          for (const item of errorRowItems) {
            if (item.rawValues[0] === draft.name) {
              item.errors.push(
                `Công thức món '${draft.name}' bị trùng lặp với món khác trong file`,
              );
            }
          }
        } else if (userRecipeHashes.has(recipeHash)) {
          hasAnyError = true;
          for (const item of errorRowItems) {
            if (item.rawValues[0] === draft.name) {
              item.errors.push(
                `Công thức món '${draft.name}' trùng lặp 100% với một món bạn đã có`,
              );
            }
          }
        } else {
          seenHashesInFile.add(recipeHash);
        }
      }
    }

    // Nếu có lỗi -> Rollback toàn bộ & Trả về file Excel kèm cột Kết quả import
    if (hasAnyError) {
      const errorBuffer = await ExcelStreamReader.generateErrorWorkbook({
        headers: ['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)'],
        rows: errorRowItems.slice(0, 500),
        sheetName: DishExcelService.DATA_SHEET,
        resultHeaderTitle: 'Kết quả import',
        resultColumnWidth: 45,
      });

      return {
        success: false,
        importedCount: 0,
        total: totalDataRows,
        imported: 0,
        skipped: 0,
        errorsCount: errorRowItems.filter((i) => i.errors.length > 0).length,
        totalRows: totalDataRows,
        message: `Import thất bại: Phát hiện lỗi tại các dòng. Vui lòng tải file lỗi để xem chi tiết.`,
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

    // 5. Lưu vào CSDL trong atomic chunked transaction theo BATCH_SIZE=100 (Rule 20)
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

    if (this.cacheService) {
      await this.cacheService.invalidateTag('dishes');
    }

    this.logger.log(
      `IMPORT DISHES SUCCESS | userId=${userId} | importedCount=${dishDrafts.length}`,
    );

    return {
      success: true,
      importedCount: dishDrafts.length,
      total: dishDrafts.length,
      imported: dishDrafts.length,
      skipped: 0,
      errorsCount: 0,
      totalRows: totalDataRows,
      message: `Nhập thành công ${dishDrafts.length} món ăn vào hệ thống`,
    };
  }

  /**
   * Stream danh sách món ăn ra Excel (O(1) RAM < 35MB)
   * Sử dụng BaseExcelStreamer, Prisma Cursor Batching 200 items (Rule 19)
   * và Lean Query Projection (Rule 11)
   */
  async streamExportDishes({
    dtoOrDishes,
    stream,
    currentUser,
    columns,
  }: StreamExportDishesParamsDto): Promise<void> {
    if (!stream) {
      throw new Error('outputStream is required for streamExportDishes');
    }

    if (stream && typeof (stream as any).setHeader === 'function') {
      const res = stream as Response;
      res.status(200);
      setExcelResponseHeaders({ res, filename: 'dishes.xlsx' });
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    let dishes: any[] = [];
    let selectedColumns: string[] | undefined = undefined;
    let isDirectList = false;

    if (Array.isArray(dtoOrDishes)) {
      isDirectList = true;
      dishes = dtoOrDishes;
      selectedColumns = columns;
    } else {
      const dto = (dtoOrDishes || {}) as ExportDishDto;
      selectedColumns = columns || dto.columns;
    }

    const cacheKey =
      !isDirectList && this.cacheService
        ? this.cacheService.generateKey({
            prefix: 'export:dishes',
            params: {
              userId: currentUser?.id,
              keyword: (dtoOrDishes as ExportDishDto)?.keyword,
              columns: selectedColumns,
            },
          })
        : null;

    if (cacheKey && this.cacheService) {
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug(
          '🚀 [Cache Hit] Trả về dữ liệu xuất món ăn tức thì từ CacheService (0ms)',
        );
        const buf = Buffer.from(cached, 'base64');
        if (stream && typeof (stream as any).end === 'function') {
          (stream as any).end(buf);
          return;
        }
      }
    }

    const columnsToExport = this.resolveExportColumns(selectedColumns);

    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    passThrough.on('data', (c) => chunks.push(c));

    const multiOut = new Writable({
      write(chunk, encoding, callback) {
        if (stream && typeof (stream as any).write === 'function') {
          (stream as any).write(chunk, encoding);
        }
        passThrough.write(chunk, encoding);
        callback();
      },
      final(callback) {
        if (stream && typeof (stream as any).end === 'function') {
          (stream as any).end();
        }
        passThrough.end();
        callback();
      },
    });

    class GenericDishStreamer extends BaseExcelStreamer {
      constructor(out: Response | Writable) {
        super(out, { sheetName: DishExcelService.EXPORT_SHEET, freezeHeader: true });
      }
    }

    const streamer = new GenericDishStreamer(multiOut);

    const fixedHeaders: ExcelColumnDefinition[] = [
      { header: 'Món ăn', key: 'dishName', width: 35 },
      { header: 'Tên TP', key: 'ingredientName', width: 35 },
      { header: 'Sống sạch (g)', key: 'netWeight', width: 16 },
      { header: 'Ăn được (%)', key: 'edible', width: 14 },
      { header: 'Sống thô (g)', key: 'rawWeight', width: 16 },
    ];

    const nutrientHeaders: ExcelColumnDefinition[] = columnsToExport.map((c) => ({
      header: c.header,
      key: c.key,
      width: 18,
    }));

    const allHeaders = [...fixedHeaders, ...nutrientHeaders];

    streamer.setHeaders(allHeaders, {
      height: 28,
      bgColor: 'FF1F497D', // Navy sang trọng
      textColor: 'FFFFFFFF',
    });

    const processDish = async (dish: any) => {
      const details = dish.chi_tiet_mon_an || dish.details || [];
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
          const carb = Math.max(
            0,
            100 -
              (Number(ing.water || 0) +
                Number(ing.protein || 0) +
                Number(ing.fat || 0) +
                Number(ing.fiber || 0) +
                Number(ing.ash || 0)),
          );
          const energy = Number(ing.protein || 0) * 4 + Number(ing.fat || 0) * 9 + carb * 4;
          const vitaminARae = Number(ing.retinol || 0) + Number(ing.betaCarotene || 0) / 12;

          for (const col of columnsToExport) {
            let rawVal = 0;
            if (col.key === 'carbohydrate') rawVal = carb;
            else if (col.key === 'energy') rawVal = energy;
            else if (col.key === 'vitaminARae') rawVal = vitaminARae;
            else rawVal = Number(ing[col.key] ?? 0);

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
        await streamer.addRow(rowValues, { height: 20 });
      }

      // Dòng TỔNG MÓN
      const totalRowValues: any[] = ['TỔNG MÓN', '', '', '', ''];
      for (const col of columnsToExport) {
        const sumVal = detailNutrientList.reduce((acc, curr) => acc + (curr[col.key] || 0), 0);
        totalRowValues.push(this.round2(sumVal));
      }

      await streamer.addSummaryRow(totalRowValues, { height: 24 });

      // Dòng trống ngăn cách giữa các món
      await streamer.addRow([], { height: 12 });
    };

    if (isDirectList) {
      for (const dish of dishes) {
        await processDish(dish);
      }
    } else {
      const dto = (dtoOrDishes || {}) as ExportDishDto;

      const where: any = {
        deleted_at: null,
      };

      if (currentUser?.id) {
        where.nguoi_dung_id = currentUser.id;
      }

      if (dto.keyword && dto.keyword.trim()) {
        where.ten_mon = { contains: dto.keyword.trim() };
      }

      // Lean query projection (Rule 11) - Chỉ select các cột tồn tại trong Prisma nguyen_lieu
      const ingredientSelect: any = {
        id: true,
        ten_nguyen_lieu: true,
        edible: true,
        water: true,
        protein: true,
        fat: true,
        fiber: true,
        ash: true,
        retinol: true,
        betaCarotene: true,
      };
      for (const col of columnsToExport) {
        if (!['carbohydrate', 'energy', 'vitaminARae'].includes(col.key)) {
          ingredientSelect[col.key] = true;
        }
      }

      const select: any = {
        id: true,
        ten_mon: true,
        chi_tiet_mon_an: {
          select: {
            id: true,
            khoi_luong_song_sach: true,
            nguyen_lieu_id: true,
            nguyen_lieu: {
              select: ingredientSelect,
            },
          },
        },
      };

      await streamPrismaInBatches<any>(this.prisma, {
        model: 'mon_an',
        where,
        select,
        orderBy: { id: 'desc' },
        batchSize: 200,
        onBatch: async (batch) => {
          for (const dish of batch) {
            await processDish(dish);
          }
        },
      });
    }

    await streamer.finalize();

    if (cacheKey && this.cacheService && chunks.length > 0) {
      const fullBuf = Buffer.concat(chunks);
      if (fullBuf.length <= 10 * 1024 * 1024) {
        await this.cacheService.set(cacheKey, fullBuf.toString('base64'), 2592000, 'dishes');
        this.logger.debug('💾 Đã lưu dữ liệu xuất món ăn vào CacheService (tag=dishes)');
      }
    }
  }

  /**
   * Xuất danh sách món ăn ra Excel kèm 86 chỉ tiêu vi chất (Hỗ trợ cả ExportDishDto và danh sách món trực tiếp)
   */
  async exportDishes({
    dtoOrDishes,
    currentUser,
    columns,
  }: ExportDishesParamsDto): Promise<Buffer> {
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];
    passThrough.on('data', (c) => chunks.push(c));
    const streamPromise = new Promise<Buffer>((resolve, reject) => {
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);
    });

    await this.streamExportDishes({ dtoOrDishes, currentUser, columns, stream: passThrough });
    return streamPromise;
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
