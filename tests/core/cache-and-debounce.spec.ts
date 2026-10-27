import { CacheService } from '../../src/core/cache/cache.service';
import { UsersService } from '../../src/modules/users/services/users.service';
import { ProfilesService } from '../../src/modules/profiles/services/profiles.service';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { IdorDefenseService } from '../../src/security/idor/idor-defense.service';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  CACHE_TAG_CATEGORIES,
  CACHE_TTL_PERPETUAL,
  buildUserCacheTag,
  buildUserAuthCacheKey,
  buildUserDetailCacheKey,
  buildCategoryCacheTag,
  buildCategoryDetailCacheKey,
} from '../../src/config/constants/cache.constants';

describe('Intelligent Cache, Query Normalization & Debounced Mutation Invalidation', () => {
  let cacheService: CacheService;
  let usersService: UsersService;
  let profilesService: ProfilesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      systemCache: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({}),
      },
      nguoi_dung: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'uuid-cached-user',
            ten_dang_nhap: 'bs_minhtri',
            vai_tro: 'USER',
            active: true,
            keycloak_user_id: 'uuid-cached-user',
            created_at: new Date('2026-01-01'),
            ho_so_ca_nhan: {
              ho_ten: 'Bác sĩ Minh Trí',
              email: 'bsminhtri@gmail.com',
              phone: '0987654321',
              dia_chi: 'Hà Nội',
              gioi_tinh: 'NAM',
              ngay_sinh: new Date('1990-05-15'),
            },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'uuid-cached-user',
          ten_dang_nhap: 'bs_minhtri',
          vai_tro: 'USER',
          active: true,
          keycloak_user_id: 'uuid-cached-user',
          created_at: new Date('2026-01-01'),
          ho_so_ca_nhan: {
            ho_ten: 'Bác sĩ Minh Trí',
            email: 'bsminhtri@gmail.com',
            phone: '0987654321',
            dia_chi: 'Hà Nội',
            gioi_tinh: 'NAM',
            ngay_sinh: new Date('1990-05-15'),
          },
          nguoi_de_xuat: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'uuid-cached-user' }),
      },
      ho_so_ca_nhan: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
      nguoi_de_xuat: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    cacheService = new CacheService(mockPrisma);
    usersService = new UsersService(mockPrisma, new IdorDefenseService(), cacheService);
    profilesService = new ProfilesService(mockPrisma, cacheService);
  });

  afterEach(() => {
    cacheService.onModuleDestroy();
  });

  describe('Query Param Normalization (Rule 23)', () => {
    it('should generate the exact same cache key when query parameters are in different order', () => {
      const key1 = cacheService.generateKey('users:list', {
        page: 1,
        limit: 10,
        search: 'minh',
        role: UserRole.USER,
      });

      const key2 = cacheService.generateKey('users:list', {
        role: UserRole.USER,
        search: 'minh',
        limit: 10,
        page: 1,
      });

      expect(key1).toBe(key2);
    });

    it('should strip tracking/junk query params (utm_*, _ga, timestamp, etc.)', () => {
      const keyClean = cacheService.generateKey('users:list', {
        page: 1,
        search: 'minh',
      });

      const keyWithTracking = cacheService.generateKey('users:list', {
        page: 1,
        search: 'minh',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        _ga: 'GA1.2.3.4',
        timestamp: '1772449000',
        random: '99999',
      });

      expect(keyWithTracking).toBe(keyClean);
    });
  });

  describe('List Caching & Cache Hit on Consecutive Calls', () => {
    it('should call DB on first GET list, and return cached result on second call (Cache Hit)', async () => {
      // First call -> Cache Miss -> Queries DB
      const result1 = await usersService.findAll({ page: 1, limit: 10, search: 'minh' });
      expect(result1.items).toHaveLength(1);
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);

      // Second call with same parameters -> Cache Hit -> Skips DB
      const result2 = await usersService.findAll({ page: 1, limit: 10, search: 'minh' });
      expect(result2.items).toHaveLength(1);
      expect(result2.items[0].username).toBe('bs_minhtri');
      // findMany count remains 1!
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);
    });

    it('should hit cache even if query parameters are sent in reverse order', async () => {
      await usersService.findAll({ page: 1, limit: 10, search: 'minh', role: UserRole.USER });
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);

      // Reverse order of parameters
      await usersService.findAll({ role: UserRole.USER, search: 'minh', limit: 10, page: 1 });
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('Detail Caching (users:detail, users:info, profiles:my)', () => {
    it('should cache user detail and return from cache on subsequent calls', async () => {
      const user = await usersService.findById('uuid-cached-user');
      expect(user.ten_dang_nhap).toBe('bs_minhtri');
      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledTimes(1);

      // Subsequent call hits cache
      const cachedUser = await usersService.findById('uuid-cached-user');
      expect(cachedUser.ten_dang_nhap).toBe('bs_minhtri');
      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should cache my-profile in ProfilesService', async () => {
      const p1 = await profilesService.getMyProfile('uuid-cached-user');
      expect(p1.fullName).toBe('Bác sĩ Minh Trí');
      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledTimes(1);

      const p2 = await profilesService.getMyProfile('uuid-cached-user');
      expect(p2.fullName).toBe('Bác sĩ Minh Trí');
      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('Debounced Mutation Invalidation (Rule 25)', () => {
    const adminUser = {
      id: 'admin-uuid',
      sub: 'admin-uuid',
      username: 'admin',
      role: UserRole.ADMIN,
    };

    it('should immediately clear In-Memory cache upon mutation so next GET sees fresh data', async () => {
      // 1. Warm up cache
      await usersService.findAll({ page: 1, limit: 10 });
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);

      // 2. Perform a mutation (e.g. admin updates user role)
      await usersService.updateRole('uuid-cached-user', UserRole.USERPRO, adminUser);

      // 3. Immediately query list again -> In-Memory was cleared -> Cache Miss -> Fetches DB again!
      await usersService.findAll({ page: 1, limit: 10 });
      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(2);
    });

    it('should coalesce 10 rapid CRUD mutations into a single debounced DB delete batch', async () => {
      jest.useFakeTimers();

      // Trigger 10 rapid mutations within 200ms
      for (let i = 0; i < 10; i++) {
        await cacheService.debouncedInvalidateTags([
          CACHE_TAG_USERS,
          CACHE_TAG_PROFILES,
          buildUserCacheTag(`user-${i}`),
        ]);
      }

      // During debounce window, Prisma deleteMany has NOT been executed yet
      expect(mockPrisma.systemCache.deleteMany).toHaveBeenCalledTimes(0);
      expect(cacheService.getPendingTagsCount()).toBeGreaterThan(0);

      // Fast-forward past the 500ms debounce window
      jest.advanceTimersByTime(600);

      // Single coalesced deleteMany batch call executed!
      expect(mockPrisma.systemCache.deleteMany).toHaveBeenCalledTimes(1);
      expect(cacheService.getPendingTagsCount()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Perpetual Cache & Multi-Tags Identity Map (Rule 23)', () => {
    it('should store perpetual cache with ttl=0 and multiple tags, and invalidate on any tag', async () => {
      const categoryId = 42;
      const cacheKey = buildCategoryDetailCacheKey(categoryId);
      const tags = [CACHE_TAG_CATEGORIES, buildCategoryCacheTag(categoryId)];

      await cacheService.set(cacheKey, { id: categoryId, name: 'Sữa chua' }, CACHE_TTL_PERPETUAL, tags);

      // Verify in-memory hit
      const hit = await cacheService.get(cacheKey);
      expect(hit).toEqual({ id: categoryId, name: 'Sữa chua' });

      // Verify Prisma upsert called with year 2099
      expect(mockPrisma.systemCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            key: cacheKey,
            tag: CACHE_TAG_CATEGORIES,
            expiresAt: expect.any(Date),
          }),
        }),
      );

      // Invalidate by specific detail tag: category:42
      await cacheService.invalidateTags([buildCategoryCacheTag(categoryId)]);

      // Now cache should be cleared
      const missed = await cacheService.get(cacheKey);
      expect(missed).toBeNull();
    });
  });

  describe('Timestamp Versioning Fence & Anti-Poisoning Race Condition (Rule 25)', () => {
    it('should refuse to write stale query result if mutation invalidated tag during async DB query', async () => {
      const userId = 'uuid-race-user';
      const cacheKey = buildUserDetailCacheKey(userId);
      const tags = [CACHE_TAG_USERS, buildUserCacheTag(userId)];

      // 1. Reader starts DB query at t = 1000
      const queryStartTime = 1000;

      // 2. Writer mutates at t = 1500 and invalidates tag
      jest.spyOn(Date, 'now').mockReturnValue(1500);
      await cacheService.debouncedInvalidateTags(tags);
      expect(cacheService.getTagVersion(buildUserCacheTag(userId))).toBe(1500);

      // 3. Reader's slow DB query returns stale data at t = 2000, tries to write to cache with queryStartTime = 1000
      jest.spyOn(Date, 'now').mockReturnValue(2000);
      await cacheService.set(
        cacheKey,
        { id: userId, username: 'old_stale_name' },
        CACHE_TTL_PERPETUAL,
        tags,
        queryStartTime,
      );

      // 4. Cache must NOT be poisoned! Invalidation Fence refused the stale write.
      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();

      (Date.now as any).mockRestore?.();
    });

    it('should purge stale cache entry in get() if tag was invalidated after entry createdAt', async () => {
      const tag = 'test-tag';
      const key = 'test:fence:key';

      // Entry created at t = 1000
      jest.spyOn(Date, 'now').mockReturnValue(1000);
      await cacheService.set(key, { data: 'initial' }, CACHE_TTL_PERPETUAL, [tag], 1000);
      expect(await cacheService.get(key)).toEqual({ data: 'initial' });

      // Invalidate tag at t = 2000
      jest.spyOn(Date, 'now').mockReturnValue(2000);
      await cacheService.debouncedInvalidateTags([tag]);

      // Manually set memory entry with older createdAt to test fence check in get()
      (cacheService as any).memoryStore.set(key, {
        value: { data: 'stale' },
        expiresAt: 0,
        createdAt: 1000,
        tag,
        tags: [tag],
      });

      // get() should detect tagVersion (2000) > createdAt (1000) and purge it
      const result = await cacheService.get(key);
      expect(result).toBeNull();
      expect((cacheService as any).memoryStore.get(key)).toBeUndefined();

      (Date.now as any).mockRestore?.();
    });
  });

  describe('Shared Entity Cache / Identity Map in JwtStrategy (Rule 23)', () => {
    it('should reuse cached user detail from buildUserDetailCacheKey without querying DB', async () => {
      const configService = {
        get: jest.fn().mockReturnValue('test-jwt-secret-key-1234567890'),
      } as unknown as ConfigService;

      const jwtStrategy = new JwtStrategy(configService, mockPrisma, cacheService);

      const userId = 'uuid-shared-entity-user';
      // Pre-warm the user detail cache (e.g. from /users/me or profile lookup)
      await cacheService.set(
        buildUserDetailCacheKey(userId),
        {
          id: userId,
          ten_dang_nhap: 'doctor_lan',
          vai_tro: 'DOCTOR',
          active: true,
        },
        CACHE_TTL_PERPETUAL,
        [CACHE_TAG_USERS, buildUserCacheTag(userId)],
      );

      // Validate JWT payload
      const user = await jwtStrategy.validate({
        sub: userId,
        username: 'doctor_lan',
        role: 'DOCTOR',
      });

      expect(user).toEqual({
        id: userId,
        sub: userId,
        username: 'doctor_lan',
        role: 'DOCTOR',
        keycloakUserId: undefined,
      });

      // Database findUnique was NOT called because shared detail cache was reused!
      expect(mockPrisma.nguoi_dung.findUnique).not.toHaveBeenCalled();
    });

    it('should fallback to DB and store auth cache with perpetual TTL when detail cache is absent', async () => {
      const configService = {
        get: jest.fn().mockReturnValue('test-jwt-secret-key-1234567890'),
      } as unknown as ConfigService;

      mockPrisma.nguoi_dung.findUnique.mockResolvedValueOnce({
        id: 'uuid-no-detail-user',
        ten_dang_nhap: 'bs_mai',
        vai_tro: 'USER',
        active: true,
      });

      const jwtStrategy = new JwtStrategy(configService, mockPrisma, cacheService);

      const userId = 'uuid-no-detail-user';
      const user = await jwtStrategy.validate({
        sub: userId,
        username: 'bs_mai',
        role: 'USER',
      });

      expect(user.id).toBe(userId);
      expect(user.role).toBe('USER');
      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledTimes(1);

      // Subsequent call should hit the auth cache
      const cachedAuth = await cacheService.get(buildUserAuthCacheKey(userId));
      expect(cachedAuth).toEqual({
        id: userId,
        ten_dang_nhap: 'bs_mai',
        vai_tro: 'USER',
        active: true,
      });
    });
  });
});
