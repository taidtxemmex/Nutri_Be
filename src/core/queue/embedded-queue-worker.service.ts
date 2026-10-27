import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MysqlQueueService } from './mysql-queue.service';
import { InMemoryMailerService } from './in-memory-mailer.service';
import { Job } from './queue.interface';

@Injectable()
export class EmbeddedQueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddedQueueWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isRunning = false;
  private readonly workerId = `worker-${process.pid}-${Math.random().toString(36).substring(2, 8)}`;
  private pollIntervalMs = 3000;
  private batchSize = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: MysqlQueueService,
    @Optional() private readonly inMemoryMailer?: InMemoryMailerService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    if (this.configService) {
      const interval = this.configService.get<string | number>('QUEUE_POLL_INTERVAL_MS');
      if (interval) {
        this.pollIntervalMs = Number(interval) || 3000;
      }
      const batch = this.configService.get<string | number>('QUEUE_BATCH_SIZE');
      if (batch) {
        this.batchSize = Number(batch) || 10;
      }
    }
  }

  async onModuleInit(): Promise<void> {
    // 1. Đăng ký default processor cho email nếu có InMemoryMailerService
    if (this.inMemoryMailer) {
      if (!this.queueService.hasHandler('mail:send')) {
        this.queueService.process('mail:send', async (payload: any) => {
          await this.inMemoryMailer!.sendMail(payload);
        });
      }
      if (!this.queueService.hasHandler('mail')) {
        this.queueService.process('mail', async (payload: any) => {
          await this.inMemoryMailer!.sendMail(payload);
        });
      }
    }

    // 2. Tự động khởi động worker polling (trừ khi có cờ tắt rõ ràng)
    const autoStart = this.configService?.get<string>('QUEUE_WORKER_AUTO_START');
    if (autoStart !== 'false') {
      this.startWorker();
    }
  }

  onModuleDestroy(): void {
    this.stopWorker();
  }

  /**
   * Khởi chạy polling worker
   */
  startWorker(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log(
      `[EmbeddedQueueWorker] Bắt đầu chạy polling worker (interval: ${this.pollIntervalMs}ms, workerId: ${this.workerId})...`,
    );

    this.timer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err: any) {
        this.logger.error(`[EmbeddedQueueWorker] Lỗi polling tick: ${err?.message}`);
      }
    }, this.pollIntervalMs);
  }

  /**
   * Dừng polling worker
   */
  stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.logger.log(`[EmbeddedQueueWorker] Đã dừng polling worker.`);
  }

  /**
   * Lấy trạng thái hoạt động của worker
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Thực thi một chu kỳ xử lý batch jobs (hỗ trợ gọi trực tiếp trong Unit/Integration Tests)
   */
  async processBatch(customBatchSize?: number): Promise<{
    claimedCount: number;
    successCount: number;
    failedCount: number;
  }> {
    if (this.isProcessing) {
      return { claimedCount: 0, successCount: 0, failedCount: 0 };
    }

    this.isProcessing = true;
    const limit = customBatchSize || this.batchSize;
    let claimedJobs: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      // 0. Phục hồi các jobs kẹt do worker chết trước đó (lockedAt > 10 phút)
      await this.recoverStuckJobs();

      // 1. Transaction Atomic Claim với MySQL SKIP LOCKED (Connection Pool Protection Law)
      claimedJobs = await this.claimPendingJobs(limit);

      if (claimedJobs.length === 0) {
        return { claimedCount: 0, successCount: 0, failedCount: 0 };
      }

      this.logger.log(
        `[EmbeddedQueueWorker] Worker [${this.workerId}] đã claim ${claimedJobs.length} jobs để xử lý.`,
      );

      // 2. Dispatch từng job tới processor tương ứng (DB connection đã release)
      for (const rawJob of claimedJobs) {
        let payload: any;
        try {
          payload = JSON.parse(rawJob.payload);
        } catch {
          payload = rawJob.payload;
        }

        const job: Job = {
          id: rawJob.id.toString(),
          queueName: rawJob.queueName,
          payload,
          status: rawJob.status,
          attempts: rawJob.attempts,
          maxAttempts: rawJob.maxAttempts,
          priority: rawJob.priority,
          runAt: rawJob.runAt,
          lockedBy: rawJob.lockedBy,
          lockedAt: rawJob.lockedAt,
          lastError: rawJob.lastError,
          createdAt: rawJob.createdAt,
          updatedAt: rawJob.updatedAt,
        };

        const handler = this.queueService.getHandler(rawJob.queueName);

        if (!handler) {
          this.logger.warn(
            `Không tìm thấy processor handler cho queue: [${rawJob.queueName}]. Đánh dấu lỗi tạm thời.`,
          );
          await this.handleJobFailure(
            rawJob,
            new Error(`Không có processor đăng ký cho queue "${rawJob.queueName}"`),
          );
          failedCount++;
          continue;
        }

        try {
          // Xử lý công việc
          await handler(payload, job);

          // Thành công: Cập nhật status = 'completed'
          await this.prisma.systemJob.update({
            where: { id: rawJob.id },
            data: {
              status: 'completed',
              lockedBy: null,
              lockedAt: null,
              lastError: null,
            },
          });

          successCount++;
          this.logger.log(`Job id ${rawJob.id} [${rawJob.queueName}] đã hoàn thành thành công.`);
        } catch (execError: any) {
          this.logger.error(
            `Job id ${rawJob.id} [${rawJob.queueName}] thất bại: ${execError?.message}`,
          );
          await this.handleJobFailure(rawJob, execError);
          failedCount++;
        }
      }
    } catch (err: any) {
      this.logger.error(`[EmbeddedQueueWorker] Lỗi trong tiến trình processBatch: ${err?.message}`);
    } finally {
      this.isProcessing = false;
    }

    return {
      claimedCount: claimedJobs.length,
      successCount,
      failedCount,
    };
  }

  /**
   * Atomic Claim các pending jobs thỏa mãn điều kiện run_at <= NOW()
   * Sử dụng MySQL 8.0 FOR UPDATE SKIP LOCKED
   */
  private async claimPendingJobs(batchSize: number): Promise<any[]> {
    const now = new Date();
    const workerId = this.workerId;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Thử thực thi MySQL FOR UPDATE SKIP LOCKED
        const candidates: Array<{ id: bigint }> = await tx.$queryRaw`
          SELECT id FROM _system_jobs
          WHERE (status = 'pending' OR status = 'PENDING')
            AND run_at <= ${now}
          ORDER BY priority DESC, id ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        if (!candidates || candidates.length === 0) {
          return [];
        }

        const candidateIds = candidates.map((c) => c.id);

        await tx.systemJob.updateMany({
          where: { id: { in: candidateIds } },
          data: {
            status: 'processing',
            lockedBy: workerId,
            lockedAt: now,
          },
        });

        return tx.systemJob.findMany({
          where: { id: { in: candidateIds } },
        });
      });
    } catch (err: any) {
      // Fallback cho môi trường test mock hoặc MariaDB/DB không hỗ trợ cú pháp SKIP LOCKED
      this.logger.debug?.(
        `[EmbeddedQueueWorker] Fallback atomic query do SKIP LOCKED không được hỗ trợ: ${err?.message}`,
      );

      return this.prisma.$transaction(async (tx) => {
        const candidates = await tx.systemJob.findMany({
          where: {
            status: { in: ['pending', 'PENDING'] },
            runAt: { lte: now },
            lockedBy: null,
          },
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
          take: batchSize,
        });

        if (candidates.length === 0) {
          return [];
        }

        const candidateIds = candidates.map((c) => c.id);

        await tx.systemJob.updateMany({
          where: { id: { in: candidateIds } },
          data: {
            status: 'processing',
            lockedBy: workerId,
            lockedAt: now,
          },
        });

        return tx.systemJob.findMany({
          where: { id: { in: candidateIds } },
        });
      });
    }
  }

  /**
   * Xử lý khi job gặp lỗi: Retry với exponential backoff hoặc đẩy vào DLQ
   */
  private async handleJobFailure(rawJob: any, error: any): Promise<void> {
    const nextAttempts = (rawJob.attempts || 0) + 1;
    const maxAttempts = rawJob.maxAttempts || 3;
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || errorMessage;

    if (nextAttempts < maxAttempts) {
      // Exponential backoff: Math.pow(2, nextAttempts) * 1000 ms (ví dụ: 2s, 4s, 8s...)
      const backoffMs = Math.pow(2, nextAttempts) * 1000;
      const nextRunAt = new Date(Date.now() + backoffMs);

      await this.prisma.systemJob.update({
        where: { id: rawJob.id },
        data: {
          status: 'pending',
          attempts: nextAttempts,
          runAt: nextRunAt,
          lockedBy: null,
          lockedAt: null,
          lastError: errorMessage,
        },
      });

      this.logger.warn(
        `Job id ${rawJob.id} sẽ được thử lại (attempt ${nextAttempts}/${maxAttempts}) lúc ${nextRunAt.toISOString()}.`,
      );
    } else {
      // Vượt quá số lần thử tối đa -> Ghi vào _system_jobs_dlq và đánh dấu status = 'failed'
      await this.prisma.$transaction(async (tx) => {
        await tx.systemJobDlq.create({
          data: {
            originalJobId: rawJob.id,
            queueName: rawJob.queueName,
            payload: rawJob.payload,
            errorStack,
            failedAt: new Date(),
          },
        });

        await tx.systemJob.update({
          where: { id: rawJob.id },
          data: {
            status: 'failed',
            attempts: nextAttempts,
            lockedBy: null,
            lockedAt: null,
            lastError: errorMessage,
          },
        });
      });

      this.logger.error(
        `Job id ${rawJob.id} đã vượt quá ${maxAttempts} lần thử. Đã chuyển sang Dead Letter Queue (_system_jobs_dlq).`,
      );
    }
  }

  /**
   * C4: Phục hồi các jobs bị kẹt ở trạng thái 'processing' quá 10 phút do worker chết/crash
   */
  async recoverStuckJobs(timeoutMs = 10 * 60 * 1000): Promise<number> {
    try {
      const staleThreshold = new Date(Date.now() - timeoutMs);
      const result = await this.prisma.systemJob.updateMany({
        where: {
          status: 'processing',
          lockedAt: { lt: staleThreshold },
        },
        data: {
          status: 'pending',
          lockedBy: null,
          lockedAt: null,
        },
      });
      if (result.count > 0) {
        this.logger.warn(
          `[EmbeddedQueueWorker] Đã phục hồi ${result.count} jobs bị kẹt quá hạn về trạng thái pending.`,
        );
      }
      return result.count;
    } catch (err: any) {
      this.logger.warn(`Lỗi phục hồi jobs kẹt: ${err?.message}`);
      return 0;
    }
  }
}
