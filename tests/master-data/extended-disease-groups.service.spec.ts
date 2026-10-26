import { ExtendedDiseaseGroupsService } from '../../src/modules/extended-disease-groups/services/extended-disease-groups.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ExtendedDiseaseGroupsService', () => {
  let service: ExtendedDiseaseGroupsService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      nhom_benh: {
        findUnique: jest.fn(),
      },
      nhom_benh_mo_rong: {
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

    service = new ExtendedDiseaseGroupsService(mockPrisma, mockCache);
  });

  describe('findAll', () => {
    it('should scope queries to authenticated user id (IDOR safe)', async () => {
      mockPrisma.nhom_benh_mo_rong.count.mockResolvedValue(1);
      mockPrisma.nhom_benh_mo_rong.findMany.mockResolvedValue([
        {
          id: 1,
          ma_nhom_mo_rong: 'A-01',
          ten_hien_thi: 'Tăng huyết áp',
          nguoi_dung_id: 'user-123',
          ma_nhom_cha: 1,
          nhom_benh: { id: 1, ma_nhom: 'A', ten_nhom: 'Bệnh tim mạch' },
        },
      ]);

      const result = await service.findAll('user-123', { page: 1, limit: 10 });

      expect(mockPrisma.nhom_benh_mo_rong.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nguoi_dung_id: 'user-123' }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].extendedCode).toBe('A-01');
      expect(result.items[0].fullCode).toBe('A - A-01');
    });
  });

  describe('findById', () => {
    it('should throw DATA_001 if group belongs to another user', async () => {
      mockPrisma.nhom_benh_mo_rong.findFirst.mockResolvedValue(null);

      await expect(service.findById(1, 'attacker-user')).rejects.toThrow(NotFoundException);
    });

    it('should return group details if owned by user', async () => {
      mockPrisma.nhom_benh_mo_rong.findFirst.mockResolvedValue({
        id: 1,
        ma_nhom_mo_rong: 'A-01',
        ten_hien_thi: 'Tăng huyết áp',
        nguoi_dung_id: 'user-123',
        ma_nhom_cha: 1,
        nhom_benh: { id: 1, ma_nhom: 'A', ten_nhom: 'Bệnh tim mạch' },
      });

      const result = await service.findById(1, 'user-123');

      expect(result.id).toBe(1);
      expect(result.extendedCode).toBe('A-01');
    });
  });

  describe('delete', () => {
    it('should throw DATA_001 if not found or not owned', async () => {
      mockPrisma.nhom_benh_mo_rong.findFirst.mockResolvedValue(null);

      await expect(service.delete(999, 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw EDG_001 if group is in use by menus or menu proposals', async () => {
      mockPrisma.nhom_benh_mo_rong.findFirst.mockResolvedValue({
        id: 1,
        nguoi_dung_id: 'user-123',
        _count: {
          thuc_don: 2,
          de_xuat_thuc_don: 0,
        },
      });

      await expect(service.delete(1, 'user-123')).rejects.toThrow(ConflictException);
    });

    it('should delete group when not in use', async () => {
      mockPrisma.nhom_benh_mo_rong.findFirst.mockResolvedValue({
        id: 1,
        nguoi_dung_id: 'user-123',
        _count: {
          thuc_don: 0,
          de_xuat_thuc_don: 0,
        },
      });
      mockPrisma.nhom_benh_mo_rong.delete.mockResolvedValue({ id: 1 });

      const result = await service.delete(1, 'user-123');

      expect(result.success).toBe(true);
      expect(mockCache.debouncedInvalidateTags).toHaveBeenCalledWith(['extended_disease_groups']);
    });
  });
});
