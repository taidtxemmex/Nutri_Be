import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { Writable, PassThrough } from 'stream';
import { PrismaService } from '../../../core/database/prisma.service';
import { IngredientsService, normalizeVietnameseNFC } from './ingredients.service';
import {
  GenerateIngredientTemplateParamsDto,
  StreamExportIngredientsParamsDto,
  ExportIngredientsParamsDto,
  ImportIngredientExcelParamsDto,
} from '../dto';
import {
  ExcelStreamReader,
  ErrorRowItem,
  BaseExcelStreamer,
  ExcelColumnDefinition,
  setExcelResponseHeaders,
} from '../../../core/excel-engine';
import { streamPrismaInBatches } from '../../../core/excel-engine/prisma-cursor-streamer';
import { CacheService } from '../../../core/cache/cache.service';

export interface ColumnMetadata {
  key: string;
  header: string;
  unit?: string;
}

export const NUTRIENT_COLUMN_DEFINITIONS: ColumnMetadata[] = [
  { key: 'water', header: 'Water (g)', unit: 'g' },
  { key: 'protein', header: 'Protein (g)', unit: 'g' },
  { key: 'fat', header: 'Fat (g)', unit: 'g' },
  { key: 'fiber', header: 'Fiber (g)', unit: 'g' },
  { key: 'ash', header: 'Ash (g)', unit: 'g' },
  { key: 'calci', header: 'Calci (mg)', unit: 'mg' },
  { key: 'phosphorous', header: 'Phosphorous (mg)', unit: 'mg' },
  { key: 'iron', header: 'Iron (mg)', unit: 'mg' },
  { key: 'zinc', header: 'Zinc (mg)', unit: 'mg' },
  { key: 'sodium', header: 'Sodium (mg)', unit: 'mg' },
  { key: 'potassium', header: 'Potassium (mg)', unit: 'mg' },
  { key: 'magnesium', header: 'Magnesium (mg)', unit: 'mg' },
  { key: 'manganese', header: 'Manganese (mg)', unit: 'mg' },
  { key: 'copper', header: 'Copper (µg)', unit: 'µg' },
  { key: 'selenium', header: 'Selenium (µg)', unit: 'µg' },
  { key: 'vitaminC', header: 'Vitamin C (mg)', unit: 'mg' },
  { key: 'thiamine', header: 'Thiamine (mg)', unit: 'mg' },
  { key: 'riboflavin', header: 'Riboflavin (mg)', unit: 'mg' },
  { key: 'niacin', header: 'Niacin (mg)', unit: 'mg' },
  { key: 'pantothenicAcid', header: 'Pantothenic acid (mg)', unit: 'mg' },
  { key: 'vitaminB6', header: 'Vitamin B6 (mg)', unit: 'mg' },
  { key: 'folate', header: 'Folate (µg)', unit: 'µg' },
  { key: 'folicAcid', header: 'Folic acid (µg)', unit: 'µg' },
  { key: 'biotin', header: 'Biotin (µg)', unit: 'µg' },
  { key: 'vitaminB12', header: 'Vitamin B12 (µg)', unit: 'µg' },
  { key: 'retinol', header: 'Retinol (µg)', unit: 'µg' },
  { key: 'vitaminD', header: 'Vitamin D (µg)', unit: 'µg' },
  { key: 'vitaminE', header: 'Vitamin E (mg)', unit: 'mg' },
  { key: 'vitaminK', header: 'Vitamin K (µg)', unit: 'µg' },
  { key: 'betaCarotene', header: 'β-carotene (µg)', unit: 'µg' },
  { key: 'alphaCarotene', header: 'α-carotene (µg)', unit: 'µg' },
  { key: 'betaCryptoxanthin', header: 'β-cryptoxanthin (µg)', unit: 'µg' },
  { key: 'lycopene', header: 'Lycopene (µg)', unit: 'µg' },
  { key: 'luteinZeaxanthin', header: 'Lutein + zeaxanthin (µg)', unit: 'µg' },
  { key: 'isoflavoneTongSo', header: 'Isoflavone tổng số (mg)', unit: 'mg' },
  { key: 'daidzein', header: 'Daidzein (mg)', unit: 'mg' },
  { key: 'genistein', header: 'Genistein (mg)', unit: 'mg' },
  { key: 'glycetin', header: 'Glycetin (mg)', unit: 'mg' },
  { key: 'purine', header: 'Purine (mg)', unit: 'mg' },
  { key: 'tsAxitBeoNo', header: 'TS Axit béo no (g)', unit: 'g' },
  { key: 'palmitic', header: 'Palmitic (C16:0) (g)', unit: 'g' },
  { key: 'margaric', header: 'Margaric (C17:0) (g)', unit: 'g' },
  { key: 'stearic', header: 'Stearic (C18:0) (g)', unit: 'g' },
  { key: 'arachidic', header: 'Arachidic (C20:0) (g)', unit: 'g' },
  { key: 'behenic', header: 'Behenic (C22:0) (g)', unit: 'g' },
  { key: 'lignoceric', header: 'Lignoceric (C24:0) (g)', unit: 'g' },
  { key: 'tsAxitBeoKhongNo1NoiDoi', header: 'TS acid béo không no 1 nối đôi (g)', unit: 'g' },
  { key: 'myristoleic', header: 'Myristoleic (C14:1) (g)', unit: 'g' },
  { key: 'palmitoleic', header: 'Palmitoleic (C16:1) (g)', unit: 'g' },
  { key: 'oleic', header: 'Oleic (C18:1) (g)', unit: 'g' },
  {
    key: 'tsAxitBeoKhongNoNhieuNoiDoi',
    header: 'TS acid béo không no nhiều nối đôi (g)',
    unit: 'g',
  },
  { key: 'linoleic', header: 'Linoleic (g)', unit: 'g' },
  { key: 'linolenic', header: 'Linolenic (g)', unit: 'g' },
  { key: 'arachidonic', header: 'Arachidonic (C20:4) (g)', unit: 'g' },
  { key: 'epa', header: 'EPA (C20:5 n3) (g)', unit: 'g' },
  { key: 'dha', header: 'DHA (C22:6 n3) (g)', unit: 'g' },
  { key: 'tsAxitBeoTrans', header: 'TS acid béo trans (g)', unit: 'g' },
  { key: 'cholesterol', header: 'Cholesterol (mg)', unit: 'mg' },
  { key: 'phytosterol', header: 'Phytosterol (mg)', unit: 'mg' },
  { key: 'lysin', header: 'Lysine (mg)', unit: 'mg' },
  { key: 'methionin', header: 'Methionine (mg)', unit: 'mg' },
  { key: 'tryptophan', header: 'Tryptophan (mg)', unit: 'mg' },
  { key: 'phenylalanin', header: 'Phenylalanine (mg)', unit: 'mg' },
  { key: 'threonin', header: 'Threonine (mg)', unit: 'mg' },
  { key: 'valine', header: 'Valine (mg)', unit: 'mg' },
  { key: 'leucine', header: 'Leucine (mg)', unit: 'mg' },
  { key: 'isoleucine', header: 'Isoleucine (mg)', unit: 'mg' },
  { key: 'arginine', header: 'Arginine (mg)', unit: 'mg' },
  { key: 'histidine', header: 'Histidine (mg)', unit: 'mg' },
  { key: 'cystine', header: 'Cystine (mg)', unit: 'mg' },
  { key: 'tyrosine', header: 'Tyrosine (mg)', unit: 'mg' },
  { key: 'alanine', header: 'Alanine (mg)', unit: 'mg' },
  { key: 'asparticAcid', header: 'Aspartic acid (mg)', unit: 'mg' },
  { key: 'glutamicAcid', header: 'Glutamic acid (mg)', unit: 'mg' },
  { key: 'glycine', header: 'Glycine (mg)', unit: 'mg' },
  { key: 'proline', header: 'Proline (mg)', unit: 'mg' },
  { key: 'serine', header: 'Serine (mg)', unit: 'mg' },
];

export interface ImportResult {
  success: boolean;
  totalImported?: number;
  total?: number;
  imported?: number;
  skipped?: number;
  message?: string;
  errorFileName?: string;
  errorFileBuffer?: Buffer;
  errorsCount?: number;
  totalRows?: number;
}

@Injectable()
export class IngredientExcelService {
  private readonly logger = new Logger(IngredientExcelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingredientsService: IngredientsService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Tạo file mẫu Excel 86 cột chuẩn hóa, có header tiếng Việt và cấu hình dropdown
   * Tích hợp bộ đệm CacheService 30 phút (0ms)
   */
  async generateTemplate({ columns }: GenerateIngredientTemplateParamsDto = {}): Promise<Buffer> {
    const colKey = columns && columns.length > 0 ? columns.slice().sort().join(',') : 'all';
    const cacheKey = `ingredient:template:${colKey}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('🚀 [Cache Hit] Trả về template nguyên liệu từ CacheService (0ms)');
        return Buffer.from(cached, 'base64');
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Ingredients');

    // Lấy danh mục từ DB
    const categories = await this.prisma.danh_muc.findMany({
      select: { ten_danh_muc: true },
      orderBy: { id: 'asc' },
    });
    const categoryNames = categories
      .map((c) => c.ten_danh_muc)
      .filter((name): name is string => !!name);

    // Lọc danh sách cột vi chất nếu người dùng chỉ định
    let nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS;
    if (columns && Array.isArray(columns) && columns.length > 0) {
      const lowerCols = columns.map((c) => c.toLowerCase());
      nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS.filter(
        (col) =>
          lowerCols.includes(col.key.toLowerCase()) || lowerCols.includes(col.header.toLowerCase()),
      );
      if (nutrientColumns.length === 0) {
        nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS;
      }
    }

    // 1. Cấu hình Headers
    const headers = [
      'Tên nguyên liệu',
      'Nhóm',
      'Loại protein',
      'Edible (%)',
      ...nutrientColumns.map((c) => c.header),
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E88E5' }, // Blue primary header
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Độ rộng các cột
    sheet.getColumn(1).width = 30; // Tên nguyên liệu
    sheet.getColumn(2).width = 25; // Nhóm
    sheet.getColumn(3).width = 18; // Loại protein
    sheet.getColumn(4).width = 15; // Edible (%)
    for (let i = 5; i <= headers.length; i++) {
      sheet.getColumn(i).width = 18;
    }

    // 2. Thêm dòng mẫu (Sample Row)
    const sampleRowValues = [
      'Gạo tẻ',
      categoryNames.length > 0 ? categoryNames[0] : 'Ngũ cốc và sản phẩm chế biến',
      'Thực vật',
      100,
      ...nutrientColumns.map((col) => {
        if (col.key === 'water') return 13.8;
        if (col.key === 'protein') return 7.9;
        if (col.key === 'fat') return 0.7;
        return 0;
      }),
    ];
    const sampleRow = sheet.addRow(sampleRowValues);
    sampleRow.alignment = { vertical: 'middle' };

    // 3. Sheet ẩn _META_ phục vụ Dropdown dữ liệu
    const metaSheet = workbook.addWorksheet('_META_');
    metaSheet.state = 'hidden';

    // Đưa danh mục vào cột A của _META_
    categoryNames.forEach((name, idx) => {
      metaSheet.getCell(`A${idx + 1}`).value = name;
    });

    // Đưa loại protein vào cột B của _META_
    metaSheet.getCell('B1').value = 'Thực vật';
    metaSheet.getCell('B2').value = 'Động vật';

    // Thêm Data Validation cho các dòng nhập dữ liệu (hàng 2 đến 100)
    for (let r = 2; r <= 100; r++) {
      // Cột B: Nhóm
      if (categoryNames.length > 0) {
        sheet.getCell(`B${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_META_!$A$1:$A$${categoryNames.length}`],
          showErrorMessage: true,
          errorTitle: 'Dữ liệu không hợp lệ',
          error: 'Vui lòng chọn nhóm từ danh sách có sẵn',
        };
      }

      // Cột C: Loại protein
      sheet.getCell(`C${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Thực vật,Động vật"'],
        showErrorMessage: true,
        errorTitle: 'Dữ liệu không hợp lệ',
        error: 'Vui lòng chọn Thực vật hoặc Động vật',
      };
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (this.cacheService && buffer.length <= 5 * 1024 * 1024) {
      await this.cacheService.set(cacheKey, buffer.toString('base64'), 1800, 'ingredients');
      this.logger.debug(
        '💾 Đã lưu template nguyên liệu vào CacheService (TTL 30m, tag=ingredients)',
      );
    }

    return buffer;
  }

  /**
   * Stream danh sách nguyên liệu ra file Excel theo bộ lọc
   * Áp dụng BaseExcelStreamer, Prisma Cursor Batching 200 items (Rule 19)
   * và Lean Query Projection (Rule 11)
   */
  async streamExportIngredients({
    dto,
    outputStream,
  }: StreamExportIngredientsParamsDto): Promise<void> {
    if (outputStream && typeof (outputStream as any).setHeader === 'function') {
      const res = outputStream as Response;
      res.status(200);
      setExcelResponseHeaders({ res, filename: 'danh_sach_nguyen_lieu.xlsx' });
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    const cacheKey = this.cacheService
      ? this.cacheService.generateKey({
          prefix: 'export:ingredients',
          params: {
            keyword: dto.keyword,
            categoryId: dto.categoryId,
            loaiProtein: dto.loaiProtein,
            columns: dto.columns,
          },
        })
      : null;

    if (cacheKey && this.cacheService) {
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug(
          '🚀 [Cache Hit] Trả về dữ liệu xuất nguyên liệu tức thì từ CacheService (0ms)',
        );
        const buf = Buffer.from(cached, 'base64');
        if (outputStream && typeof (outputStream as any).end === 'function') {
          (outputStream as any).end(buf);
          return;
        }
      }
    }

    // 1. Lọc danh sách cột xuất động
    let nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS;
    if (dto.columns && Array.isArray(dto.columns) && dto.columns.length > 0) {
      const lowerCols = dto.columns.map((c) => c.toLowerCase());
      nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS.filter(
        (col) =>
          lowerCols.includes(col.key.toLowerCase()) || lowerCols.includes(col.header.toLowerCase()),
      );
      if (nutrientColumns.length === 0) {
        nutrientColumns = NUTRIENT_COLUMN_DEFINITIONS;
      }
    }

    // Capture chunks để lưu cache
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    passThrough.on('data', (c) => chunks.push(c));

    const multiOut = new Writable({
      write(chunk, encoding, callback) {
        if (outputStream && typeof (outputStream as any).write === 'function') {
          (outputStream as any).write(chunk, encoding);
        }
        passThrough.write(chunk, encoding);
        callback();
      },
      final(callback) {
        if (outputStream && typeof (outputStream as any).end === 'function') {
          (outputStream as any).end();
        }
        passThrough.end();
        callback();
      },
    });

    // 2. Cấu hình Headers BaseExcelStreamer
    class GenericIngredientStreamer extends BaseExcelStreamer {
      constructor(out: Response | Writable) {
        super(out, { sheetName: 'Ingredients', freezeHeader: true });
      }
    }

    const streamer = new GenericIngredientStreamer(multiOut);

    const headers: ExcelColumnDefinition[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Tên nguyên liệu', key: 'name', width: 32 },
      { header: 'Nhóm', key: 'category', width: 25 },
      { header: 'Loại protein', key: 'proteinType', width: 18 },
      { header: 'Edible (%)', key: 'edible', width: 15 },
      ...nutrientColumns.map((c) => ({
        header: c.header,
        key: c.key,
        width: 18,
      })),
    ];

    streamer.setHeaders(headers, {
      height: 26,
      bgColor: 'FF2E7D32', // Green header
      textColor: 'FFFFFFFF',
    });

    // 3. Query Cursor Batching 200 items với select tường minh (Rule 11 & Rule 19)
    const where: any = { deleted_at: null };
    if (dto.keyword && dto.keyword.trim()) {
      where.ten_nguyen_lieu = { contains: dto.keyword.trim() };
    }
    if (dto.categoryId) {
      where.danh_muc = dto.categoryId;
    }
    if (dto.loaiProtein) {
      where.loai_protein = dto.loaiProtein;
    }

    const select: any = {
      id: true,
      ten_nguyen_lieu: true,
      danh_muc: true,
      loai_protein: true,
      edible: true,
      danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
        select: { ten_danh_muc: true },
      },
    };
    for (const col of nutrientColumns) {
      select[col.key] = true;
    }

    let stt = 1;
    await streamPrismaInBatches<any>(this.prisma, {
      model: 'nguyen_lieu',
      where,
      select,
      orderBy: { id: 'asc' },
      batchSize: 200,
      onBatch: async (batch) => {
        for (const item of batch) {
          const rowData = [
            stt++,
            item.ten_nguyen_lieu,
            item.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || '',
            item.loai_protein === 'DONG_VAT'
              ? 'Động vật'
              : item.loai_protein === 'THUC_VAT'
                ? 'Thực vật'
                : item.loai_protein || '',
            item.edible ?? 100,
            ...nutrientColumns.map((col) => {
              const val = item[col.key];
              return val !== null && val !== undefined ? Number(val) : '';
            }),
          ];
          await streamer.addRow(rowData);
        }
      },
    });

    await streamer.finalize();

    if (cacheKey && this.cacheService && chunks.length > 0) {
      const fullBuf = Buffer.concat(chunks);
      if (fullBuf.length <= 10 * 1024 * 1024) {
        await this.cacheService.set(cacheKey, fullBuf.toString('base64'), 2592000, 'ingredients');
        this.logger.debug('💾 Đã lưu dữ liệu xuất nguyên liệu vào CacheService (tag=ingredients)');
      }
    }
  }

  /**
   * Xuất danh sách nguyên liệu ra file Excel theo bộ lọc (Backward compatibility trả Buffer)
   */
  async exportIngredients({ dto }: ExportIngredientsParamsDto): Promise<Buffer> {
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];
    passThrough.on('data', (c) => chunks.push(c));
    const streamPromise = new Promise<Buffer>((resolve, reject) => {
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', reject);
    });
    await this.streamExportIngredients({ dto, outputStream: passThrough });
    return streamPromise;
  }

  /**
   * Import nguyên liệu nguyên tử (Atomic Commit theo chunk BATCH_SIZE=100 per Rule 20)
   * Sử dụng ExcelJS WorkbookReader streaming O(1) RAM, Smart Sheet Signature Detection
   * và Pre-fetch In-Memory Lookup Maps triệt tiêu 100% N+1 queries.
   */
  async importExcel({ fileBuffer, userId }: ImportIngredientExcelParamsDto): Promise<ImportResult> {
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
    const [categories, existingIngredients] = await Promise.all([
      this.prisma.danh_muc.findMany({
        select: { id: true, ten_danh_muc: true },
      }),
      this.prisma.nguyen_lieu.findMany({
        where: { deleted_at: null },
        select: { ten_nguyen_lieu: true },
      }),
    ]);

    const categoryMap = new Map<string, number>();
    for (const c of categories) {
      if (c.ten_danh_muc) {
        categoryMap.set(normalizeVietnameseNFC(c.ten_danh_muc).toLowerCase(), c.id);
      }
    }

    const existingNameSet = new Set<string>();
    for (const ing of existingIngredients) {
      if (ing.ten_nguyen_lieu) {
        existingNameSet.add(normalizeVietnameseNFC(ing.ten_nguyen_lieu).toLowerCase());
      }
    }

    // 2. Khởi tạo WorkbookReader streaming
    let reader: any;
    try {
      reader = ExcelStreamReader.createReader(fileBuffer);
    } catch (err: any) {
      throw new HttpException(
        {
          code: 'IMPORT_FILE_CORRUPTED',
          message: 'Tập tin Excel bị hỏng hoặc không đúng định dạng (.xlsx)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Smart Sheet Signature Detection: Quét tìm sheet có chữ ký cột nguyên liệu
    let targetWorksheet: any = null;
    let headerMap = new Map<string, number>();
    let colMaterial: number | undefined;
    let colCategory: number | undefined;
    let colProtein: number | undefined;
    let colEdible: number | undefined;
    let capturedHeaders: string[] = [];

    const validRows: Array<{
      rowNumber: number;
      data: any;
    }> = [];
    const errorRowItems: ErrorRowItem[] = [];
    const seenNamesInFile = new Set<string>();
    let totalDataRows = 0;
    let hasAnyError = false;

    try {
      for await (const worksheetReader of reader) {
        let isCurrentSheetTarget = false;

        for await (const row of worksheetReader) {
          const rowNumber = row.number;

          // Dòng tiêu đề
          if (rowNumber === 1) {
            const currentHeaderMap = new Map<string, number>();
            const currentHeaders: string[] = [];

            // Duyệt từng cell của dòng tiêu đề
            const cellCount = Array.isArray(row.values) ? row.values.length : 100;
            for (let c = 1; c < cellCount; c++) {
              const cell = row.getCell(c);
              const headerText = cell?.text
                ? cell.text.trim()
                : cell?.value
                  ? String(cell.value).trim()
                  : '';
              if (headerText) {
                currentHeaderMap.set(headerText, c);
                currentHeaders.push(headerText);
              }
            }

            const m = this.findHeaderColumn(currentHeaderMap, [
              'Tên nguyên liệu',
              'Tên thực phẩm',
              'Material',
              'Name',
            ]);
            const cat = this.findHeaderColumn(currentHeaderMap, [
              'Nhóm',
              'Danh mục',
              'Category',
              'Group',
            ]);
            const p = this.findHeaderColumn(currentHeaderMap, [
              'Loại protein',
              'Protein type',
              'ProteinType',
            ]);
            const ed = this.findHeaderColumn(currentHeaderMap, [
              'Edible (%)',
              'Ăn được (%)',
              'Edible',
            ]);

            // Nếu sheet này chứa đủ 4 cột bắt buộc -> chọn làm targetWorksheet
            if (m && cat && p && ed) {
              isCurrentSheetTarget = true;
              targetWorksheet = worksheetReader;
              headerMap = currentHeaderMap;
              colMaterial = m;
              colCategory = cat;
              colProtein = p;
              colEdible = ed;
              capturedHeaders = currentHeaders;
            }
            continue;
          }

          // Nếu không phải target sheet thì bỏ qua dữ liệu
          if (!isCurrentSheetTarget) continue;

          // Kiểm tra dòng có dữ liệu
          let hasValues = false;
          const rawRowValues: any[] = [];
          for (let c = 1; c <= capturedHeaders.length; c++) {
            const cell = row.getCell(c);
            const val = cell?.value !== undefined ? cell.value : null;
            rawRowValues.push(val);
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              hasValues = true;
            }
          }

          if (!hasValues) continue;

          totalDataRows++;
          if (totalDataRows > 100) {
            throw new HttpException(
              {
                code: 'IMPORT_TOO_MANY_ROWS',
                message: 'Chỉ cho phép import tối đa 100 dòng mỗi lần',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          const errors: string[] = [];

          // A. Validate Tên nguyên liệu
          const rawMaterial = ExcelStreamReader.readCellString({
            cell: row.getCell(colMaterial!),
            sanitize: true,
          });
          if (!rawMaterial) {
            errors.push('Tên nguyên liệu không được để trống');
          } else {
            const normalized = normalizeVietnameseNFC(rawMaterial);
            const lowerKey = normalized.toLowerCase();

            // Check trùng trong file
            if (seenNamesInFile.has(lowerKey)) {
              errors.push('Trùng tên nguyên liệu với dòng khác trong file');
            } else {
              seenNamesInFile.add(lowerKey);
            }

            // Check trùng trong CSDL (O(1) in-memory lookup)
            if (existingNameSet.has(lowerKey)) {
              errors.push('Tên nguyên liệu đã tồn tại trong hệ thống');
            }
          }

          // B. Validate Danh mục
          const rawCategory = ExcelStreamReader.readCellString({
            cell: row.getCell(colCategory!),
            sanitize: false,
          });
          let categoryId: number | null = null;
          if (!rawCategory) {
            errors.push('Nhóm nguyên liệu không được để trống');
          } else {
            const catKey = normalizeVietnameseNFC(rawCategory).toLowerCase();
            if (categoryMap.has(catKey)) {
              categoryId = categoryMap.get(catKey)!;
            } else {
              errors.push(`Danh mục '${rawCategory}' không tồn tại trên hệ thống`);
            }
          }

          // C. Validate Loại protein
          const rawProtein = ExcelStreamReader.readCellString({
            cell: row.getCell(colProtein!),
            sanitize: false,
          });
          let loaiProtein: string | null = null;
          if (!rawProtein) {
            errors.push('Loại protein không được để trống');
          } else {
            const lowerProtein = rawProtein.toLowerCase();
            if (lowerProtein.includes('thực vật') || lowerProtein === 'thuc_vat') {
              loaiProtein = 'THUC_VAT';
            } else if (lowerProtein.includes('động vật') || lowerProtein === 'dong_vat') {
              loaiProtein = 'DONG_VAT';
            } else {
              errors.push("Loại protein phải là 'Thực vật' hoặc 'Động vật'");
            }
          }

          // D. Validate Edible (%)
          const numEdible = ExcelStreamReader.readCellNumber(row.getCell(colEdible!));
          if (numEdible === null) {
            errors.push('Edible (%) là bắt buộc và phải là số hợp lệ');
          } else if (numEdible < 0 || numEdible > 100) {
            errors.push('Edible (%) phải nằm trong khoảng từ 0 đến 100');
          }

          // E. Validate 86 vi chất
          const nutrientValues: Record<string, number | null> = {};
          for (const colDef of NUTRIENT_COLUMN_DEFINITIONS) {
            const colIdx = this.findHeaderColumn(headerMap, [colDef.header, colDef.key]);
            if (colIdx) {
              const val = row.getCell(colIdx);
              const num = ExcelStreamReader.readCellNumber(val);
              if (num !== null) {
                if (num < 0) {
                  errors.push(`${colDef.header} phải là số không âm (>= 0)`);
                } else {
                  nutrientValues[colDef.key] = num;
                }
              }
            }
          }

          if (errors.length > 0) {
            hasAnyError = true;
          } else {
            validRows.push({
              rowNumber,
              data: {
                ten_nguyen_lieu: normalizeVietnameseNFC(rawMaterial!),
                danh_muc: categoryId,
                loai_protein: loaiProtein,
                trang_thai: 'DA_DUYET',
                tao_boi_id: userId || null,
                edible: numEdible,
                ...nutrientValues,
              },
            });
          }

          errorRowItems.push({
            rowNumber,
            rawValues: rawRowValues,
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

    if (!targetWorksheet || capturedHeaders.length === 0) {
      throw new HttpException(
        {
          code: 'IMPORT_INVALID_TEMPLATE',
          message: 'Cấu trúc file mẫu không đúng. Vui lòng tải file mẫu từ hệ thống',
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

    // 4. Nếu có bất kỳ dòng nào bị lỗi -> All-or-Nothing Rollback & Tạo file Excel báo lỗi chi tiết
    if (hasAnyError) {
      const errorBuffer = await ExcelStreamReader.generateErrorWorkbook({
        headers: capturedHeaders,
        rows: errorRowItems,
        sheetName: 'Ket_qua_import_nguyen_lieu',
        resultHeaderTitle: 'Kết quả import',
        resultColumnWidth: 45,
      });

      return {
        success: false,
        errorFileName: 'ingredient_import_errors.xlsx',
        errorFileBuffer: errorBuffer,
        errorsCount: errorRowItems.filter((i) => i.errors.length > 0).length,
        totalRows: totalDataRows,
      };
    }

    // 5. Nếu 100% hợp lệ -> Atomic Commit theo BATCH_SIZE=100 (Rule 20)
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(
        chunk.map((item) => this.prisma.nguyen_lieu.create({ data: item.data })),
      );
    }

    if (this.cacheService) {
      await this.cacheService.invalidateTag('ingredients');
    }

    return {
      success: true,
      totalImported: validRows.length,
      total: validRows.length,
      imported: validRows.length,
      skipped: 0,
      message: `Đã nhập thành công ${validRows.length} nguyên liệu vào hệ thống`,
    };
  }

  private findHeaderColumn(
    headerMap: Map<string, number>,
    possibleNames: string[],
  ): number | undefined {
    for (const [header, col] of headerMap.entries()) {
      const hLower = header.toLowerCase();
      for (const name of possibleNames) {
        if (hLower === name.toLowerCase()) {
          return col;
        }
      }
    }
    return undefined;
  }

  private parseNumericCell(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }
    if (typeof val === 'object' && val.result !== undefined) {
      return this.parseNumericCell(val.result);
    }
    const parsed = Number(String(val).trim());
    return isNaN(parsed) ? null : parsed;
  }
}
