import { Injectable, UnauthorizedException, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import {
  REFRESH_TOKEN_CACHE_TAG,
  REFRESH_TOKEN_KEY_PREFIX,
  REFRESH_TOKEN_TTL_MS,
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_TOKEN_EXPIRED,
  AUTH_ERROR_REPLAY_ATTACK,
} from '../../config/constants/auth.constants';

export interface StoredRefreshToken {
  tokenHash: string;
  userId: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  replacedByTokenHash?: string;
}

export interface RotationResult {
  newRefreshToken: string;
  userId: string;
  familyId: string;
}

export interface StoreRefreshTokenParamDto {
  userId: string;
  rawToken: string;
  familyId?: string;
  ipAddress?: string;
  userAgent?: string;
  ttlMs?: number;
}

export interface RotateRefreshTokenParamDto {
  oldRawToken: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenRotationService {
  private readonly logger = new Logger(RefreshTokenRotationService.name);
  // In-memory fallback map for high-speed cache or unit tests without active DB connection
  private readonly memoryStore = new Map<string, StoredRefreshToken>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Compute cryptographically secure SHA-256 hash of a raw token
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Generate a cryptographically secure random token string
   */
  generateTokenString(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  /**
   * Persist a new refresh token and associate with a token family
   */
  async storeRefreshToken(
    paramOrUserId: StoreRefreshTokenParamDto | string,
    legacyRawToken?: string,
    legacyOptions?: {
      familyId?: string;
      ipAddress?: string;
      userAgent?: string;
      ttlMs?: number;
    },
  ): Promise<StoredRefreshToken> {
    let userId: string;
    let rawToken: string;
    let options:
      | {
          familyId?: string;
          ipAddress?: string;
          userAgent?: string;
          ttlMs?: number;
        }
      | undefined;

    if (paramOrUserId && typeof paramOrUserId === 'object' && 'userId' in paramOrUserId) {
      userId = paramOrUserId.userId;
      rawToken = paramOrUserId.rawToken;
      options = {
        familyId: paramOrUserId.familyId,
        ipAddress: paramOrUserId.ipAddress,
        userAgent: paramOrUserId.userAgent,
        ttlMs: paramOrUserId.ttlMs,
      };
    } else {
      userId = paramOrUserId as string;
      rawToken = legacyRawToken!;
      options = legacyOptions;
    }

    const tokenHash = this.hashToken(rawToken);
    const ttlMs = options?.ttlMs || REFRESH_TOKEN_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);
    const familyId = options?.familyId || crypto.randomUUID();

    const record: StoredRefreshToken = {
      tokenHash,
      userId,
      familyId,
      isRevoked: false,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    };

    const cacheKey = `${REFRESH_TOKEN_KEY_PREFIX}${tokenHash}`;

    if (this.prisma) {
      try {
        await this.prisma.systemCache.upsert({
          where: { key: cacheKey },
          create: {
            key: cacheKey,
            value: JSON.stringify(record),
            tag: `${REFRESH_TOKEN_CACHE_TAG}:${userId}`,
            expiresAt,
          },
          update: {
            value: JSON.stringify(record),
            tag: `${REFRESH_TOKEN_CACHE_TAG}:${userId}`,
            expiresAt,
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `Failed writing token to database cache, falling back to memory: ${err?.message}`,
        );
        this.memoryStore.set(cacheKey, record);
      }
    } else {
      this.memoryStore.set(cacheKey, record);
    }

    return record;
  }

  /**
   * Validate old refresh token, detect replay attacks, revoke old token and issue a new one
   */
  async validateAndRotateRefreshToken(
    paramOrToken: RotateRefreshTokenParamDto | string,
    legacyOptions?: { ipAddress?: string; userAgent?: string },
  ): Promise<RotationResult> {
    let oldRawToken: string;
    let options: { ipAddress?: string; userAgent?: string } | undefined;

    if (paramOrToken && typeof paramOrToken === 'object' && 'oldRawToken' in paramOrToken) {
      oldRawToken = paramOrToken.oldRawToken;
      options = {
        ipAddress: paramOrToken.ipAddress,
        userAgent: paramOrToken.userAgent,
      };
    } else {
      oldRawToken = paramOrToken as string;
      options = legacyOptions;
    }

    if (!oldRawToken || typeof oldRawToken !== 'string') {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Refresh token không hợp lệ.',
      });
    }

    const oldTokenHash = this.hashToken(oldRawToken);
    const cacheKey = `${REFRESH_TOKEN_KEY_PREFIX}${oldTokenHash}`;

    let record: StoredRefreshToken | null = null;

    if (this.prisma) {
      try {
        const cached = await this.prisma.systemCache.findUnique({
          where: { key: cacheKey },
        });
        if (cached?.value) {
          record = JSON.parse(cached.value);
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading token from DB, checking memory: ${err?.message}`);
        record = this.memoryStore.get(cacheKey) || null;
      }
    } else {
      record = this.memoryStore.get(cacheKey) || null;
    }

    if (!record) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Refresh token không tồn tại hoặc đã hết hạn.',
      });
    }

    // Check expiration
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await this.deleteToken(cacheKey);
      throw new UnauthorizedException({
        code: AUTH_ERROR_TOKEN_EXPIRED,
        message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    // REPLAY ATTACK DETECTION (RFC 6819)
    // If a revoked token is presented again, compromise has occurred!
    if (record.isRevoked) {
      this.logger.error(
        `🚨 REPLAY ATTACK DETECTED for user ${record.userId} (Family: ${record.familyId}). Revoking entire family!`,
      );
      await this.revokeFamilyTokens(record.familyId, record.userId);

      throw new UnauthorizedException({
        code: AUTH_ERROR_REPLAY_ATTACK,
        message:
          'Phát hiện hành vi tái sử dụng token bảo mật đã bị thu hồi. Toàn bộ phiên đăng nhập đã bị vô hiệu hóa vì lý do an toàn.',
      });
    }

    // Generate new token in the same token family
    const newRawToken = this.generateTokenString();
    const newTokenHash = this.hashToken(newRawToken);

    // 1. Revoke old token
    record.isRevoked = true;
    record.replacedByTokenHash = newTokenHash;
    await this.updateTokenRecord(cacheKey, record);

    // 2. Issue and store new token
    await this.storeRefreshToken(record.userId, newRawToken, {
      familyId: record.familyId,
      ipAddress: options?.ipAddress || record.ipAddress,
      userAgent: options?.userAgent || record.userAgent,
    });

    return {
      newRefreshToken: newRawToken,
      userId: record.userId,
      familyId: record.familyId,
    };
  }

  /**
   * Explicitly revoke a refresh token (e.g. on user logout)
   */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    const cacheKey = `${REFRESH_TOKEN_KEY_PREFIX}${tokenHash}`;

    let record: StoredRefreshToken | null = null;
    if (this.prisma) {
      try {
        const cached = await this.prisma.systemCache.findUnique({
          where: { key: cacheKey },
        });
        if (cached?.value) {
          record = JSON.parse(cached.value);
        }
      } catch (err: any) {
        record = this.memoryStore.get(cacheKey) || null;
      }
    } else {
      record = this.memoryStore.get(cacheKey) || null;
    }

    if (record) {
      record.isRevoked = true;
      await this.updateTokenRecord(cacheKey, record);
    }
  }

  /**
   * Revoke all tokens belonging to a specific user (Delegates to atomic batch)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.revokeMultipleUsersTokens([userId]);
  }

  /**
   * Revoke all tokens belonging to multiple users in a single atomic batch transaction (Rule 20)
   */
  async revokeMultipleUsersTokens(userIds: string[]): Promise<void> {
    if (!userIds || userIds.length === 0) return;

    const userTags = userIds.map((id) => `${REFRESH_TOKEN_CACHE_TAG}:${id}`);
    if (this.prisma) {
      try {
        const userRecords = await this.prisma.systemCache.findMany({
          where: userIds.length === 1 ? { tag: userTags[0] } : { tag: { in: userTags } },
        });

        if (userRecords.length > 0) {
          const updates = [];
          for (const item of userRecords) {
            try {
              const data: StoredRefreshToken = JSON.parse(item.value);
              data.isRevoked = true;
              updates.push(
                this.prisma.systemCache.update({
                  where: { key: item.key },
                  data: { value: JSON.stringify(data) },
                }),
              );
            } catch {
              // Ignore parse errors
            }
          }

          if (updates.length > 0) {
            if (typeof this.prisma.$transaction === 'function') {
              await this.prisma.$transaction(updates);
            } else {
              await Promise.all(updates);
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`Error revoking batch user tokens from DB: ${err?.message}`);
      }
    }

    const userIdSet = new Set(userIds);
    for (const [, val] of this.memoryStore.entries()) {
      if (userIdSet.has(val.userId)) {
        val.isRevoked = true;
      }
    }
  }

  /**
   * Revoke all tokens in a token family upon replay attack detection
   */
  private async revokeFamilyTokens(familyId: string, userId: string): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  private async updateTokenRecord(key: string, record: StoredRefreshToken): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.systemCache.update({
          where: { key },
          data: {
            value: JSON.stringify(record),
          },
        });
      } catch {
        this.memoryStore.set(key, record);
      }
    } else {
      this.memoryStore.set(key, record);
    }
  }

  private async deleteToken(key: string): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.systemCache.delete({ where: { key } });
      } catch {
        this.memoryStore.delete(key);
      }
    } else {
      this.memoryStore.delete(key);
    }
  }
}
