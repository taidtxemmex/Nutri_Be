import { HttpException, HttpStatus } from '@nestjs/common';
import { DishesService } from '../../src/modules/dishes/services/dishes.service';
import { NutritionCalculatorService } from '../../src/core/nutrition-engine';
import { computeRecipeHash } from '../../src/core/nutrition-engine/recipe-hash.util';
import { UserRole } from '../../src/config/enums/role.enum';
import { DishStatus } from '../../src/config/enums/domain.enum';

describe('DishesService', () => {
  let service: DishesService;
  let mockPrisma: any;
  let mockCacheService: any;
  let nutritionCalculator: NutritionCalculatorService;

  beforeEach(() => {
    mockPrisma = {
      mon_an: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      chi_tiet_mon_an: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      nguyen_lieu: {
        findFirst: jest.fn(),
      },
      chi_tiet_bua_an: {
        count: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockCacheService = {
      debouncedInvalidateTags: jest.fn().mockResolvedValue(undefined),
    };

    nutritionCalculator = new NutritionCalculatorService();
    service = new DishesService(mockPrisma, mockCacheService, nutritionCalculator);
  });

  describe('create dish', () => {
    it('should throw PROP_006 if ingredient does not exist', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Món ăn mới',
            details: [{ ingredientId: 999, netWeight: 100 }],
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_006' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('should create dish in transaction, set recipe_hash, and calculate nutrients', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({ id: BigInt(1) });

      const mockSaved = {
        id: BigInt(100),
        nguoi_dung_id: 'user-1',
        ten_mon: 'Thịt bò xào',
        trang_thai: DishStatus.RIENG_TU,
        recipe_hash: computeRecipeHash([{ ingredientId: 1, weight: 150 }]),
        chi_tiet_mon_an: [
          {
            nguyen_lieu_id: BigInt(1),
            khoi_luong_song_sach: 150,
            nguyen_lieu: {
              id: BigInt(1),
              ten_nguyen_lieu: 'Thịt bò',
              protein: 20.0,
              fat: 8.0,
              edible: 100,
            },
          },
        ],
      };

      mockPrisma.mon_an.create.mockResolvedValue({ id: BigInt(100) });
      mockPrisma.mon_an.findUnique.mockResolvedValue(mockSaved);

      const res = await service.create(
        {
          name: 'Thịt bò xào',
          details: [{ ingredientId: 1, netWeight: 150 }],
        },
        { id: 'user-1' },
      );

      expect(res.id).toBe('100');
      expect(res.recipeHash).toBe(computeRecipeHash([{ ingredientId: 1, weight: 150 }]));
      expect(res.totalNutrients.protein).toBeCloseTo(30.0, 1);
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['dishes']);
    });
  });

  describe('Immutability Guard on update', () => {
    it('should throw DISH_CANNOT_EDIT (400) if attempting to edit DA_DUYET dish', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.DA_DUYET,
      });

      await expect(
        service.update(10, { name: 'Sửa tên' }, { id: 'user-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'DISH_002' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should throw DISH_CANNOT_EDIT (400) if attempting to edit HE_THONG dish', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.HE_THONG,
      });

      await expect(
        service.update(10, { name: 'Sửa tên' }, { id: 'user-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'DISH_002' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });
  });

  describe('propose dish & O(1) duplicate check', () => {
    it('should throw PROP_020 if dish is not RIENG_TU', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.CHO_DUYET,
        chi_tiet_mon_an: [],
      });

      await expect(
        service.proposeDish(10, { id: 'user-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_020' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should throw PROP_017 if dish already has pending proposal', async () => {
      mockPrisma.mon_an.findFirst
        .mockResolvedValueOnce({
          id: BigInt(10),
          nguoi_dung_id: 'user-1',
          trang_thai: DishStatus.RIENG_TU,
          chi_tiet_mon_an: [],
        })
        .mockResolvedValueOnce({ id: BigInt(20) }); // pending proposal exists

      await expect(
        service.proposeDish(10, { id: 'user-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_017' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should throw PROP_021 (DISH_DUPLICATE_RECIPE) if recipe_hash matches approved dish (O(1) index check)', async () => {
      const hash = computeRecipeHash([{ ingredientId: 1, weight: 100 }]);

      mockPrisma.mon_an.findFirst
        .mockResolvedValueOnce({
          id: BigInt(10),
          nguoi_dung_id: 'user-1',
          trang_thai: DishStatus.RIENG_TU,
          recipe_hash: hash,
          chi_tiet_mon_an: [],
        }) // original dish
        .mockResolvedValueOnce(null) // no pending
        .mockResolvedValueOnce({ id: BigInt(50) }); // duplicate approved dish found in DB by index!

      await expect(
        service.proposeDish(10, { id: 'user-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_021' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should propose dish successfully if no duplicate and valid', async () => {
      const hash = computeRecipeHash([{ ingredientId: 1, weight: 100 }]);

      mockPrisma.mon_an.findFirst
        .mockResolvedValueOnce({
          id: BigInt(10),
          nguoi_dung_id: 'user-1',
          trang_thai: DishStatus.RIENG_TU,
          recipe_hash: hash,
          chi_tiet_mon_an: [],
        })
        .mockResolvedValueOnce(null) // no pending
        .mockResolvedValueOnce(null); // no duplicate approved

      mockPrisma.mon_an.update.mockResolvedValue({});

      const res = await service.proposeDish(10, { id: 'user-1' });
      expect(res.message).toBe('Đã gửi đề xuất');
      expect(mockPrisma.mon_an.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: {
          trang_thai: DishStatus.CHO_DUYET,
          recipe_hash: hash,
        },
      });
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['dishes']);
    });
  });

  describe('approve & reject dish', () => {
    it('should throw DISH_001 if dish to approve is not CHO_DUYET', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        trang_thai: DishStatus.RIENG_TU,
      });

      await expect(
        service.approveDish(10, { id: 'admin-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'DISH_001' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should approve dish successfully by Admin', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        trang_thai: DishStatus.CHO_DUYET,
      });
      mockPrisma.mon_an.update.mockResolvedValue({});

      const res = await service.approveDish(10, { id: 'admin-1' });
      expect(res.message).toBe('Đã duyệt');
      expect(mockPrisma.mon_an.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.objectContaining({
            trang_thai: DishStatus.DA_DUYET,
            nguoi_phe_duyet_id: 'admin-1',
          }),
        }),
      );
    });

    it('should reject dish successfully by Admin with reason', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        trang_thai: DishStatus.CHO_DUYET,
      });
      mockPrisma.mon_an.update.mockResolvedValue({});

      const res = await service.rejectDish(10, 'Thiếu vi chất', { id: 'admin-1' });
      expect(res.message).toBe('Đã từ chối đề xuất');
      expect(mockPrisma.mon_an.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.objectContaining({
            trang_thai: DishStatus.TU_CHOI,
            ly_do_tu_choi: 'Thiếu vi chất',
            nguoi_phe_duyet_id: 'admin-1',
          }),
        }),
      );
    });
  });

  describe('clone dish', () => {
    it('should clone dish into RIENG_TU with mon_goc_id', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(15),
        ten_mon: 'Gà rán giòn',
        trang_thai: DishStatus.DA_DUYET,
        chi_tiet_mon_an: [
          {
            nguyen_lieu_id: BigInt(5),
            khoi_luong_song_sach: 200,
          },
        ],
      });

      mockPrisma.mon_an.create.mockResolvedValue({
        id: BigInt(101),
        ten_mon: 'Gà rán giòn (Bản sao)',
        trang_thai: DishStatus.RIENG_TU,
        mon_goc_id: BigInt(15),
      });

      const res = await service.cloneDish(15, {}, { id: 'user-1' });
      expect(res.id).toBe('101');
      expect(res.originalDishId).toBe('15');
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['dishes']);
    });
  });

  describe('delete dish', () => {
    it('should block deletion of public dishes (DISH_CANNOT_DELETE - 403)', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.DA_DUYET,
      });

      await expect(
        service.delete(10, { id: 'user-1', role: UserRole.USER }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'DISH_004' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('should block deletion if dish is used in meal/menu (DISH_IN_USE - 409)', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.RIENG_TU,
      });

      mockPrisma.chi_tiet_bua_an.count.mockResolvedValue(1); // In use!

      await expect(
        service.delete(10, { id: 'user-1', role: UserRole.USER }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'DISH_003' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('should soft-delete private unused dish', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-1',
        trang_thai: DishStatus.RIENG_TU,
      });

      mockPrisma.chi_tiet_bua_an.count.mockResolvedValue(0);
      mockPrisma.mon_an.update.mockResolvedValue({});

      const res = await service.delete(10, { id: 'user-1', role: UserRole.USER });
      expect(res.message).toContain('Xoá thành công');
      expect(mockPrisma.mon_an.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.objectContaining({
            deleted_at: expect.any(Date),
          }),
        }),
      );
    });
  });
});
