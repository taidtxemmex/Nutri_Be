import { CategoriesService } from '../../src/modules/categories/services/categories.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      danh_muc: {
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

    service = new CategoriesService(mockPrisma, mockCache);
  });

  describe('findAll', () => {
    it('should return paginated categories result with explicit field projection', async () => {
      mockPrisma.danh_muc.count.mockResolvedValue(1);
      mockPrisma.danh_muc.findMany.mockResolvedValue([{ id: 1, ten_danh_muc: 'Thịt' }]);

      const result = await service.findAll({ query: { page: 1, limit: 20 } });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 1,
        categoryName: 'Thịt',
        tenDanhMuc: 'Thịt',
      });
      expect(result.total).toBe(1);
    });
  });

  describe('getPublicLookup', () => {
    it('should return categories list for dropdowns', async () => {
      mockPrisma.danh_muc.findMany.mockResolvedValue([
        { id: 1, ten_danh_muc: 'Thịt' },
        { id: 2, ten_danh_muc: 'Cá' },
      ]);

      const result = await service.getPublicLookup();

      expect(result).toHaveLength(2);
      expect(result[0].categoryName).toBe('Thịt');
      expect(result[1].categoryName).toBe('Cá');
    });
  });

  describe('create', () => {
    it('should throw CAT_001 if categoryName is duplicate', async () => {
      mockPrisma.danh_muc.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.create({ dto: { categoryName: 'Thịt' } as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create new category and invalidate cache', async () => {
      mockPrisma.danh_muc.findFirst.mockResolvedValue(null);
      mockPrisma.danh_muc.create.mockResolvedValue({ id: 3, ten_danh_muc: 'Rau củ' });

      const result = await service.create({ dto: { categoryName: 'Rau củ' } as any });

      expect(result.id).toBe(3);
      expect(result.categoryName).toBe('Rau củ');
      expect(mockCache.debouncedInvalidateTags).toHaveBeenCalledWith(['categories', 'category:3']);
    });
  });

  describe('update', () => {
    it('should throw PROP_007 if category not found', async () => {
      mockPrisma.danh_muc.findUnique.mockResolvedValue(null);

      await expect(
        service.update({ id: 999, dto: { categoryName: 'Mới' } as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw CAT_001 if name is duplicated on other category', async () => {
      mockPrisma.danh_muc.findUnique.mockResolvedValue({ id: 1, ten_danh_muc: 'Thịt' });
      mockPrisma.danh_muc.findFirst.mockResolvedValue({ id: 2, ten_danh_muc: 'Cá' });

      await expect(service.update({ id: 1, dto: { categoryName: 'Cá' } as any })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should throw PROP_007 if category not found', async () => {
      mockPrisma.danh_muc.findUnique.mockResolvedValue(null);

      await expect(service.delete({ id: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should throw CAT_002 if category is in use by ingredients or proposals', async () => {
      mockPrisma.danh_muc.findUnique.mockResolvedValue({
        id: 1,
        _count: {
          nguyen_lieu_nguyen_lieu_danh_mucTodanh_muc: 5,
          de_xuat_nguyen_lieu_de_xuat_nguyen_lieu_danh_mucTodanh_muc: 0,
        },
      });

      await expect(service.delete({ id: 1 })).rejects.toThrow(ConflictException);
    });

    it('should successfully delete category if count is 0', async () => {
      mockPrisma.danh_muc.findUnique.mockResolvedValue({
        id: 1,
        _count: {
          nguyen_lieu_nguyen_lieu_danh_mucTodanh_muc: 0,
          de_xuat_nguyen_lieu_de_xuat_nguyen_lieu_danh_mucTodanh_muc: 0,
        },
      });
      mockPrisma.danh_muc.delete.mockResolvedValue({ id: 1 });

      const result = await service.delete({ id: 1 });

      expect(result.success).toBe(true);
      expect(mockCache.debouncedInvalidateTags).toHaveBeenCalledWith(['categories', 'category:1']);
    });
  });
});
