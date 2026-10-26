import { Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CACHE_DEBOUNCE_WINDOW_MS } from '../../config/constants/cache.constants';

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number; // Unix timestamp (ms)
  tag?: string;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memoryStore = new Map<string, CacheEntry>();
  private readonly pendingTagsToInvalidate = new Set<string>();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  onModuleDestroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Tạo cache key chuẩn hóa theo Rule 23:
   * - Loại bỏ tham số rác/tracking (utm_*, fbclid, _ga, timestamp, random, _)
   * - Sắp xếp các tham số truy vấn theo thứ tự alphabet (page, limit, search, role, status...)
   * - Băm SHA-256 để sinh mã hash định danh duy nhất
   */
  generateKey(prefix: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return `cache:${prefix}:all`;
    }

    const cleanParams: Record<string, any> = {};
    const trackingPrefixes = ['utm_', 'fbclid', '_ga', 'timestamp', 'random', '_t', '_'];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      const lowerKey = key.toLowerCase();
      if (trackingPrefixes.some((p) => lowerKey.startsWith(p))) continue;
      // Chuẩn hóa chuỗi (trim và lowercase nếu là chuỗi tìm kiếm)
      cleanParams[key] = typeof value === 'string' ? value.trim() : value;
    }

    const sortedKeys = Object.keys(cleanParams).sort();
    const sortedObj: Record<string, any> = {};
    for (const k of sortedKeys) {
      sortedObj[k] = cleanParams[k];
    }

    const serialized = JSON.stringify(sortedObj);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    return `cache:${prefix}:${hash}`;
  }

  /**
   * Lấy dữ liệu từ cache (In-memory siêu tốc < 1ms, fallback sang DB _system_cache)
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Kiểm tra In-Memory Store
    const mem = this.memoryStore.get(key);
    if (mem) {
      if (mem.expiresAt > now) {
        return mem.value as T;
      }
      this.memoryStore.delete(key);
    }

    // 2. Fallback kiểm tra Prisma _system_cache
    if (this.prisma) {
      try {
        const cached = await this.prisma.systemCache.findUnique({
          where: { key },
        });

        if (cached && new Date(cached.expiresAt).getTime() > now) {
          const parsed = JSON.parse(cached.value);
          this.memoryStore.set(key, {
            value: parsed,
            expiresAt: new Date(cached.expiresAt).getTime(),
            tag: cached.tag || undefined,
          });
          return parsed as T;
        } else if (cached) {
          this.prisma.systemCache.delete({ where: { key } }).catch(() => {});
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc _system_cache (${key}): ${err?.message}`);
      }
    }

    return null;
  }

  /**
   * Ghi dữ liệu vào cache
   */
  async set<T>(key: string, value: T, ttlSeconds: number, tag?: string): Promise<void> {
    const expiresAtMs = Date.now() + ttlSeconds * 1000;
    const expiresAtDate = new Date(expiresAtMs);

    // Ghi vào In-Memory
    this.memoryStore.set(key, {
      value,
      expiresAt: expiresAtMs,
      tag,
    });

    if (this.memoryStore.size > 5000) {
      this.evictExpiredMemoryEntries();
    }

    // Ghi vào Prisma _system_cache
    if (this.prisma) {
      try {
        await this.prisma.systemCache.upsert({
          where: { key },
          create: {
            key,
            value: JSON.stringify(value),
            tag: tag || null,
            expiresAt: expiresAtDate,
          },
          update: {
            value: JSON.stringify(value),
            tag: tag || null,
            expiresAt: expiresAtDate,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi ghi _system_cache (${key}): ${err?.message}`);
      }
    }
  }

  /**
   * Invalidate trực tiếp theo tag
   */
  async invalidateTag(tag: string): Promise<void> {
    await this.invalidateTags([tag]);
  }

  /**
   * Invalidate nhiều tags đồng thời
   */
  async invalidateTags(tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    // 1. Xóa trong In-Memory lập tức
    for (const [k, entry] of this.memoryStore.entries()) {
      if (entry.tag && tags.includes(entry.tag)) {
        this.memoryStore.delete(k);
      }
    }

    // 2. Xóa trong Prisma _system_cache
    if (this.prisma) {
      try {
        await this.prisma.systemCache.deleteMany({
          where: {
            tag: { in: tags },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi xóa _system_cache theo tags: ${err?.message}`);
      }
    }
  }

  /**
   * Invalidate gom cụm (Coalesced / Debounced Invalidation) - Rule 25:
   * - Xóa In-Memory NGAY LẬP TỨC để các GET kế tiếp thấy dữ liệu mới ngay.
   * - Gom các DB delete calls vào Set và chỉ gọi DB 1 lần sau cửa sổ debounce (500ms),
   *   tránh invalidation storm và tránh gọi SQL liên tục khi admin thao tác liên tục.
   */
  async debouncedInvalidateTags(tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    // 1. Xóa In-Memory NGAY LẬP TỨC
    for (const [k, entry] of this.memoryStore.entries()) {
      if (entry.tag && tags.includes(entry.tag)) {
        this.memoryStore.delete(k);
      }
    }

    // 2. Thêm vào pending set
    for (const t of tags) {
      this.pendingTagsToInvalidate.add(t);
    }

    // 3. Reset / Set Debounce Timer (500ms)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingTagsToDb();
    }, CACHE_DEBOUNCE_WINDOW_MS);
  }

  /**
   * Thực thi lệnh xóa DB một lần duy nhất cho toàn bộ tags tích lũy
   */
  async flushPendingTagsToDb(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingTagsToInvalidate.size === 0) return;

    const tagsToFlush = Array.from(this.pendingTagsToInvalidate);
    this.pendingTagsToInvalidate.clear();

    if (this.prisma) {
      try {
        await this.prisma.systemCache.deleteMany({
          where: {
            tag: { in: tagsToFlush },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi debounced flush _system_cache: ${err?.message}`);
      }
    }
  }

  private evictExpiredMemoryEntries(): void {
    const now = Date.now();
    for (const [k, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryStore.delete(k);
      }
    }
  }

  getPendingTagsCount(): number {
    return this.pendingTagsToInvalidate.size;
  }

  getMemoryStoreSize(): number {
    return this.memoryStore.size;
  }

  clearMemoryStore(): void {
    this.memoryStore.clear();
  }
}
