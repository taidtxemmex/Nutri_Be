import { HttpException } from '@nestjs/common';
import { DailyIntakesService } from '../../src/modules/daily-intakes/services/daily-intakes.service';
import { IntakeInputType } from '../../src/config/enums/domain.enum';

describe('DailyIntakesService', () => {
  let service: DailyIntakesService;
  let mockPrisma: any;
  let mockCache: any;
  let mockNutritionCalculator: any;

  const mockUser = { id: 'user-uuid-1', role: 'USER' };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      benh_nhan: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      khau_phan_24h: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      khau_phan_24h_bua_an: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      khau_phan_24h_nguyen_lieu: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    mockCache = {
      invalidateTag: jest.fn().mockResolvedValue(true),
    };

    mockNutritionCalculator = {};

    service = new DailyIntakesService(mockPrisma, mockCache, mockNutritionCalculator);
  });

  describe('1. create', () => {
    it('tạo khẩu phần 24h thành công và chặn trùng ngày ăn của cùng bệnh nhân (UKmscxxi0es7bbg73tw1iwb2lnt)', async () => {
      mockPrisma.benh_nhan.findFirst.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: mockUser.id,
      });

      // Lần 1: Không bị trùng
      mockPrisma.khau_phan_24h.findFirst.mockResolvedValue(null);

      mockPrisma.khau_phan_24h.create.mockResolvedValue({ id: BigInt(10) });
      mockPrisma.khau_phan_24h_bua_an.create.mockResolvedValue({ id: BigInt(100) });
      mockPrisma.khau_phan_24h_nguyen_lieu.create.mockResolvedValue({ id: BigInt(1000) });

      // Mock getById
      mockPrisma.khau_phan_24h.findUnique.mockResolvedValue({
        id: BigInt(10),
        benh_nhan_id: BigInt(1),
        ngay_an: new Date('2026-02-01'),
        kieu_nhap: IntakeInputType.BY_MEAL,
        ghi_chu: 'Ăn bình thường',
        benh_nhan: { id: BigInt(1), ho_ten: 'Bệnh nhân A', nguoi_dung_id: mockUser.id },
        khau_phan_24h_bua_an: [
          {
            id: BigInt(100),
            thu_tu_bua: 1,
            ten_bua: 'Bữa sáng',
            gio_an: '07:00',
            khau_phan_24h_nguyen_lieu: [
              {
                id: BigInt(1000),
                nguyen_lieu_id: BigInt(5),
                khoi_luong_song_sach: 100,
                nguyen_lieu: {
                  ten_nguyen_lieu: 'Gạo tẻ',
                  edible: 100,
                  water: 13.8,
                  protein: 7.9,
                  fat: 0.7,
                  fiber: 0.4,
                  ash: 0.6,
                },
              },
            ],
          },
        ],
      });

      const res = await service.create(
        {
          patientId: '1',
          intakeDate: '2026-02-01',
          inputType: IntakeInputType.BY_MEAL,
          note: 'Ăn bình thường',
          meals: [
            {
              mealOrder: 1,
              mealName: 'Bữa sáng',
              mealTime: '07:00',
              ingredients: [{ ingredientId: '5', rawWeight: 100 }],
            },
          ],
        },
        mockUser,
      );

      expect(res.id).toBe('10');
      expect(res.totalDayNutrients.energy).toBeCloseTo(344, 0);
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('daily-intakes');

      // Lần 2: Trùng ngày -> ném lỗi
      mockPrisma.khau_phan_24h.findFirst.mockResolvedValue({ id: BigInt(10) });

      await expect(
        service.create(
          {
            patientId: '1',
            intakeDate: '2026-02-01',
            inputType: IntakeInputType.BY_MEAL,
            meals: [],
          },
          mockUser,
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('2. getRdaReport', () => {
    it('tạo báo cáo RDA đối chiếu lâm sàng theo tuổi và giới tính của bệnh nhân', async () => {
      mockPrisma.khau_phan_24h.findUnique.mockResolvedValue({
        id: BigInt(10),
        benh_nhan_id: BigInt(1),
        ngay_an: new Date('2026-02-01'),
        kieu_nhap: IntakeInputType.BY_MEAL,
        benh_nhan: { id: BigInt(1), ho_ten: 'Bệnh nhân A', nguoi_dung_id: mockUser.id },
        khau_phan_24h_bua_an: [
          {
            id: BigInt(100),
            thu_tu_bua: 1,
            ten_bua: 'Bữa sáng',
            khau_phan_24h_nguyen_lieu: [
              {
                id: BigInt(1000),
                nguyen_lieu_id: BigInt(5),
                khoi_luong_song_sach: 200,
                nguyen_lieu: {
                  ten_nguyen_lieu: 'Thịt bò',
                  edible: 100,
                  energy: 364,
                  protein: 42,
                  fat: 20,
                  carbohydrate: 0,
                  iron: 6.2,
                },
              },
            ],
          },
        ],
      });

      mockPrisma.benh_nhan.findUnique.mockResolvedValue({
        id: BigInt(1),
        ho_ten: 'Nguyễn Văn A',
        gioi_tinh: 'NAM',
        ngay_sinh: new Date('1990-05-15'),
        can_nang: 68,
        chieu_cao: 172,
        he_so_hoat_dong: 1.5,
      });

      const rdaReport = await service.getRdaReport('10', mockUser);

      expect(rdaReport.demographic.gender).toBe('NAM');
      expect(rdaReport.demographic.ageYears).toBeGreaterThan(30);
      expect(rdaReport.summary).toBeDefined();
      expect(rdaReport.nutrients.length).toBeGreaterThan(0);
    });
  });
});
