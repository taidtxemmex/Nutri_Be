import { HttpException, HttpStatus } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { IngredientExcelService } from '../../src/modules/ingredients/services/ingredient-excel.service';

describe('IngredientExcelService', () => {
  let excelService: IngredientExcelService;
  let mockPrisma: any;
  let mockIngredientsService: any;

  beforeEach(() => {
    mockPrisma = {
      danh_muc: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ten_danh_muc: 'Ngũ cốc và sản phẩm chế biến' },
          { id: 2, ten_danh_muc: 'Thịt và sản phẩm chế biến' },
        ]),
      },
      nguyen_lieu: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(1),
            ten_nguyen_lieu: 'Gạo tẻ',
            danh_muc: 1,
            loai_protein: 'THUC_VAT',
            edible: 100,
            water: 13.8,
            protein: 7.9,
            fat: 0.7,
            danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
              ten_danh_muc: 'Ngũ cốc và sản phẩm chế biến',
            },
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: BigInt(10) }),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    mockIngredientsService = {
      existsByMaterial: jest.fn().mockResolvedValue(false),
    };

    excelService = new IngredientExcelService(mockPrisma, mockIngredientsService);
  });

  describe('generateTemplate', () => {
    it('should generate a valid Excel template with dropdown lists', async () => {
      const buffer = await excelService.generateTemplate();
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Ingredients');
      expect(sheet).toBeDefined();

      const headerRow = sheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Tên nguyên liệu');
      expect(headerRow.getCell(2).value).toBe('Nhóm');
      expect(headerRow.getCell(3).value).toBe('Loại protein');
      expect(headerRow.getCell(4).value).toBe('Edible (%)');

      const metaSheet = wb.getWorksheet('_META_');
      expect(metaSheet).toBeDefined();
      expect(metaSheet!.state).toBe('hidden');
    });
  });

  describe('exportIngredients', () => {
    it('should export ingredients to an Excel buffer with correct formatting', async () => {
      const buffer = await excelService.exportIngredients({ dto: {} });
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Ingredients');
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBeGreaterThanOrEqual(2);

      const dataRow = sheet!.getRow(2);
      expect(dataRow.getCell(2).value).toBe('Gạo tẻ');
    });
  });

  describe('importExcel', () => {
    it('should throw IMPORT_EMPTY_FILE when workbook has no data rows', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Sheet1');
      sheet.addRow(['Tên nguyên liệu', 'Nhóm', 'Loại protein', 'Edible (%)']);
      const emptyBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      try {
        await excelService.importExcel({ fileBuffer: emptyBuffer });
        fail('Should have thrown IMPORT_EMPTY_FILE');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('IMPORT_EMPTY_FILE');
      }
    });

    it('should throw IMPORT_TOO_MANY_ROWS when exceeding 100 rows (Rule 19 & 20)', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Sheet1');
      sheet.addRow(['Tên nguyên liệu', 'Nhóm', 'Loại protein', 'Edible (%)']);
      for (let i = 1; i <= 101; i++) {
        sheet.addRow([`Nguyên liệu ${i}`, 'Ngũ cốc và sản phẩm chế biến', 'Thực vật', 100]);
      }
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      try {
        await excelService.importExcel({ fileBuffer: buffer });
        fail('Should have thrown IMPORT_TOO_MANY_ROWS');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('IMPORT_TOO_MANY_ROWS');
      }
    });

    it('should successfully import valid rows with atomic commit', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Sheet1');
      sheet.addRow([
        'Tên nguyên liệu',
        'Nhóm',
        'Loại protein',
        'Edible (%)',
        'Water (g)',
        'Protein (g)',
      ]);
      sheet.addRow([
        'Gạo nếp cái hoa vàng',
        'Ngũ cốc và sản phẩm chế biến',
        'Thực vật',
        100,
        14,
        8.2,
      ]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await excelService.importExcel({ fileBuffer: buffer, userId: 'admin-id' });

      expect(result.success).toBe(true);
      expect(result.totalImported).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return error Excel file when a row has validation errors', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Sheet1');
      sheet.addRow(['Tên nguyên liệu', 'Nhóm', 'Loại protein', 'Edible (%)']);
      sheet.addRow(['', 'Nhóm không tồn tại', 'Không rõ', -10]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await excelService.importExcel({ fileBuffer: buffer, userId: 'admin-id' });

      expect(result.success).toBe(false);
      expect(result.errorFileBuffer).toBeInstanceOf(Buffer);
      expect(result.errorsCount).toBe(1);

      // Verify the generated error Excel file has the error column
      const errorWb = new ExcelJS.Workbook();
      await errorWb.xlsx.load(result.errorFileBuffer! as any);
      const errSheet = errorWb.worksheets[0];
      const errRow = errSheet.getRow(2);
      const errCell = errRow.getCell(5); // Result col
      expect(errCell.value).toContain('❌ LỖI');
    });
  });
});
