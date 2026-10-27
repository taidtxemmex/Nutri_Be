import { Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CACHE_DEBOUNCE_WINDOW_MS } from '../../config/constants/cache.constants';

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number; // Unix timestamp (ms) - 0 = perpetual
  createdAt: number; // Unix timestamp (ms) of creation
  tag?: string;      // Backwards compatibility: primary tag
  tags?: string[];   // All tags associated with this entry
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memoryStore = new Map<string, CacheEntry>();
  private readonly pendingTagsToInvalidate = new Set<string>();
  private readonly tagVersionMap = new Map<string, number>(); // Monotonic timestamp ms per tag (Rule 25)
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  onModuleDestroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Chuẩn hóa danh sách tag đầu vào (hỗ trợ string, string[], undefined, null)
   */
  private normalizeTags(tagOrTags?: string | string[]): string[] {
    if (!tagOrTags) return [];
    if (typeof tagOrTags === 'string') {
      const trimmed = tagOrTags.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(tagOrTags)) {
      return tagOrTags
        .map((t) => (typeof t === 'string' ? t.trim() : String(t)))
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Lấy timestamp version mới nhất của một tag (Rule 25 - Monotonic Timestamp Versioning)
   * Phục vụ header X-Cache-Version và kiểm tra phiên bản bộ nhớ đệm
   */
  getTagVersion(tag: string): number {
    return this.tagVersionMap.get(tag) || 0;
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
   * Tích hợp Invalidation Fence & Monotonic Version Guard (Rule 25):
   * Nếu cache entry có bất kỳ tag nào đã bị invalidate sau thời điểm createdAt -> hủy ngay và trả về null.
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Kiểm tra In-Memory Store
    const mem = this.memoryStore.get(key);
    if (mem) {
      // Invalidation Fence: Nếu có bất kỳ tag nào có phiên bản mới hơn thời điểm tạo cache entry
      const entryTags = mem.tags || (mem.tag ? [mem.tag] : []);
      const isStale = entryTags.some((t) => (this.tagVersionMap.get(t) || 0) > mem.createdAt);

      if (isStale) {
        this.memoryStore.delete(key);
      } else if (mem.expiresAt === 0 || mem.expiresAt > now) {
        return mem.value as T;
      } else {
        this.memoryStore.delete(key);
      }
    }

    // 2. Fallback kiểm tra Prisma _system_cache
    if (this.prisma) {
      try {
        const cached = await this.prisma.systemCache.findUnique({
          where: { key },
        });

        if (cached) {
          const isPerpetual = new Date(cached.expiresAt).getFullYear() > 2090;
          const isExpired = !isPerpetual && new Date(cached.expiresAt).getTime() <= now;
          const cachedCreatedAt = cached.createdAt ? new Date(cached.createdAt).getTime() : 0;
          const isStale = cached.tag
            ? (this.tagVersionMap.get(cached.tag) || 0) > cachedCreatedAt
            : false;

          if (!isExpired && !isStale) {
            const parsed = JSON.parse(cached.value);
            const expiresAtMs = isPerpetual ? 0 : new Date(cached.expiresAt).getTime();
            this.memoryStore.set(key, {
              value: parsed,
              expiresAt: expiresAtMs,
              createdAt: cachedCreatedAt || now,
              tag: cached.tag || undefined,
              tags: cached.tag ? [cached.tag] : [],
            });
            return parsed as T;
          } else {
            this.prisma.systemCache.delete({ where: { key } }).catch(() => {});
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi đọc _system_cache (${key}): ${err?.message}`);
      }
    }

    return null;
  }

  /**
   * getOrSet: Tái sử dụng Cache thực thể & Chống trùng lặp truy vấn (Identity Map Pattern)
   * 1. Kiểm tra cache theo key. Nếu có -> trả về ngay (0ms).
   * 2. Nếu chưa có -> ghi nhận queryStartTime, gọi factory callback nạp từ CSDL,
   *    lưu cache vĩnh viễn (hoặc theo TTL) kèm tag(s) rồi trả về.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
    tagOrTags?: string | string[],
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const queryStartTime = Date.now();
    const result = await factory();
    if (result !== null && result !== undefined) {
      await this.set(key, result, ttlSeconds, tagOrTags, queryStartTime);
    }
    return result;
  }

  /**
   * Ghi dữ liệu vào cache (hỗ trợ ttlSeconds = 0 cho perpetual cache lưu vĩnh viễn)
   * Invalidation Fence: Nếu trong quá trình truy vấn DB đã có mutation xảy ra với bất kỳ tag nào
   * (lastInvalidatedAt >= entryCreatedAt) -> TỪ CHỐI ghi cache để ngăn ngừa race condition & Cache Poisoning!
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    tagOrTags?: string | string[],
    createdAt?: number,
  ): Promise<void> {
    const normalizedTags = this.normalizeTags(tagOrTags);
    const entryCreatedAt = createdAt || Date.now();

    // Invalidation Fence: Từ chối ghi cache nếu trong lúc query DB đã xảy ra mutation mới hơn
    for (const tag of normalizedTags) {
      const lastInvalidatedAt = this.tagVersionMap.get(tag) || 0;
      if (lastInvalidatedAt >= entryCreatedAt) {
        this.logger.debug?.(
          `Từ chối ghi cache (${key}) do tag "${tag}" vừa có mutation mới hơn (${lastInvalidatedAt} >= ${entryCreatedAt})`,
        );
        return;
      }
    }

    const isPerpetual = ttlSeconds === 0;
    const expiresAtMs = isPerpetual ? 0 : Date.now() + ttlSeconds * 1000;
    const expiresAtDate = isPerpetual
      ? new Date('2099-12-31T23:59:59.000Z')
      : new Date(expiresAtMs);

    const primaryTag = normalizedTags.length > 0 ? normalizedTags[0] : undefined;

    // Ghi vào In-Memory
    this.memoryStore.set(key, {
      value,
      expiresAt: expiresAtMs,
      createdAt: entryCreatedAt,
      tag: primaryTag,
      tags: normalizedTags,
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
            tag: primaryTag || null,
            expiresAt: expiresAtDate,
            createdAt: new Date(entryCreatedAt),
          },
          update: {
            value: JSON.stringify(value),
            tag: primaryTag || null,
            expiresAt: expiresAtDate,
            createdAt: new Date(entryCreatedAt),
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

    const now = Date.now();
    for (const t of tags) {
      this.tagVersionMap.set(t, now);
    }

    // 1. Xóa trong In-Memory lập tức (hỗ trợ cả entry.tags và entry.tag)
    for (const [k, entry] of this.memoryStore.entries()) {
      const entryTags = entry.tags || (entry.tag ? [entry.tag] : []);
      if (entryTags.some((t) => tags.includes(t)) || (entry.tag && tags.includes(entry.tag))) {
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
   * - Cập nhật Monotonic Timestamp Version cho toàn bộ tags.
   * - Xóa In-Memory NGAY LẬP TỨC để các GET kế tiếp thấy dữ liệu mới ngay.
   * - Gom các DB delete calls vào Set và chỉ gọi DB 1 lần sau cửa sổ debounce (500ms),
   *   tránh invalidation storm và tránh gọi SQL liên tục khi admin thao tác liên tục.
   */
  async debouncedInvalidateTags(tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    const now = Date.now();
    for (const t of tags) {
      this.tagVersionMap.set(t, now);
    }

    // 1. Xóa In-Memory NGAY LẬP TỨC
    for (const [k, entry] of this.memoryStore.entries()) {
      const entryTags = entry.tags || (entry.tag ? [entry.tag] : []);
      if (entryTags.some((t) => tags.includes(t)) || (entry.tag && tags.includes(entry.tag))) {
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
      if (entry.expiresAt !== 0 && entry.expiresAt <= now) {
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
    this.tagVersionMap.clear();
  }
}
