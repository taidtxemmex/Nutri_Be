import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenRotationService } from '../../src/security/token/refresh-token-rotation.service';
import {
  AUTH_ERROR_REPLAY_ATTACK,
  AUTH_ERROR_TOKEN_EXPIRED,
  AUTH_ERROR_UNAUTHORIZED,
} from '../../src/config/constants/auth.constants';

describe('RefreshTokenRotationService', () => {
  let service: RefreshTokenRotationService;

  beforeEach(() => {
    // Instantiate with in-memory fallback (no mock DB required)
    service = new RefreshTokenRotationService();
  });

  it('should generate valid SHA-256 hash from raw token', () => {
    const rawToken = 'super_random_hex_token_123456789';
    const hash1 = service.hashToken(rawToken);
    const hash2 = service.hashToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 is 64 hex characters
  });

  it('should store and retrieve refresh token successfully', async () => {
    const userId = 'user-uuid-1';
    const rawToken = service.generateTokenString();

    const stored = await service.storeRefreshToken(userId, rawToken, {
      ipAddress: '127.0.0.1',
      userAgent: 'Jest-Test-Agent',
    });

    expect(stored.userId).toBe(userId);
    expect(stored.isRevoked).toBe(false);
    expect(stored.tokenHash).toBe(service.hashToken(rawToken));
  });

  it('should rotate valid token into new token and mark old token as revoked', async () => {
    const userId = 'user-uuid-1';
    const initialToken = service.generateTokenString();

    await service.storeRefreshToken(userId, initialToken);

    const rotationResult = await service.validateAndRotateRefreshToken(initialToken);

    expect(rotationResult.userId).toBe(userId);
    expect(rotationResult.newRefreshToken).toBeDefined();
    expect(rotationResult.newRefreshToken).not.toBe(initialToken);

    // Old token should now be revoked and rejected if attempted again
    await expect(service.validateAndRotateRefreshToken(initialToken)).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_REPLAY_ATTACK,
      },
    });
  });

  it('should detect REPLAY ATTACK and revoke token family when old revoked token is reused', async () => {
    const userId = 'user-uuid-victim';
    const tokenA = service.generateTokenString();

    // 1. Initial issuance
    await service.storeRefreshToken(userId, tokenA);

    // 2. Legitimate user rotates tokenA -> tokenB
    const rotation1 = await service.validateAndRotateRefreshToken(tokenA);
    const tokenB = rotation1.newRefreshToken;

    // 3. Attacker steals already-used tokenA and attempts replay!
    await expect(service.validateAndRotateRefreshToken(tokenA)).rejects.toThrow(
      UnauthorizedException,
    );

    try {
      await service.validateAndRotateRefreshToken(tokenA);
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        code: AUTH_ERROR_REPLAY_ATTACK,
      });
    }

    // 4. Token family should now be revoked; even tokenB is invalidated for safety!
    await expect(service.validateAndRotateRefreshToken(tokenB)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject non-existent or invalid token with AUTH_001', async () => {
    await expect(
      service.validateAndRotateRefreshToken('non_existent_token_abc123'),
    ).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_UNAUTHORIZED,
      },
    });
  });

  it('should reject expired refresh token with AUTH_002', async () => {
    const userId = 'user-expired';
    const rawToken = service.generateTokenString();

    // Store with negative TTL (already expired)
    await service.storeRefreshToken(userId, rawToken, {
      ttlMs: -1000,
    });

    await expect(service.validateAndRotateRefreshToken(rawToken)).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_TOKEN_EXPIRED,
      },
    });
  });

  it('should explicitly revoke token on logout', async () => {
    const userId = 'user-logout';
    const token = service.generateTokenString();

    await service.storeRefreshToken(userId, token);
    await service.revokeRefreshToken(token);

    // Attempting to rotate should trigger replay/revoked check
    await expect(service.validateAndRotateRefreshToken(token)).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_REPLAY_ATTACK,
      },
    });
  });
});
