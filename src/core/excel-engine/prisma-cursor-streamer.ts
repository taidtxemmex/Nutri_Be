/**
 * PrismaCursorStreamer
 * Tiện ích truy vấn cơ sở dữ liệu theo lô con trỏ (Cursor-based Pagination)
 * Chống tràn bộ nhớ RAM (Pillar III: Anti-OOM, Rules 19 & 20)
 * Nền tảng phục vụ cho Task 6.6 & Export Streaming dữ liệu lớn
 */

export interface CursorStreamOptions<T> {
  model: string;
  where?: Record<string, any>;
  select?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  batchSize?: number; // Mặc định 200 bản ghi / chunk
  onBatch: (items: T[]) => Promise<void>;
}

export async function streamPrismaInBatches<T extends { id: any }>(
  prisma: any,
  options: CursorStreamOptions<T>,
): Promise<number> {
  const batchSize = options.batchSize || 200;
  let lastId: any = undefined;
  let totalProcessed = 0;
  const modelDelegate = prisma ? prisma[options.model] : null;

  if (!modelDelegate || typeof modelDelegate.findMany !== 'function') {
    throw new Error(`Prisma model '${String(options.model)}' không tồn tại hoặc không hợp lệ`);
  }

  while (true) {
    const items: T[] = await modelDelegate.findMany({
      where: options.where,
      select: options.select,
      take: batchSize,
      skip: lastId ? 1 : 0,
      cursor: lastId ? { id: lastId } : undefined,
      orderBy: options.orderBy || { id: 'asc' },
    });

    if (!items || items.length === 0) {
      break;
    }

    await options.onBatch(items);
    totalProcessed += items.length;
    lastId = items[items.length - 1].id;

    if (items.length < batchSize) {
      break;
    }
  }

  return totalProcessed;
}
