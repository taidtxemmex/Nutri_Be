import { HttpException, HttpStatus } from '@nestjs/common';
import { CoefficientsService } from '../../src/modules/coefficients/services/coefficients.service';
import { UserRole } from '../../src/config/enums/role.enum';

describe('CoefficientsService', () => {
  let service: CoefficientsService;
  let mockPrisma: any;
  let mockCacheService: any;

  beforeEach(() => {
    mockPrisma = {
      nguyen_lieu: {
        findFirst: jest.fn(),
      },
      he_so_song_chin: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockCacheService = {
      debouncedInvalidateTags: jest.fn().mockResolvedValue(undefined),
    };

    service = new CoefficientsService(mockPrisma, mockCacheService);
  });

  describe('create', () => {
    it('should throw PROP_006 when ingredient is not found', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { ingredientId: 999, processingMethod: 'Luộc', coefficient: 0.8 },
          { id: 'user-1', role: UserRole.USER },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PROP_006' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('should throw COEF_002 if private coefficient already exists for user', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.he_so_song_chin.findFirst.mockResolvedValue({ id: BigInt(10) });

      await expect(
        service.create(
          { ingredientId: 1, processingMethod: 'Luộc', coefficient: 0.8 },
          { id: 'user-1', role: UserRole.USER },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COEF_002' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should throw COEF_003 if public coefficient already exists when Admin creates', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.he_so_song_chin.findFirst.mockResolvedValue({ id: BigInt(10), is_public: true });

      await expect(
        service.create(
          { ingredientId: 1, processingMethod: 'Luộc', coefficient: 0.8, isPublic: true },
          { id: 'admin-1', role: UserRole.ADMIN },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COEF_003' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should create public coefficient successfully by Admin', async () => {
      mockPrisma.nguyen_lieu.findFirst.mockResolvedValue({
        id: BigInt(1),
        ten_nguyen_lieu: 'Thịt bò',
      });
      mockPrisma.he_so_song_chin.findFirst.mockResolvedValue(null);
      mockPrisma.he_so_song_chin.create.mockResolvedValue({
        id: BigInt(100),
        nguyen_lieu_id: BigInt(1),
        phuong_phap_che_bien: 'Luộc',
        he_so: 0.85,
        is_public: true,
        nguoi_dung_id: null,
        nguyen_lieu: { ten_nguyen_lieu: 'Thịt bò' },
      });

      const res = await service.create(
        { ingredientId: 1, processingMethod: 'Luộc', coefficient: 0.85, isPublic: true },
        { id: 'admin-1', role: UserRole.ADMIN },
      );

      expect(res.id).toBe('100');
      expect(res.isPublic).toBe(true);
      expect(mockCacheService.debouncedInvalidateTags).toHaveBeenCalledWith(['coefficients']);
    });
  });

  describe('update & delete', () => {
    it('should throw COEF_001 if coefficient to update is not found', async () => {
      mockPrisma.he_so_song_chin.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { coefficient: 0.9 }, { id: 'user-1' })).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COEF_001' }),
        }),
      );
    });

    it('should block regular user from modifying public coefficient', async () => {
      mockPrisma.he_so_song_chin.findUnique.mockResolvedValue({
        id: BigInt(1),
        is_public: true,
        nguoi_dung_id: null,
      });

      await expect(
        service.update(1, { coefficient: 0.9 }, { id: 'user-1', role: UserRole.USER }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'AUTH_002' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('should throw COEF_004 if delete fails due to constraint/in-use', async () => {
      mockPrisma.he_so_song_chin.findUnique.mockResolvedValue({
        id: BigInt(1),
        is_public: false,
        nguoi_dung_id: 'user-1',
      });
      mockPrisma.he_so_song_chin.delete.mockRejectedValue(new Error('Foreign key violation'));

      await expect(service.delete(1, { id: 'user-1', role: UserRole.USER })).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COEF_004' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });
  });
});
