import { HttpException } from '@nestjs/common';
import { NutritionLimitSetsService } from '../../src/modules/nutrition-limit-sets/services/nutrition-limit-sets.service';
import { NutritionLimitWarning } from '../../src/config/enums/domain.enum';

describe('NutritionLimitSetsService', () => {
  let service: NutritionLimitSetsService;
  let mockPrisma: any;
  let mockCache: any;

  const mockUser = { id: 'user-uuid-1', role: 'USER' };

  beforeEach(() => {
    mockPrisma = {
      gioi_han_dinh_duong: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      thuc_don: {
        count: jest.fn().mockResolvedValue(0),
      },
      de_xuat_thuc_don: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    mockCache = {
      invalidateTag: jest.fn().mockResolvedValue(true),
      debouncedInvalidateTags: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn((k, ttl, fn) => fn()),
      generateKey: jest.fn((prefix) => `cache:${prefix}:key`),
    };

    service = new NutritionLimitSetsService(mockPrisma, mockCache);
  });

  describe('1. create', () => {
    it('tạo bộ giới hạn dinh dưỡng mới thành công', async () => {
      mockPrisma.gioi_han_dinh_duong.findFirst.mockResolvedValue(null);
      mockPrisma.gioi_han_dinh_duong.create.mockResolvedValue({
        id: BigInt(1),
        ten_gioi_han: 'Giới hạn tiểu đường',
        canh_bao: NutritionLimitWarning.GTE_5,
        tai_su_dung: true,
        gioi_han_json: { energy: 2000, carbohydrate: 250 },
        ngay_tao: new Date(),
        ngay_cap_nhat: new Date(),
      });

      const res = await service.create({
        dto: {
          name: 'Giới hạn tiểu đường',
          warningRule: NutritionLimitWarning.GTE_5,
          reusable: true,
          limits: { energy: 2000, carbohydrate: 250 },
        },
        currentUser: mockUser,
      });

      expect(res.id).toBe('1');
      expect(res.warningRule).toBe(NutritionLimitWarning.GTE_5);
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('nutrition-limit-sets');
    });

    it('báo lỗi NLS_001 nếu trùng tên mẫu tái sử dụng', async () => {
      mockPrisma.gioi_han_dinh_duong.findFirst.mockResolvedValue({ id: BigInt(1) });

      await expect(
        service.create({
          dto: {
            name: 'Mẫu trùng',
            reusable: true,
            limits: {},
          },
          currentUser: mockUser,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('2. delete', () => {
    it('từ chối xóa nếu bộ giới hạn đang được dùng trong thực đơn (NLS_002)', async () => {
      mockPrisma.gioi_han_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: mockUser.id,
      });

      mockPrisma.thuc_don.count.mockResolvedValue(1);

      await expect(service.delete({ id: '1', currentUser: mockUser })).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('3. getById & getAll & update', () => {
    it('lấy danh sách bộ giới hạn dinh dưỡng của người dùng', async () => {
      mockPrisma.gioi_han_dinh_duong.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ten_gioi_han: 'Giới hạn mẫu',
          canh_bao: NutritionLimitWarning.OFF,
          tai_su_dung: true,
          gioi_han_json: {},
          ngay_tao: new Date(),
          ngay_cap_nhat: new Date(),
        },
      ]);

      const res = await service.getAll({ currentUser: mockUser });
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('Giới hạn mẫu');
    });

    it('lấy chi tiết bộ giới hạn dinh dưỡng', async () => {
      mockPrisma.gioi_han_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: mockUser.id,
        ten_gioi_han: 'Giới hạn mẫu',
        canh_bao: NutritionLimitWarning.OFF,
        tai_su_dung: false,
        gioi_han_json: {},
      });

      const res = await service.getById({ id: '1', currentUser: mockUser });
      expect(res.id).toBe('1');
    });

    it('cập nhật bộ giới hạn dinh dưỡng thành công', async () => {
      mockPrisma.gioi_han_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: mockUser.id,
        ten_gioi_han: 'Cũ',
        canh_bao: NutritionLimitWarning.OFF,
        tai_su_dung: false,
        gioi_han_json: {},
      });
      mockPrisma.gioi_han_dinh_duong.update.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: mockUser.id,
        ten_gioi_han: 'Mới',
        canh_bao: NutritionLimitWarning.OFF,
        tai_su_dung: false,
        gioi_han_json: {},
        ngay_cap_nhat: new Date(),
      });

      const res = await service.update({
        id: '1',
        dto: { name: 'Mới' },
        currentUser: mockUser,
      });
      expect(res.name).toBe('Mới');
    });
  });
});
