import { DiseaseGroupsService } from '../../src/modules/disease-groups/services/disease-groups.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DiseaseGroupsService', () => {
  let service: DiseaseGroupsService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      nhom_benh: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockCache = {
      generateKey: jest.fn().mockReturnValue('cache:test'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      debouncedInvalidateTags: jest.fn().mockResolvedValue(undefined),
    };

    service = new DiseaseGroupsService(mockPrisma, mockCache);
  });

  describe('findAll', () => {
    it('should return paginated list of disease groups', async () => {
      mockPrisma.nhom_benh.count.mockResolvedValue(1);
      mockPrisma.nhom_benh.findMany.mockResolvedValue([
        { id: 1, ma_nhom: 'A', ten_nhom: 'Bệnh tim mạch' },
      ]);

      const result = await service.findAll({ query: { page: 1, limit: 10 } });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].code).toBe('A');
      expect(result.items[0].name).toBe('Bệnh tim mạch');
    });
  });

  describe('findById', () => {
    it('should throw DG_001 if disease group not found', async () => {
      mockPrisma.nhom_benh.findUnique.mockResolvedValue(null);

      await expect(service.findById({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should return disease group details if found', async () => {
      mockPrisma.nhom_benh.findUnique.mockResolvedValue({
        id: 1,
        ma_nhom: 'A',
        ten_nhom: 'Bệnh tim mạch',
      });

      const result = await service.findById({ id: 1 });

      expect(result.id).toBe(1);
      expect(result.code).toBe('A');
    });
  });

  describe('delete', () => {
    it('should throw DG_001 if disease group not found', async () => {
      mockPrisma.nhom_benh.findUnique.mockResolvedValue(null);

      await expect(service.delete({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should throw DG_002 if disease group has child extended groups', async () => {
      mockPrisma.nhom_benh.findUnique.mockResolvedValue({
        id: 1,
        _count: {
          nhom_benh_mo_rong: 3,
        },
      });

      await expect(service.delete({ id: 1 })).rejects.toThrow(ConflictException);
    });

    it('should successfully delete if no child groups attached', async () => {
      mockPrisma.nhom_benh.findUnique.mockResolvedValue({
        id: 1,
        _count: {
          nhom_benh_mo_rong: 0,
        },
      });
      mockPrisma.nhom_benh.delete.mockResolvedValue({ id: 1 });

      const result = await service.delete({ id: 1 });

      expect(result.success).toBe(true);
      expect(mockCache.debouncedInvalidateTags).toHaveBeenCalledWith([
        'disease_groups',
        'disease_group:1',
      ]);
    });
  });
});
