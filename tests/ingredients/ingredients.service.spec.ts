import { HttpException, HttpStatus } from '@nestjs/common';
import {
  IngredientsService,
  normalizeVietnameseNFC,
} from '../../src/modules/ingredients/services/ingredients.service';
import { UserRole } from '../../src/config/enums/role.enum';

describe('IngredientsService', () => {
  let service: IngredientsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      nguyen_lieu: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      danh_muc: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      chi_tiet_mon_an: {
        count: jest.fn().mockResolvedValue(0),
      },
      khau_phan_24h_nguyen_lieu: {
        count: jest.fn().mockResolvedValue(0),
      },
      he_so_song_chin: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops) => (Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma))),
    };

    service = new IngredientsService(mockPrisma);
  });

  describe('Unicode & Collation Normalization', () => {
    it('should distinguish Vietnamese tone marks ("Dứa" vs "Dừa")', async () => {
      // Mock DB returning a candidate with tone "Dừa"
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        { id: BigInt(1), ten_nguyen_lieu: 'Dừa xiêm' },
      ]);

      const exists = await service.existsByMaterial('Dứa');
      expect(exists).toBe(false);

      const existsSame = await service.existsByMaterial('Dừa xiêm');
      expect(existsSame).toBe(true);
    });

    it('should normalize combining accents with NFC', () => {
      const combined = 'D\u01B0\u0300a'; // Dừa in NFD
      const composed = 'Dừa'; // Dừa in NFC
      expect(normalizeVietnameseNFC(combined)).toEqual(composed);
    });
  });

  describe('findAll (Lean Query Projection - Rule 11)', () => {
    it('should only project basic columns and not load 77 nutrient columns', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          ten_nguyen_lieu: 'Gạo tẻ',
          danh_muc: 1,
          loai_protein: 'THUC_VAT',
          trang_thai: 'DA_DUYET',
          edible: 100,
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: { id: 1, ten_danh_muc: 'Ngũ cốc' },
        },
      ]);
      mockPrisma.nguyen_lieu.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].material).toBe('Gạo tẻ');
      expect(result.items[0].categoryName).toBe('Ngũ cốc');

      // Assert Lean Query Projection: check select passed to findMany
      const callArgs = mockPrisma.nguyen_lieu.findMany.mock.calls[0][0];
      expect(callArgs.select).toBeDefined();
      expect(callArgs.select.id).toBe(true);
      expect(callArgs.select.ten_nguyen_lieu).toBe(true);
      expect(callArgs.select.danh_muc).toBe(true);
      expect(callArgs.select.water).toBeUndefined();
      expect(callArgs.select.protein).toBeUndefined();
      expect(callArgs.select.fat).toBeUndefined();
      expect(callArgs.select.fiber).toBeUndefined();
    });
  });

  describe('findSummary (0ms speed)', () => {
    it('should query only id and ten_nguyen_lieu', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        { id: BigInt(1), ten_nguyen_lieu: 'Gạo tẻ' },
        { id: BigInt(2), ten_nguyen_lieu: 'Thịt bò' },
      ]);

      const result = await service.findSummary();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        ten_nguyen_lieu: 'Gạo tẻ',
        material: 'Gạo tẻ',
      });
      const callArgs = mockPrisma.nguyen_lieu.findMany.mock.calls[0][0];
      expect(callArgs.select).toEqual({ id: true, ten_nguyen_lieu: true });
    });
  });

  describe('findById (Full 86 Indicators)', () => {
    it('should throw PROP_006 when ingredient not found', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue(null);

      try {
        await service.findById(999);
        fail('Should have thrown PROP_006');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(err.getResponse().code).toBe('PROP_006');
      }
    });

    it('should calculate carbohydrate, energy, and vitaminARae correctly with Decimal.js precision', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Gạo tẻ',
        danh_muc: 1,
        loai_protein: 'THUC_VAT',
        trang_thai: 'DA_DUYET',
        edible: 100,
        water: 13.8,
        protein: 7.9,
        fat: 0.7,
        fiber: 0.4,
        ash: 0.8,
        retinol: 0,
        betaCarotene: 120, // 120 / 12 = 10 RAE
        alphaCarotene: 0,
        betaCryptoxanthin: 0,
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: { id: 1, ten_danh_muc: 'Ngũ cốc' },
      });

      const detail = await service.findById(1);

      expect(detail.id).toBe('1');
      expect(detail.material).toBe('Gạo tẻ');
      // Carbohydrate = 100 - (13.8 + 7.9 + 0.7 + 0.4 + 0.8) = 76.4
      expect(detail.carbohydrate).toBe(76.4);
      // Energy = 4 * 7.9 + 9 * 0.7 + 4 * 76.4 = 31.6 + 6.3 + 305.6 = 343.5
      expect(detail.energy).toBe(343.5);
      // Vitamin A RAE = 120 / 12 = 10
      expect(detail.vitaminARae).toBe(10);
    });
  });

  describe('create', () => {
    it('should throw PROP_014 when duplicate name exists', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        { id: BigInt(1), ten_nguyen_lieu: 'Gạo tẻ' },
      ]);

      try {
        await service.create({ material: 'Gạo tẻ' }, { id: 'user-1', role: UserRole.ADMIN });
        fail('Should have thrown PROP_014');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('PROP_014');
      }
    });

    it('should set trang_thai = CHO_DUYET for USER and DA_DUYET for ADMIN', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([]);
      mockPrisma.nguyen_lieu.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: BigInt(100),
          ...data,
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: null,
        }),
      );

      // 1. Regular user
      await service.create(
        { material: 'Rau cải xanh mới' },
        { id: 'user-uuid', role: UserRole.USER },
      );
      expect(mockPrisma.nguyen_lieu.create.mock.calls[0][0].data.trang_thai).toBe('CHO_DUYET');

      // 2. Admin
      await service.create(
        { material: 'Thịt đà điểu' },
        { id: 'admin-uuid', role: UserRole.ADMIN },
      );
      expect(mockPrisma.nguyen_lieu.create.mock.calls[1][0].data.trang_thai).toBe('DA_DUYET');
    });
  });

  describe('update', () => {
    it('should throw ING_001 if ingredient is not DA_DUYET', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Nguyên liệu chờ duyệt',
        trang_thai: 'CHO_DUYET',
      });

      try {
        await service.update(1, { material: 'Tên mới' }, { id: 'admin-1', role: UserRole.ADMIN });
        fail('Should have thrown ING_001');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('ING_001');
      }
    });

    it('should create new pending record when USER edits an approved ingredient', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Gạo tẻ',
        trang_thai: 'DA_DUYET',
        danh_muc: 1,
        loai_protein: 'THUC_VAT',
        edible: 100,
      });

      mockPrisma.nguyen_lieu.create.mockResolvedValue({
        id: BigInt(2),
        ten_nguyen_lieu: 'Gạo tẻ sửa đổi',
        trang_thai: 'CHO_DUYET',
        tao_boi_id: 'user-uuid',
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: null,
      });

      const result = await service.update(
        1,
        { material: 'Gạo tẻ sửa đổi', edible: 95 },
        { id: 'user-uuid', role: UserRole.USER },
      );

      expect(mockPrisma.nguyen_lieu.create).toHaveBeenCalled();
      const createData = mockPrisma.nguyen_lieu.create.mock.calls[0][0].data;
      expect(createData.trang_thai).toBe('CHO_DUYET');
      expect(createData.tao_boi_id).toBe('user-uuid');
      expect(createData.edible).toBe(95);
      expect(result.id).toBe('2');
    });

    it('should update directly when ADMIN edits an approved ingredient', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Gạo tẻ',
        trang_thai: 'DA_DUYET',
        danh_muc: 1,
      });

      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([]);
      mockPrisma.nguyen_lieu.update.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Gạo tẻ thơm',
        trang_thai: 'DA_DUYET',
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: null,
      });

      await service.update(
        1,
        { material: 'Gạo tẻ thơm' },
        { id: 'admin-uuid', role: UserRole.ADMIN },
      );

      expect(mockPrisma.nguyen_lieu.update).toHaveBeenCalled();
      const updateData = mockPrisma.nguyen_lieu.update.mock.calls[0][0].data;
      expect(updateData.ten_nguyen_lieu).toBe('Gạo tẻ thơm');
      expect(updateData.trang_thai).toBe('DA_DUYET');
    });
  });

  describe('delete (Proactive Delete Guard)', () => {
    it('should throw ING_002 when ingredient is used in dishes', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(5),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.chi_tiet_mon_an.count.mockResolvedValue(2);

      try {
        await service.delete(5);
        fail('Should have thrown ING_002');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe('ING_002');
      }
    });

    it('should throw ING_002 when ingredient is used in 24h intake', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(5),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.chi_tiet_mon_an.count.mockResolvedValue(0);
      mockPrisma.khau_phan_24h_nguyen_lieu.count.mockResolvedValue(1);

      try {
        await service.delete(5);
        fail('Should have thrown ING_002');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe('ING_002');
      }
    });

    it('should throw ING_002 when ingredient is used in raw-cooked coefficient', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(5),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.chi_tiet_mon_an.count.mockResolvedValue(0);
      mockPrisma.khau_phan_24h_nguyen_lieu.count.mockResolvedValue(0);
      mockPrisma.he_so_song_chin.count.mockResolvedValue(3);

      try {
        await service.delete(5);
        fail('Should have thrown ING_002');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe('ING_002');
      }
    });

    it('should perform soft-delete when ingredient is not in use', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(5),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.chi_tiet_mon_an.count.mockResolvedValue(0);
      mockPrisma.khau_phan_24h_nguyen_lieu.count.mockResolvedValue(0);
      mockPrisma.he_so_song_chin.count.mockResolvedValue(0);

      const res = await service.delete(5);

      expect(res.message).toContain('Đã xóa nguyên liệu thành công');
      expect(mockPrisma.nguyen_lieu.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { deleted_at: expect.any(Date) },
      });
    });
  });

  describe('calculateSummary (Dynamic Ingredient Nutrition Calculation)', () => {
    const mockRice = {
      id: BigInt(1),
      ten_nguyen_lieu: 'Gạo tẻ',
      danh_muc: 1,
      edible: 100,
      water: 14,
      protein: 8,
      fat: 1,
      ash: 1,
      fiber: 0.5,
      calci: 30,
      iron: 1.5,
      loai_protein: 'THUC_VAT',
    };

    const mockBeef = {
      id: BigInt(2),
      ten_nguyen_lieu: 'Thịt bò',
      danh_muc: 2,
      edible: 100,
      water: 74,
      protein: 21,
      fat: 4,
      ash: 1,
      fiber: 0,
      calci: 12,
      iron: 2.7,
      loai_protein: 'DONG_VAT',
    };

    const mockBanana = {
      id: BigInt(3),
      ten_nguyen_lieu: 'Chuối tiêu',
      danh_muc: 3,
      edible: 70, // 30% vỏ
      water: 75,
      protein: 1.5,
      fat: 0.2,
      ash: 0.8,
      fiber: 0.5,
      calci: 8,
      iron: 0.6,
      loai_protein: 'THUC_VAT',
    };

    it('should calculate summary for multiple ingredients using a single findMany query', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([mockRice, mockBeef]);

      const dto = {
        items: [
          { ingredientId: 1, weight: 100, isNetWeight: true, coefficient: 1 },
          { ingredientId: 2, weight: 50, isNetWeight: true, coefficient: 0.85 },
        ],
      };

      const result = await service.calculateSummary(dto as any);

      // Verify single database query with { in: [...] }
      expect(mockPrisma.nguyen_lieu.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.nguyen_lieu.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [BigInt(1), BigInt(2)] },
          deleted_at: null,
        },
      });

      // Verify weights:
      // Item 1: gross 100, edible 100, cooked 100 * 1 = 100
      // Item 2: gross 50, edible 50, cooked 50 * 0.85 = 42.5
      expect(result.totalGrossWeight).toBe(150);
      expect(result.totalEdibleWeight).toBe(150);
      expect(result.totalCookedWeight).toBe(142.5);

      // Verify items breakdown
      expect(result.items).toHaveLength(2);
      expect(result.items[0].ingredientId).toBe(1);
      expect(result.items[0].name).toBe('Gạo tẻ');
      expect(result.items[0].cookedWeight).toBe(100);
      expect(result.items[1].ingredientId).toBe(2);
      expect(result.items[1].name).toBe('Thịt bò');
      expect(result.items[1].cookedWeight).toBe(42.5);

      // Verify nutrients accumulation (Decimal.js precision):
      // Protein: 100g Rice (8g) + 50g Beef (21 * 0.5 = 10.5g) = 18.5g
      expect(result.nutrients.protein).toBe(18.5);
      // Fat: 100g Rice (1g) + 50g Beef (4 * 0.5 = 2g) = 3g
      expect(result.nutrients.fat).toBe(3);
      // Animal protein: Beef = 10.5g
      expect(result.nutrients.proteinAnimal).toBe(10.5);
      // Plant protein: Rice = 8g
      expect(result.nutrients.proteinPlant).toBe(8);
      // Iron: Rice 1.5 + Beef 2.7*0.5 = 1.5 + 1.35 = 2.85mg
      expect(result.nutrients.iron).toBe(2.85);
    });

    it('should handle isNetWeight=false with edible rate properly', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([mockBanana]);

      // Banana edible = 70%. Input 100g gross (cân cả vỏ)
      const dto = {
        items: [{ ingredientId: 3, weight: 100, isNetWeight: false, coefficient: 1 }],
      };

      const result = await service.calculateSummary(dto as any);

      // grossWeight = 100g, edibleWeight = 100 * 0.7 = 70g
      expect(result.totalGrossWeight).toBe(100);
      expect(result.totalEdibleWeight).toBe(70);
      expect(result.totalCookedWeight).toBe(70);
      expect(result.items[0].grossWeight).toBe(100);
      expect(result.items[0].edibleWeight).toBe(70);

      // Nutrients scaled by 0.7: Protein = 1.5 * 0.7 = 1.05g
      expect(result.nutrients.protein).toBe(1.05);
    });

    it('should handle isNetWeight=true with edible rate properly', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([mockBanana]);

      // Banana edible = 70%. Input 70g net (thịt quả ăn được sạch)
      const dto = {
        items: [{ ingredientId: 3, weight: 70, isNetWeight: true, coefficient: 1 }],
      };

      const result = await service.calculateSummary(dto as any);

      // edibleWeight = 70g, grossWeight needed = 70 / 0.7 = 100g
      expect(result.totalGrossWeight).toBe(100);
      expect(result.totalEdibleWeight).toBe(70);
      expect(result.totalCookedWeight).toBe(70);
      expect(result.items[0].grossWeight).toBe(100);
      expect(result.items[0].edibleWeight).toBe(70);

      // Nutrients: Protein = 1.5 * 0.7 = 1.05g
      expect(result.nutrients.protein).toBe(1.05);
    });

    it('should support alias fields (id and weightGrams)', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([mockRice]);

      const dto = {
        items: [{ id: 1, weightGrams: 200, isNetWeight: true }],
      };

      const result = await service.calculateSummary(dto as any);

      expect(result.totalGrossWeight).toBe(200);
      expect(result.totalEdibleWeight).toBe(200);
      expect(result.totalCookedWeight).toBe(200); // default coeff = 1
      expect(result.items[0].ingredientId).toBe(1);
      // Protein: 8 * 2 = 16g
      expect(result.nutrients.protein).toBe(16);
    });

    it('should throw NOT_FOUND (PROP_006) when ingredient ID does not exist in DB', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([mockRice]); // ID 999 not returned

      const dto = {
        items: [
          { ingredientId: 1, weight: 100 },
          { ingredientId: 999, weight: 50 },
        ],
      };

      try {
        await service.calculateSummary(dto as any);
        fail('Should have thrown NOT_FOUND');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(err.getResponse().code).toBe('PROP_006');
        expect(err.getResponse().message).toContain('999');
      }
    });

    it('should throw BAD_REQUEST when items array is empty or missing', async () => {
      try {
        await service.calculateSummary({ items: [] } as any);
        fail('Should have thrown BAD_REQUEST');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('VALIDATION_FAILED');
      }
    });

    it('should throw BAD_REQUEST when an item has missing ID or non-positive weight', async () => {
      try {
        await service.calculateSummary({ items: [{ weight: 100 }] } as any);
        fail('Should have thrown BAD_REQUEST for missing ID');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('VALIDATION_FAILED');
      }

      try {
        await service.calculateSummary({ items: [{ ingredientId: 1, weight: -10 }] } as any);
        fail('Should have thrown BAD_REQUEST for negative weight');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('VALIDATION_FAILED');
      }
    });
  });
});
