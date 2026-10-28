import { NutritionGuidesService } from '../../src/modules/nutrition-guides/services/nutrition-guides.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('NutritionGuidesService', () => {
  let service: NutritionGuidesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      huong_dan_dinh_duong: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new NutritionGuidesService(mockPrisma);
  });

  describe('getAll', () => {
    it('should return all nutrition guides', async () => {
      mockPrisma.huong_dan_dinh_duong.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ten_benh: 'Tiểu đường',
          ma_ky_hieu: 'TD-01',
          nguyen_tac: 'Hạn chế đường bột',
          co_cau_khau_phan: null,
          luu_y: 'Uống nhiều nước',
        },
      ]);

      const result = await service.getAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].diseaseName).toBe('Tiểu đường');
      expect(result[0].code).toBe('TD-01');
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException if guide not found', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue(null);

      await expect(service.getById({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should return guide details if found', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        ten_benh: 'Tiểu đường',
        ma_ky_hieu: 'TD-01',
        nguyen_tac: 'Hạn chế đường',
        co_cau_khau_phan: null,
        luu_y: null,
      });

      const result = await service.getById({ id: 1 });
      expect(result.id).toBe(1);
      expect(result.diseaseName).toBe('Tiểu đường');
    });
  });

  describe('create', () => {
    it('should throw ConflictException if code already exists', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        ma_ky_hieu: 'TD-01',
      });

      await expect(
        service.create({
          dto: { code: 'TD-01', diseaseName: 'Tiểu đường' },
          userId: 'user-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create guide successfully', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue(null);
      mockPrisma.huong_dan_dinh_duong.create.mockResolvedValue({
        id: BigInt(1),
        ten_benh: 'Tiểu đường',
        ma_ky_hieu: 'TD-01',
        nguyen_tac: 'Nguyên tắc',
        co_cau_khau_phan: null,
        luu_y: null,
      });

      const result = await service.create({
        dto: { code: 'TD-01', diseaseName: 'Tiểu đường', nutritionPrinciple: 'Nguyên tắc' },
        userId: 'user-uuid-1',
      });

      expect(result.id).toBe(1);
      expect(result.code).toBe('TD-01');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if guide not found', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue(null);

      await expect(
        service.update({
          id: 999,
          dto: { diseaseName: 'Cập nhật' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update guide successfully', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue({
        id: BigInt(1),
        ma_ky_hieu: 'TD-01',
        ten_benh: 'Cũ',
      });
      mockPrisma.huong_dan_dinh_duong.update.mockResolvedValue({
        id: BigInt(1),
        ma_ky_hieu: 'TD-01',
        ten_benh: 'Mới',
        nguyen_tac: null,
        co_cau_khau_phan: null,
        luu_y: null,
      });

      const result = await service.update({
        id: 1,
        dto: { diseaseName: 'Mới' },
      });

      expect(result.diseaseName).toBe('Mới');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if guide not found', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue(null);

      await expect(service.delete({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should delete guide successfully', async () => {
      mockPrisma.huong_dan_dinh_duong.findUnique.mockResolvedValue({ id: BigInt(1) });
      mockPrisma.huong_dan_dinh_duong.delete.mockResolvedValue({ id: BigInt(1) });

      await expect(service.delete({ id: 1 })).resolves.toBeUndefined();
    });
  });
});
