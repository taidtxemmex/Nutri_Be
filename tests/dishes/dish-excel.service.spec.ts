import { HttpException, HttpStatus } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DishExcelService } from '../../src/modules/dishes/dish-excel.service';

describe('DishExcelService', () => {
  let service: DishExcelService;
  let mockPrisma: any;
  let mockNutritionCalculator: any;

  const mockIngredients = [
    {
      id: BigInt(1),
      ten_nguyen_lieu: 'Gạo tẻ',
      danh_muc: 1,
      loai_protein: 'THUC_VAT',
      edible: 100,
      water: 13.8,
      protein: 7.9,
      fat: 0.7,
      ash: 0.6,
      fiber: 0.4,
      calci: 30,
      iron: 1.2,
      sodium: 3,
      potassium: 110,
      vitaminC: 0,
      retinol: 0,
      betaCarotene: 0,
      alphaCarotene: 0,
      betaCryptoxanthin: 0,
    },
    {
      id: BigInt(2),
      ten_nguyen_lieu: 'Thịt bò bắp',
      danh_muc: 2,
      loai_protein: 'DONG_VAT',
      edible: 100,
      water: 70.5,
      protein: 21.0,
      fat: 7.5,
      ash: 1.0,
      fiber: 0,
      calci: 12,
      iron: 2.7,
      sodium: 70,
      potassium: 350,
      vitaminC: 1,
      retinol: 10,
      betaCarotene: 0,
      alphaCarotene: 0,
      betaCryptoxanthin: 0,
    },
    {
      id: BigInt(3),
      ten_nguyen_lieu: 'Bánh phở',
      danh_muc: 1,
      loai_protein: 'THUC_VAT',
      edible: 100,
      water: 52.0,
      protein: 3.2,
      fat: 0.3,
      ash: 0.4,
      fiber: 0.2,
      calci: 15,
      iron: 0.6,
      sodium: 5,
      potassium: 40,
      vitaminC: 0,
      retinol: 0,
      betaCarotene: 0,
      alphaCarotene: 0,
      betaCryptoxanthin: 0,
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      nguyen_lieu: {
        findMany: jest.fn().mockResolvedValue(mockIngredients),
      },
      mon_an: {
        findMany: jest.fn().mockResolvedValue([
          { ten_mon: 'Cơm rang dưa bò' }, // Món đã tồn tại
        ]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(100),
            ...data,
          }),
        ),
      },
      chi_tiet_mon_an: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(200),
            ...data,
          }),
        ),
      },
      $transaction: jest.fn(async (callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrisma);
        }
        return Promise.all(callback);
      }),
    };

    mockNutritionCalculator = {
      calculateDishNutrition: jest.fn().mockReturnValue({
        dishId: BigInt(100),
        rawWeightGrams: 200,
        netWeightGrams: 200,
        cookedWeightGrams: 200,
        nutrients: {
          energy: 350,
          protein: 25,
          fat: 8,
          carbohydrate: 45,
          fiber: 1,
          calci: 42,
          iron: 3.9,
          sodium: 75,
          potassium: 460,
          vitaminC: 1,
          vitaminARae: 10,
        },
      }),
    };

    service = new DishExcelService(mockPrisma, mockNutritionCalculator);
  });

  describe('1. generateImportTemplate', () => {
    it('should generate a workbook with exactly 3 sheets: Mon_an, Huong_dan, DS_nguyen_lieu', async () => {
      const buffer = await service.generateImportTemplate();
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      expect(wb.worksheets.length).toBe(3);
      expect(wb.getWorksheet('Mon_an')).toBeDefined();
      expect(wb.getWorksheet('Huong_dan')).toBeDefined();
      expect(wb.getWorksheet('DS_nguyen_lieu')).toBeDefined();
    });

    it('should configure Mon_an sheet with red bold headers and frozen first row', async () => {
      const buffer = await service.generateImportTemplate();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Mon_an')!;
      const headerRow = sheet.getRow(1);

      expect(headerRow.getCell(1).value).toBe('Tên món ăn');
      expect(headerRow.getCell(2).value).toBe('Tên nguyên liệu');
      expect(headerRow.getCell(3).value).toBe('KL sống sạch (g)');

      expect(headerRow.getCell(1).font?.bold).toBe(true);
      expect(headerRow.getCell(1).font?.color?.argb).toBe('FFFF0000');

      expect(sheet.views).toBeDefined();
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    });

    it('should populate active ingredients into DS_nguyen_lieu sheet', async () => {
      const buffer = await service.generateImportTemplate();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const refSheet = wb.getWorksheet('DS_nguyen_lieu')!;
      expect(refSheet.getRow(1).getCell(1).value).toBe('Tên nguyên liệu');
      expect(refSheet.rowCount).toBeGreaterThanOrEqual(4); // 1 header + 3 mock ingredients
    });

    it('should include instructions and example rows in Huong_dan sheet', async () => {
      const buffer = await service.generateImportTemplate();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const guideSheet = wb.getWorksheet('Huong_dan')!;
      expect(guideSheet.rowCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('2. importExcel', () => {
    it('should throw IMPORT_EMPTY_FILE if file buffer is empty or workbook has no data rows', async () => {
      await expect(
        service.importExcel({ fileBuffer: Buffer.alloc(0), userId: 'user-1' }),
      ).rejects.toThrow(HttpException);

      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Mon_an');
      sheet.addRow(['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)']);
      const emptyBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      await expect(
        service.importExcel({ fileBuffer: emptyBuffer, userId: 'user-1' }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw IMPORT_INVALID_TEMPLATE if headers do not match expected structure', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Mon_an');
      sheet.addRow(['Cột sai 1', 'Cột sai 2', 'Cột sai 3']);
      sheet.addRow(['Phở bò', 'Bánh phở', 100]);
      const invalidBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      try {
        await service.importExcel({ fileBuffer: invalidBuffer, userId: 'user-1' });
        fail('Should throw IMPORT_INVALID_TEMPLATE');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('IMPORT_INVALID_TEMPLATE');
      }
    });

    it('should return error file and NOT write to DB when validation errors exist', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Mon_an');
      sheet.addRow(['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)']);
      // Dòng 1: Món đã tồn tại trong CSDL ("Cơm rang dưa bò")
      sheet.addRow(['Cơm rang dưa bò', 'Gạo tẻ', 100]);
      // Dòng 2: Nguyên liệu không tồn tại
      sheet.addRow(['Phở gà', 'Nguyên liệu không có trong DB', 50]);
      // Dòng 3: Khối lượng âm
      sheet.addRow(['', 'Gạo tẻ', -20]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.importExcel({ fileBuffer: buffer, userId: 'user-1' });

      expect(result.success).toBe(false);
      expect(result.importedCount).toBe(0);
      expect(result.errorFileBuffer).toBeInstanceOf(Buffer);
      expect(result.errorFileName).toBe('dish_import_errors.xlsx');
      expect(mockPrisma.mon_an.create).not.toHaveBeenCalled();
      expect(mockPrisma.chi_tiet_mon_an.create).not.toHaveBeenCalled();

      // Kiểm tra file lỗi có cột "Kết quả import"
      const errWb = new ExcelJS.Workbook();
      await errWb.xlsx.load(result.errorFileBuffer as any);
      const errSheet = errWb.getWorksheet('Mon_an')!;
      expect(errSheet.getRow(1).getCell(4).value).toBe('Kết quả import');
      expect(errSheet.getRow(2).getCell(4).value).toContain('Bạn đã có món');
      expect(errSheet.getRow(3).getCell(4).value).toContain('Không tìm thấy nguyên liệu');
      expect(errSheet.getRow(4).getCell(4).value).toContain('Khối lượng');
    });

    it('should successfully import valid dishes, merge duplicate ingredients, compute recipe_hash and commit atomically', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Mon_an');
      sheet.addRow(['Tên món ăn', 'Tên nguyên liệu', 'KL sống sạch (g)']);
      // Món 1: Phở bò đặc biệt (2 dòng: Bánh phở 150g, Thịt bò bắp 80g)
      sheet.addRow(['Phở bò đặc biệt', 'Bánh phở', 150]);
      sheet.addRow(['', 'Thịt bò bắp', 80]);
      // Dòng lặp nguyên liệu trong cùng món -> cộng dồn
      sheet.addRow(['', 'Thịt bò bắp', 20]); // Tổng thịt bò bắp sẽ là 100g

      // Món 2: Cơm trắng (1 dòng: Gạo tẻ 80g)
      sheet.addRow(['Cơm trắng gia đình', 'Gạo tẻ', 80]);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.importExcel({ fileBuffer: buffer, userId: 'user-1' });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Kiểm tra món 1 được tạo
      expect(mockPrisma.mon_an.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nguoi_dung_id: 'user-1',
            ten_mon: 'Phở bò đặc biệt',
            trang_thai: 'RIENG_TU',
            recipe_hash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 64 chars
          }),
        }),
      );

      // Kiểm tra chi tiết nguyên liệu món 1 được cộng dồn (Thịt bò bắp = 80 + 20 = 100)
      expect(mockPrisma.chi_tiet_mon_an.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nguyen_lieu_id: BigInt(2),
            khoi_luong_song_sach: 100,
          }),
        }),
      );
    });
  });

  describe('3. exportDishes', () => {
    it('should export dishes to Dish_Nutrition_Detail sheet with fixed columns and nutrient totals', async () => {
      const dishes = [
        {
          id: BigInt(10),
          ten_mon: 'Phở bò Hà Nội',
          chi_tiet_mon_an: [
            {
              khoi_luong_song_sach: 150,
              nguyen_lieu: mockIngredients[2], // Bánh phở
            },
            {
              khoi_luong_song_sach: 100,
              nguyen_lieu: mockIngredients[1], // Thịt bò bắp
            },
          ],
        },
      ];

      const selectedColumns = ['energy', 'protein', 'fat', 'carbohydrate'];
      const buffer = await service.exportDishes({ dtoOrDishes: dishes, columns: selectedColumns });
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Dish_Nutrition_Detail')!;
      expect(sheet).toBeDefined();

      const headerRow = sheet.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Món ăn');
      expect(headerRow.getCell(2).value).toBe('Tên TP');
      expect(headerRow.getCell(3).value).toBe('Sống sạch (g)');
      expect(headerRow.getCell(4).value).toBe('Ăn được (%)');
      expect(headerRow.getCell(5).value).toBe('Sống thô (g)');

      // Kiểm tra dòng TOTAL
      // Row 2: Bánh phở
      // Row 3: Thịt bò bắp
      // Row 4: TỔNG MÓN
      const totalRow = sheet.getRow(4);
      expect(totalRow.getCell(1).value).toBe('TỔNG MÓN');
      expect(totalRow.getCell(6).value).toBeGreaterThan(0); // Năng lượng tổng
    });

    it('should support default nutrient columns when selectedColumns is omitted', async () => {
      const dishes = [
        {
          name: 'Cơm gạo tẻ',
          details: [
            {
              netWeight: 100,
              ingredient: mockIngredients[0],
            },
          ],
        },
      ];

      const buffer = await service.exportDishes({ dtoOrDishes: dishes });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Dish_Nutrition_Detail')!;
      expect(sheet.getRow(1).cellCount).toBeGreaterThanOrEqual(10);
    });
  });
});
