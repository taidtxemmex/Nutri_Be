import { ProfilesService } from '../../src/modules/profiles/services/profiles.service';

describe('ProfilesService', () => {
  let profilesService: ProfilesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'uuid-1',
            ten_dang_nhap: 'bs_minhtri',
            vai_tro: 'USER',
            active: true,
            keycloak_user_id: 'uuid-1',
            ho_so_ca_nhan: {
              ho_ten: 'Nguyễn Minh Trí',
              email: 'bsminhtri@gmail.com',
              phone: '0987654321',
              ngay_sinh: new Date('1990-05-15'),
            },
          },
        ]),
      },
      ho_so_ca_nhan: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    profilesService = new ProfilesService(mockPrisma);
  });

  describe('getAllProfiles (UserTable.jsx compatibility)', () => {
    it('should return { items: [...] } structure matching UserTable.jsx contract', async () => {
      const result = await profilesService.getAllProfiles({ page: 0, size: 20 });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'uuid-1',
        keycloakUserId: 'uuid-1',
        fullName: 'Nguyễn Minh Trí',
        email: 'bsminhtri@gmail.com',
        phone: '0987654321',
        dob: '1990-05-15',
        role: 'USER',
        active: true,
      });
    });
  });

  describe('getMyProfile & updateMyProfile', () => {
    it('should retrieve my profile with explicit fields', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'uuid-1',
        ten_dang_nhap: 'bs_minhtri',
        vai_tro: 'USER',
        active: true,
        keycloak_user_id: 'uuid-1',
        created_at: new Date('2026-01-01'),
        ho_so_ca_nhan: {
          ho_ten: 'Nguyễn Minh Trí',
          email: 'bsminhtri@gmail.com',
          phone: '0987654321',
          dia_chi: 'Hà Nội',
          gioi_tinh: 'NAM',
          ngay_sinh: new Date('1990-05-15'),
        },
      });

      const result = await profilesService.getMyProfile('uuid-1');

      expect(result.fullName).toBe('Nguyễn Minh Trí');
      expect(result.username).toBe('bs_minhtri');
      expect(result.email).toBe('bsminhtri@gmail.com');
    });

    it('should update profile using upsert', async () => {
      const result = await profilesService.updateMyProfile('uuid-1', {
        fullName: 'Nguyễn Minh Trí Updated',
        phone: '0911223344',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.ho_so_ca_nhan.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nguoi_dung_id: 'uuid-1' },
        }),
      );
    });
  });
});
