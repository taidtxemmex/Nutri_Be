import { HttpException, HttpStatus } from '@nestjs/common';
import { MealsService } from '../../src/modules/meals/services/meals.service';
import { NutritionCalculatorService } from '../../src/core/nutrition-engine';
import { UserRole } from '../../src/config/enums/role.enum';

describe('MealsService', () => {
  let service: MealsService;
  let mockPrisma: any;
  let mockCacheService: any;
  let nutritionCalculator: NutritionCalculatorService;

  beforeEach(() => {
    mockPrisma = {
      bua_an: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      chi_tiet_bua_an: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      mon_an: {
        findFirst: jest.fn(),
      },
      chi_tiet_thuc_don: {
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
    service = new MealsService(mockPrisma, mockCacheService, nutritionCalculator);
  });

  describe('create meal', () => {
    it('should throw PROP_019 if dish does not exist', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            mealName: 'Bữa sáng',
            time: '07:00',
            dishes: [{ dishId: 999, coefficient: 1.0 }],
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_019' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('should create meal and calculate 86 totalMealNutrients properly', async () => {
      mockPrisma.mon_an.findFirst.mockResolvedValue({ id: BigInt(10) });

      const mockSavedMeal = {
        id: BigInt(1),
        nguoi_dung_id: 'user-1',
        ten_bua_an: 'Bữa trưa',
        gio_an: '12:00',
        trang_thai: 'RIENG_TU',
        la_cong_khai: false,
        chi_tiet_bua_an: [
          {
            mon_an_id: BigInt(10),
            he_so_song_chin: 1.0,
            mon_an: {
              id: BigInt(10),
              ten_mon: 'Thịt bò luộc',
              chi_tiet_mon_an: [
                {
                  nguyen_lieu_id: BigInt(100),
                  khoi_luong_song_sach: 100,
                  nguyen_lieu: {
                    id: BigInt(100),
                    ten_nguyen_lieu: 'Thịt bò',
                    edible: 100,
                    protein: 21.5,
                    fat: 10.0,
                  },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.bua_an.create.mockResolvedValue({ id: BigInt(1) });
      mockPrisma.bua_an.findUnique.mockResolvedValue(mockSavedMeal);

      const res = await service.create(
        {
          mealName: 'Bữa trưa',
          time: '12:00',
          dishes: [{ dishId: 10, coefficient: 1.0 }],
        },
        { id: 'user-1' },
      );

      expect(res.id).toBe('1');
      expect(res.totalMealNutrients).toBeDefined();
      expect(res.totalMealNutrients.protein).toBeCloseTo(21.5, 1);
      expect(res.dishes).toHaveLength(1);
      expect(res.dishes[0].name).toBe('Thịt bò luộc');
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['meals']);
    });
  });

  describe('update meal - preserve old coefficient', () => {
    it('should preserve existing coefficient if not passed in update', async () => {
      mockPrisma.bua_an.findUnique.mockResolvedValueOnce({
        id: BigInt(1),
        nguoi_dung_id: 'user-1',
        chi_tiet_bua_an: [
          {
            mon_an_id: BigInt(10),
            he_so_song_chin: 0.85,
          },
        ],
      });

      mockPrisma.mon_an.findFirst.mockResolvedValue({ id: BigInt(10) });

      const updatedMealMock = {
        id: BigInt(1),
        nguoi_dung_id: 'user-1',
        ten_bua_an: 'Bữa trưa cập nhật',
        gio_an: '12:30',
        chi_tiet_bua_an: [
          {
            mon_an_id: BigInt(10),
            he_so_song_chin: 0.85,
            mon_an: {
              id: BigInt(10),
              ten_mon: 'Món 10',
              chi_tiet_mon_an: [],
            },
          },
        ],
      };
      mockPrisma.bua_an.findUnique.mockResolvedValueOnce(updatedMealMock);

      await service.update(
        1,
        {
          mealName: 'Bữa trưa cập nhật',
          time: '12:30',
          dishes: [{ dishId: 10 }], // Không truyền coefficient
        },
        { id: 'user-1' },
      );

      expect(mockPrisma.chi_tiet_bua_an.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            mon_an_id: BigInt(10),
            he_so_song_chin: 0.85, // Bảo toàn 0.85!
          }),
        ],
      });
    });
  });

  describe('delete meal - in use protection', () => {
    it('should throw MEAL_002 if meal is used in menus', async () => {
      mockPrisma.bua_an.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'user-1',
      });
      mockPrisma.chi_tiet_thuc_don.count.mockResolvedValue(2); // In use in 2 menus!

      await expect(
        service.delete(1, { id: 'user-1', role: UserRole.USER }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'MEAL_002' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('should delete meal successfully when not used in any menu', async () => {
      mockPrisma.bua_an.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'user-1',
      });
      mockPrisma.chi_tiet_thuc_don.count.mockResolvedValue(0);

      const res = await service.delete(1, { id: 'user-1', role: UserRole.USER });
      expect(res.message).toBe('Xóa bữa ăn thành công');
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['meals']);
    });
  });
});
