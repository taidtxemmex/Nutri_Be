import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../core/database/prisma.service';
import { IngredientsService, normalizeVietnameseNFC } from './ingredients.service';
import { ExportIngredientDto } from '../dto/export-ingredient.dto';

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
  ) {}

  /**
   * Tạo file mẫu Excel 86 cột chuẩn hóa, có header tiếng Việt và cấu hình dropdown
   */
  async generateTemplate(columns?: string[]): Promise<Buffer> {
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

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Xuất danh sách nguyên liệu ra file Excel theo bộ lọc
   */
  async exportIngredients(dto: ExportIngredientDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Ingredients');

    // Lọc danh sách cột xuất
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

    // 1. Headers
    const headers = [
      'STT',
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
      fgColor: { argb: 'FF2E7D32' }, // Green header for export
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // 2. Query dữ liệu từ CSDL
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

    const ingredients = await this.prisma.nguyen_lieu.findMany({
      where,
      orderBy: { ten_nguyen_lieu: 'asc' },
      include: {
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
      },
    });

    // 3. Đổ dữ liệu
    ingredients.forEach((item, index) => {
      const rowData = [
        index + 1,
        item.ten_nguyen_lieu,
        item.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || '',
        item.loai_protein === 'DONG_VAT' ? 'Động vật' : 'Thực vật',
        item.edible ?? 100,
        ...nutrientColumns.map((col) => {
          const val = (item as any)[col.key];
          return val !== null && val !== undefined ? Number(val) : '';
        }),
      ];
      sheet.addRow(rowData);
    });

    // Căn chỉnh độ rộng
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 14;
    for (let i = 6; i <= headers.length; i++) {
      sheet.getColumn(i).width = 18;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Import nguyên liệu nguyên tử (Atomic Commit theo chunk BATCH_SIZE=100 per Rule 20)
   * Validate từng dòng, trả kết quả và file Excel lỗi nếu có sai sót
   */
  async importExcel(fileBuffer: Buffer, userId?: string): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (err: any) {
      throw new HttpException(
        {
          code: 'IMPORT_FILE_CORRUPTED',
          message: 'Tập tin Excel bị hỏng hoặc không đúng định dạng (.xlsx)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount <= 1) {
      throw new HttpException(
        {
          code: 'IMPORT_EMPTY_FILE',
          message: 'Tập tin Excel không có dữ liệu để import',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Giới hạn 100 dòng per Rule 19 & 20
    const totalDataRows = sheet.rowCount - 1;
    if (totalDataRows > 100) {
      throw new HttpException(
        {
          code: 'IMPORT_TOO_MANY_ROWS',
          message: 'Chỉ cho phép import tối đa 100 dòng mỗi lần',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Kiểm tra cấu trúc Headers
    const headerRow = sheet.getRow(1);
    const headerMap = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.text ? cell.text.trim() : '';
      if (headerText) {
        headerMap.set(headerText, colNumber);
      }
    });

    const colMaterial = this.findHeaderColumn(headerMap, [
      'Tên nguyên liệu',
      'Tên thực phẩm',
      'Material',
      'Name',
    ]);
    const colCategory = this.findHeaderColumn(headerMap, ['Nhóm', 'Danh mục', 'Category', 'Group']);
    const colProtein = this.findHeaderColumn(headerMap, [
      'Loại protein',
      'Protein type',
      'ProteinType',
    ]);
    const colEdible = this.findHeaderColumn(headerMap, ['Edible (%)', 'Ăn được (%)', 'Edible']);

    if (!colMaterial || !colCategory || !colProtein || !colEdible) {
      throw new HttpException(
        {
          code: 'IMPORT_INVALID_TEMPLATE',
          message: 'Cấu trúc file mẫu không đúng. Vui lòng tải file mẫu từ hệ thống',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Nạp danh mục từ CSDL để đối chiếu nhanh
    const categories = await this.prisma.danh_muc.findMany({
      select: { id: true, ten_danh_muc: true },
    });
    const categoryMap = new Map<string, number>();
    for (const c of categories) {
      if (c.ten_danh_muc) {
        categoryMap.set(normalizeVietnameseNFC(c.ten_danh_muc).toLowerCase(), c.id);
      }
    }

    // 3. Khởi tạo danh sách kiểm tra
    const validRows: Array<{
      rowNumber: number;
      data: any;
    }> = [];

    const rowErrorsMap = new Map<number, string[]>();
    const seenNamesInFile = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      // Bỏ qua dòng hoàn toàn trống
      if (!row || !row.hasValues) continue;

      const errors: string[] = [];

      // A. Validate Tên nguyên liệu
      const rawMaterial = row.getCell(colMaterial).text?.trim();
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

        // Check trùng trong CSDL
        const isDuplicateDb = await this.ingredientsService.existsByMaterial(normalized);
        if (isDuplicateDb) {
          errors.push('Tên nguyên liệu đã tồn tại trong hệ thống');
        }
      }

      // B. Validate Danh mục
      const rawCategory = row.getCell(colCategory).text?.trim();
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
      const rawProtein = row.getCell(colProtein).text?.trim();
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
      const edibleVal = row.getCell(colEdible).value;
      const numEdible = this.parseNumericCell(edibleVal);
      if (numEdible === null) {
        errors.push('Edible (%) là bắt buộc và phải là số hợp lệ');
      } else if (numEdible < 0 || numEdible > 100) {
        errors.push('Edible (%) phải nằm trong khoảng từ 0 đến 100');
      }

      // E. Validate các vi chất
      const nutrientValues: Record<string, number | null> = {};
      for (const colDef of NUTRIENT_COLUMN_DEFINITIONS) {
        const colIdx = this.findHeaderColumn(headerMap, [colDef.header, colDef.key]);
        if (colIdx) {
          const val = row.getCell(colIdx).value;
          if (val !== null && val !== undefined && val !== '') {
            const num = this.parseNumericCell(val);
            if (num === null || num < 0) {
              errors.push(`${colDef.header} phải là số không âm (>= 0)`);
            } else {
              nutrientValues[colDef.key] = num;
            }
          }
        }
      }

      if (errors.length > 0) {
        rowErrorsMap.set(rowNumber, errors);
      } else {
        validRows.push({
          rowNumber,
          data: {
            ten_nguyen_lieu: normalizeVietnameseNFC(rawMaterial),
            danh_muc: categoryId,
            loai_protein: loaiProtein,
            trang_thai: 'DA_DUYET', // Admin import -> DA_DUYET
            tao_boi_id: userId || null,
            edible: numEdible,
            ...nutrientValues,
          },
        });
      }
    }

    // 4. Nếu có bất kỳ dòng nào bị lỗi -> Tạo file Excel báo lỗi chi tiết
    if (rowErrorsMap.size > 0) {
      const resultColIndex = headerRow.cellCount + 1;
      const resultHeaderCell = headerRow.getCell(resultColIndex);
      resultHeaderCell.value = 'Kết quả kiểm tra (Lỗi import)';
      resultHeaderCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      resultHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD32F2F' }, // Red alert
      };
      sheet.getColumn(resultColIndex).width = 45;

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        if (!row || !row.hasValues) continue;

        const cell = row.getCell(resultColIndex);
        if (rowErrorsMap.has(r)) {
          const errors = rowErrorsMap.get(r)!;
          cell.value = `❌ LỖI: ${errors.join('; ')}`;
          cell.font = { color: { argb: 'FFD32F2F' }, bold: true };
        } else {
          cell.value = '✅ Hợp lệ';
          cell.font = { color: { argb: 'FF388E3C' } };
        }
      }

      const errorBuffer = await workbook.xlsx.writeBuffer();
      return {
        success: false,
        errorFileName: 'ingredient_import_errors.xlsx',
        errorFileBuffer: Buffer.from(errorBuffer),
        errorsCount: rowErrorsMap.size,
        totalRows: totalDataRows,
      };
    }

    // 5. Nếu không có lỗi -> Atomic Commit theo BATCH_SIZE=100 (Rule 20)
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(
        chunk.map((item) => this.prisma.nguyen_lieu.create({ data: item.data })),
      );
    }

    return {
      success: true,
      totalImported: validRows.length,
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
