import { Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from '../../core/cache/cache.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../config/constants/auth.constants';
import {
  CACHE_TAG_TOKEN_BLACKLIST,
  buildTokenBlacklistCacheKey,
} from '../../config/constants/cache.constants';

export interface BlacklistedTokenRecord {
  tokenHash: string;
  revokedAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
}

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  // In-memory fallback / L1 fast cache (tokenHash -> expiresAtMs)
  private readonly memoryStore = new Map<string, number>();
  private readonly MAX_MEMORY_ENTRIES = 10000;
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(
    @Optional() private readonly cacheService?: CacheService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    // Tự động quét dọn token hết hạn mỗi 5 phút để bảo vệ RAM (Anti-Memory Leak)
    this.sweepInterval = setInterval(() => this.sweepExpiredTokens(), 5 * 60 * 1000);
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.memoryStore.clear();
  }

  /**
   * Quét dọn các token hết hạn khỏi bộ nhớ RAM và bảo vệ ngưỡng giới hạn MAX_MEMORY_ENTRIES
   */
  sweepExpiredTokens(): number {
    const now = Date.now();
    let removed = 0;
    for (const [hash, expiresAt] of this.memoryStore.entries()) {
      if (expiresAt <= now) {
        this.memoryStore.delete(hash);
        removed++;
      }
    }

    if (this.memoryStore.size > this.MAX_MEMORY_ENTRIES) {
      const excess = this.memoryStore.size - this.MAX_MEMORY_ENTRIES;
      let count = 0;
      for (const key of this.memoryStore.keys()) {
        this.memoryStore.delete(key);
        count++;
        if (count >= excess) break;
      }
    }
    return removed;
  }

  /**
   * Băm SHA-256 token để tạo định danh duy nhất (64 hex characters)
   */
  hashToken(token: string): string {
    const cleanToken = this.stripBearer(token);
    return crypto.createHash('sha256').update(cleanToken).digest('hex');
  }

  /**
   * Loại bỏ tiền tố 'Bearer ' nếu có
   */
  private stripBearer(token: string): string {
    return token.replace(/^Bearer\s+/i, '').trim();
  }

  /**
   * Trích xuất thời điểm hết hạn (exp unix timestamp giây) từ JWT payload
   * Phân tích trực tiếp base64url payload mà không cần secret để xác định TTL
   */
  extractTokenExpiry(token: string): number | null {
    try {
      const cleanToken = this.stripBearer(token);
      const parts = cleanToken.split('.');
      if (parts.length < 2) return null;

      // Base64Url decode
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      const payload = JSON.parse(jsonStr);

      if (payload && typeof payload.exp === 'number') {
        return payload.exp;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Đưa Access Token vào blacklist khi người dùng đăng xuất
   * TTL bằng thời gian sống còn lại của token (tối thiểu 60s để chống clock skew)
   */
  async blacklistToken(token: string): Promise<void> {
    if (!token || typeof token !== 'string') return;
    const cleanToken = this.stripBearer(token);
    if (!cleanToken) return;

    const tokenHash = this.hashToken(cleanToken);
    const expSeconds = this.extractTokenExpiry(cleanToken);
    const nowSeconds = Math.floor(Date.now() / 1000);

    let remainingSeconds: number;
    if (expSeconds) {
      remainingSeconds = expSeconds - nowSeconds;
    } else {
      // Fallback nếu không parse được exp
      remainingSeconds = ACCESS_TOKEN_TTL_SECONDS;
    }

    // Nếu token còn hạn, set TTL đúng bằng thời gian sống còn lại.
    // Nếu token đã hết hạn, vẫn giữ blacklist tối thiểu 60s để phòng chống clock-skew hoặc replay tức thì
    const effectiveTtlSeconds = Math.max(remainingSeconds, 60);
    const expiresAtMs = Date.now() + effectiveTtlSeconds * 1000;

    // 1. Lưu vào L1 Memory Store
    this.memoryStore.set(tokenHash, expiresAtMs);

    const cacheKey = buildTokenBlacklistCacheKey(tokenHash);
    const record: BlacklistedTokenRecord = {
      tokenHash,
      revokedAt: Date.now(),
      expiresAt: expiresAtMs,
    };

    // 2. Lưu vào CacheService (L2 Cache / _system_cache)
    if (this.cacheService) {
      try {
        await this.cacheService.set({
          key: cacheKey,
          value: record,
          ttlSeconds: effectiveTtlSeconds,
          tagOrTags: CACHE_TAG_TOKEN_BLACKLIST,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to record token blacklist in CacheService: ${(err as Error)?.message}`,
        );
      }
    } else if (this.prisma) {
      try {
        await this.prisma.systemCache.upsert({
          where: { key: cacheKey },
          create: {
            key: cacheKey,
            value: JSON.stringify(record),
            tag: CACHE_TAG_TOKEN_BLACKLIST,
            expiresAt: new Date(expiresAtMs),
          },
          update: {
            value: JSON.stringify(record),
            tag: CACHE_TAG_TOKEN_BLACKLIST,
            expiresAt: new Date(expiresAtMs),
          },
        });
      } catch (err: unknown) {
        this.logger.warn(`Failed to record token blacklist in DB: ${(err as Error)?.message}`);
      }
    }
  }

  /**
   * Kiểm tra xem token có nằm trong blacklist hay không
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = this.stripBearer(token);
    if (!cleanToken) return false;

    const tokenHash = this.hashToken(cleanToken);
    const now = Date.now();

    // 1. Kiểm tra L1 Memory Store
    const memExpiry = this.memoryStore.get(tokenHash);
    if (memExpiry !== undefined) {
      if (memExpiry > now) {
        return true;
      }
      // Đã hết hạn -> xóa khỏi memory
      this.memoryStore.delete(tokenHash);
    }

    const cacheKey = buildTokenBlacklistCacheKey(tokenHash);

    // 2. Kiểm tra CacheService
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<BlacklistedTokenRecord>(cacheKey);
        if (cached) {
          // Sync lại vào memory store
          this.memoryStore.set(tokenHash, cached.expiresAt || now + 60000);
          return true;
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to check blacklist from CacheService: ${(err as Error)?.message}`);
      }
    } else if (this.prisma) {
      try {
        const dbRecord = await this.prisma.systemCache.findUnique({
          where: { key: cacheKey },
        });
        if (dbRecord && new Date(dbRecord.expiresAt).getTime() > now) {
          this.memoryStore.set(tokenHash, new Date(dbRecord.expiresAt).getTime());
          return true;
        }
      } catch (err: unknown) {
        this.logger.warn(`Failed to check blacklist from DB: ${(err as Error)?.message}`);
      }
    }

    return false;
  }

  /**
   * Xóa sạch bộ nhớ memoryStore (phục vụ unit test)
   */
  clearMemoryCache(): void {
    this.memoryStore.clear();
  }
}
