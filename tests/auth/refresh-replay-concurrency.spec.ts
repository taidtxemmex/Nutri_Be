import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenRotationService } from '../../src/security/token/refresh-token-rotation.service';
import { AUTH_ERROR_REPLAY_ATTACK } from '../../src/config/constants/auth.constants';

describe('Refresh Token Rotation Concurrency & Replay Attack Defense', () => {
  let service: RefreshTokenRotationService;
  let mockPrisma: any;
  let fakeDatabaseCache: Map<string, any>;

  beforeEach(() => {
    fakeDatabaseCache = new Map();

    mockPrisma = {
      systemCache: {
        findUnique: jest.fn(async ({ where }) => {
          const val = fakeDatabaseCache.get(where.key);
          return val ? { key: where.key, value: JSON.stringify(val), expiresAt: new Date(val.expiresAt) } : null;
        }),
        upsert: jest.fn(async ({ create, update, where }) => {
          const data = JSON.parse(create?.value || update?.value);
          fakeDatabaseCache.set(where.key, data);
          return { key: where.key, value: JSON.stringify(data) };
        }),
        update: jest.fn(async ({ where, data }) => {
          const existing = fakeDatabaseCache.get(where.key) || {};
          const parsed = JSON.parse(data.value);
          const merged = { ...existing, ...parsed };
          fakeDatabaseCache.set(where.key, merged);
          return { key: where.key, value: JSON.stringify(merged) };
        }),
        findMany: jest.fn(async ({ where }) => {
          const items = [];
          for (const [k, v] of fakeDatabaseCache.entries()) {
            if (v.userId && where.tag.includes(v.userId)) {
              items.push({ key: k, value: JSON.stringify(v) });
            }
          }
          return items;
        }),
        delete: jest.fn(async ({ where }) => {
          fakeDatabaseCache.delete(where.key);
        }),
      },
    };

    service = new RefreshTokenRotationService(mockPrisma);
  });

  it('should successfully rotate a fresh token and issue a new one', async () => {
    const userId = 'user-test-concurrency-1';
    const originalToken = service.generateTokenString();

    await service.storeRefreshToken(userId, originalToken);

    const rotationResult = await service.validateAndRotateRefreshToken(originalToken);

    expect(rotationResult.newRefreshToken).toBeDefined();
    expect(rotationResult.newRefreshToken).not.toBe(originalToken);
    expect(rotationResult.userId).toBe(userId);
  });

  it('should detect replay attack when the old token is re-submitted after rotation', async () => {
    const userId = 'user-victim-replay';
    const originalToken = service.generateTokenString();

    await service.storeRefreshToken(userId, originalToken);

    // 1. First legitimate rotation
    const firstRotation = await service.validateAndRotateRefreshToken(originalToken);
    expect(firstRotation.newRefreshToken).toBeDefined();

    // 2. Attacker replays the original token
    await expect(service.validateAndRotateRefreshToken(originalToken)).rejects.toThrow(
      UnauthorizedException,
    );

    try {
      await service.validateAndRotateRefreshToken(originalToken);
    } catch (err: any) {
      expect(err.getResponse()?.code).toBe(AUTH_ERROR_REPLAY_ATTACK);
    }

    // 3. Since family is revoked, the new token issued in step 1 is ALSO invalidated!
    await expect(
      service.validateAndRotateRefreshToken(firstRotation.newRefreshToken),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should handle sequential concurrent rotation attempts (simulated race condition)', async () => {
    const userId = 'user-race-condition';
    const token = service.generateTokenString();
    await service.storeRefreshToken(userId, token);

    // Call rotation sequentially simulating 2 requests arriving almost at the same time
    const res1 = await service.validateAndRotateRefreshToken(token);
    expect(res1.newRefreshToken).toBeDefined();

    // Second call with same token MUST fail as replay attack
    let errorCaught: any;
    try {
      await service.validateAndRotateRefreshToken(token);
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught).toBeInstanceOf(UnauthorizedException);
    expect(errorCaught.getResponse()?.code).toBe(AUTH_ERROR_REPLAY_ATTACK);
  });
});
