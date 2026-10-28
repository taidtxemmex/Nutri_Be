import { ProposersService } from '../../src/modules/proposers/services/proposers.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProposersService', () => {
  let service: ProposersService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      nguoi_de_xuat: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
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

    service = new ProposersService(mockPrisma, mockCache);
  });

  describe('getMe', () => {
    it('should throw PROPOSER_001 if profile does not exist', async () => {
      mockPrisma.nguoi_de_xuat.findUnique.mockResolvedValue(null);

      await expect(service.getMe({ userId: 'user-123' })).rejects.toThrow(NotFoundException);
    });

    it('should return proposer profile of current user', async () => {
      mockPrisma.nguoi_de_xuat.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'user-123',
        trinh_do_hoc_van: 'Thạc sĩ Dinh dưỡng',
        nghe_nghiep: 'Bác sĩ Dinh dưỡng',
        don_vi_cong_tac: 'BV Bạch Mai',
        vi_tri_cong_tac: 'Trưởng khoa',
        linh_vuc_cong_tac: 'Lâm sàng',
      });

      const result = await service.getMe({ userId: 'user-123' });

      expect(result.id).toBe(1);
      expect(result.userId).toBe('user-123');
      expect(result.education).toBe('Thạc sĩ Dinh dưỡng');
    });
  });

  describe('update (IDOR protection)', () => {
    it('should throw FORBIDDEN_RESOURCE if non-admin tries to update another user profile', async () => {
      mockPrisma.nguoi_de_xuat.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'victim-user',
      });

      await expect(
        service.update({
          id: 1,
          userId: 'attacker-user',
          isAdmin: false,
          dto: { education: 'Hacker' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update their own profile', async () => {
      mockPrisma.nguoi_de_xuat.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'owner-user',
      });
      mockPrisma.nguoi_de_xuat.update.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'owner-user',
        trinh_do_hoc_van: 'Tiến sĩ',
        nghe_nghiep: 'Bác sĩ',
        don_vi_cong_tac: 'BV 108',
        vi_tri_cong_tac: 'Phó khoa',
        linh_vuc_cong_tac: 'Dinh dưỡng',
      });

      const result = await service.update({
        id: 1,
        userId: 'owner-user',
        isAdmin: false,
        dto: { education: 'Tiến sĩ' },
      });

      expect(result.education).toBe('Tiến sĩ');
    });

    it('should allow admin to update any profile', async () => {
      mockPrisma.nguoi_de_xuat.findUnique.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'any-user',
      });
      mockPrisma.nguoi_de_xuat.update.mockResolvedValue({
        id: BigInt(1),
        nguoi_dung_id: 'any-user',
        trinh_do_hoc_van: 'Admin Update',
        nghe_nghiep: 'Bác sĩ',
        don_vi_cong_tac: 'BV 108',
        vi_tri_cong_tac: 'Phó khoa',
        linh_vuc_cong_tac: 'Dinh dưỡng',
      });

      const result = await service.update({
        id: 1,
        userId: 'admin-user',
        isAdmin: true,
        dto: { education: 'Admin Update' },
      });

      expect(result.education).toBe('Admin Update');
    });
  });
});
