import { AccountDowngradeCronService } from '../../src/core/cron/account-downgrade-cron.service';
import { UserRole } from '../../src/config/enums/role.enum';
import { CACHE_TAG_USERS, buildUserCacheTag } from '../../src/config/constants/cache.constants';

describe('AccountDowngradeCronService Tests (Task 7.4)', () => {
  let cronService: AccountDowngradeCronService;
  let mockPrisma: any;
  let mockCacheService: any;

  // In-Memory simulated DB tables
  let usersTable: any[] = [];
  let dangKyTable: any[] = [];
  let maXacThucTable: any[] = [];
  let dangKyChoXacThucTable: any[] = [];

  beforeEach(() => {
    usersTable = [];
    dangKyTable = [];
    maXacThucTable = [];
    dangKyChoXacThucTable = [];

    mockPrisma = {
      nguoi_dung: {
        findMany: jest.fn(async ({ where }: any) => {
          let rows = [...usersTable];
          if (where.vai_tro) {
            rows = rows.filter((u) => u.vai_tro === where.vai_tro);
          }
          if (where.pro_expired_at?.lt) {
            rows = rows.filter((u) => u.pro_expired_at && u.pro_expired_at < where.pro_expired_at.lt);
          }
          if (where.deleted_at === null) {
            rows = rows.filter((u) => u.deleted_at === null);
          }
          return rows.map((u) => ({ id: u.id }));
        }),

        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          const userIds = where.id.in;
          for (const user of usersTable) {
            if (userIds.includes(user.id) && user.vai_tro === where.vai_tro) {
              Object.assign(user, data);
              count++;
            }
          }
          return { count };
        }),
      },

      dang_ky: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const dk of dangKyTable) {
            let matches = false;
            if (where.OR) {
              for (const condition of where.OR) {
                if (condition.nguoi_dung_id?.in && condition.nguoi_dung_id.in.includes(dk.nguoi_dung_id)) {
                  if (condition.trang_thai?.not && dk.trang_thai !== condition.trang_thai.not) {
                    matches = true;
                  }
                }
                if (condition.ngay_ket_thuc?.lt && dk.ngay_ket_thuc < condition.ngay_ket_thuc.lt) {
                  if (condition.trang_thai?.not && dk.trang_thai !== condition.trang_thai.not) {
                    matches = true;
                  }
                }
              }
            }
            if (matches) {
              Object.assign(dk, data);
              count++;
            }
          }
          return { count };
        }),
      },

      ma_xac_thuc: {
        deleteMany: jest.fn(async ({ where }: any) => {
          const beforeLen = maXacThucTable.length;
          maXacThucTable = maXacThucTable.filter((m) => !(m.ngay_het_han < where.ngay_het_han.lt));
          return { count: beforeLen - maXacThucTable.length };
        }),
      },

      dang_ky_cho_xac_thuc: {
        deleteMany: jest.fn(async ({ where }: any) => {
          const beforeLen = dangKyChoXacThucTable.length;
          dangKyChoXacThucTable = dangKyChoXacThucTable.filter((d) => !(d.expires_at < where.expires_at.lt));
          return { count: beforeLen - dangKyChoXacThucTable.length };
        }),
      },
    };

    mockCacheService = {
      invalidateTags: jest.fn().mockResolvedValue(undefined),
    };

    cronService = new AccountDowngradeCronService(mockPrisma, mockCacheService);
  });

  describe('downgradeExpiredAccounts', () => {
    it('should find expired USERPRO accounts, downgrade to USER, update dang_ky to HET_HAN, and invalidate cache', async () => {
      const now = new Date();
      const pastDate1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const pastDate2 = new Date(now.getTime() - 5 * 60 * 1000);            // 5 minutes ago
      const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days ahead

      // User 1: USERPRO - Expired
      usersTable.push({
        id: 'user-pro-expired-1',
        ten_dang_nhap: 'expired1',
        vai_tro: UserRole.USERPRO,
        pro_expired_at: pastDate1,
        deleted_at: null,
      });

      // User 2: USERPRO - Expired
      usersTable.push({
        id: 'user-pro-expired-2',
        ten_dang_nhap: 'expired2',
        vai_tro: UserRole.USERPRO,
        pro_expired_at: pastDate2,
        deleted_at: null,
      });

      // User 3: USERPRO - Still Active
      usersTable.push({
        id: 'user-pro-active-3',
        ten_dang_nhap: 'active3',
        vai_tro: UserRole.USERPRO,
        pro_expired_at: futureDate,
        deleted_at: null,
      });

      // User 4: Normal USER
      usersTable.push({
        id: 'user-normal-4',
        ten_dang_nhap: 'normal4',
        vai_tro: UserRole.USER,
        pro_expired_at: null,
        deleted_at: null,
      });

      // Dang_ky records
      dangKyTable.push({
        id: 1n,
        nguoi_dung_id: 'user-pro-expired-1',
        trang_thai: 'DANG_HOAT_DONG',
        ngay_ket_thuc: pastDate1,
      });
      dangKyTable.push({
        id: 2n,
        nguoi_dung_id: 'user-pro-active-3',
        trang_thai: 'DANG_HOAT_DONG',
        ngay_ket_thuc: futureDate,
      });

      // Execute downgrade
      const result = await cronService.downgradeExpiredAccounts(now);

      // Assert results
      expect(result.downgradedCount).toBe(2);
      expect(result.downgradedUserIds).toEqual(['user-pro-expired-1', 'user-pro-expired-2']);

      // Layer 3 Database State Assertions:
      const u1 = usersTable.find((u) => u.id === 'user-pro-expired-1');
      expect(u1.vai_tro).toBe(UserRole.USER);

      const u2 = usersTable.find((u) => u.id === 'user-pro-expired-2');
      expect(u2.vai_tro).toBe(UserRole.USER);

      const u3 = usersTable.find((u) => u.id === 'user-pro-active-3');
      expect(u3.vai_tro).toBe(UserRole.USERPRO); // Still active!

      // Dang_ky assertion
      const dk1 = dangKyTable.find((d) => d.nguoi_dung_id === 'user-pro-expired-1');
      expect(dk1.trang_thai).toBe('HET_HAN');

      const dk2 = dangKyTable.find((d) => d.nguoi_dung_id === 'user-pro-active-3');
      expect(dk2.trang_thai).toBe('DANG_HOAT_DONG');

      // Cache Invalidation assertion
      expect(mockCacheService.invalidateTags).toHaveBeenCalledWith([
        CACHE_TAG_USERS,
        buildUserCacheTag('user-pro-expired-1'),
        buildUserCacheTag('user-pro-expired-2'),
      ]);
    });

    it('should return 0 when no accounts are expired', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      usersTable.push({
        id: 'user-pro-active',
        vai_tro: UserRole.USERPRO,
        pro_expired_at: futureDate,
        deleted_at: null,
      });

      const result = await cronService.downgradeExpiredAccounts(now);
      expect(result.downgradedCount).toBe(0);
      expect(result.downgradedUserIds).toEqual([]);
      expect(mockCacheService.invalidateTags).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens in ma_xac_thuc and dang_ky_cho_xac_thuc', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600 * 1000);
      const future = new Date(now.getTime() + 3600 * 1000);

      maXacThucTable.push(
        { id: 1n, ma_token: 'token-expired', ngay_het_han: past },
        { id: 2n, ma_token: 'token-valid', ngay_het_han: future },
      );

      dangKyChoXacThucTable.push(
        { id: 1n, email: 'exp@gmail.com', expires_at: past },
        { id: 2n, email: 'valid@gmail.com', expires_at: future },
      );

      const result = await cronService.cleanupExpiredTokens(now);

      expect(result.deletedAuthTokens).toBe(1);
      expect(result.deletedPendingRegistrations).toBe(1);

      expect(maXacThucTable.length).toBe(1);
      expect(maXacThucTable[0].ma_token).toBe('token-valid');

      expect(dangKyChoXacThucTable.length).toBe(1);
      expect(dangKyChoXacThucTable[0].email).toBe('valid@gmail.com');
    });
  });

  describe('Cron handler triggers', () => {
    it('should run handleAccountDowngradeCron without error', async () => {
      await expect(cronService.handleAccountDowngradeCron()).resolves.not.toThrow();
    });

    it('should run handleCleanupTokensCron without error', async () => {
      await expect(cronService.handleCleanupTokensCron()).resolves.not.toThrow();
    });
  });
});
