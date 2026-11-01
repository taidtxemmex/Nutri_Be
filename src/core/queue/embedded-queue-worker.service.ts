import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MysqlQueueService } from './mysql-queue.service';
import { InMemoryMailerService } from './in-memory-mailer.service';
import { EmailTemplateService } from './email-template.service';
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
    @Optional() private readonly emailTemplateService?: EmailTemplateService,
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
        this.queueService.process({
          queueName: 'mail:send',
          handler: async (payload: any) => {
            const mailData = { ...payload };
            if (!mailData.html && this.emailTemplateService) {
              const inner = payload.payload || payload;
              if (inner.lyDoTuChoi) {
                const rendered = this.emailTemplateService.renderPaymentRequestRejected({
                  fullName: inner.fullName || inner.username || 'Quý khách',
                  transactionId: inner.maGiaoDich || '',
                  packageName: inner.tenGoi || 'Gói dịch vụ',
                  reason: inner.lyDoTuChoi,
                });
                mailData.html = rendered.html;
                mailData.subject = mailData.subject || rendered.subject;
                mailData.body = rendered.text;
              } else if (
                inner.usageDays ||
                (mailData.subject && mailData.subject.includes('Kích hoạt'))
              ) {
                const rendered = this.emailTemplateService.renderPaymentRequestApproved({
                  fullName: inner.fullName || inner.username || 'Quý khách',
                  transactionId: inner.maGiaoDich || '',
                  packageName: inner.tenGoi || 'Gói dịch vụ',
                  usageDays: inner.usageDays || 30,
                });
                mailData.html = rendered.html;
                mailData.subject = mailData.subject || rendered.subject;
                mailData.body = rendered.text;
              } else if (
                inner.soTien ||
                (mailData.subject && mailData.subject.includes('Xác nhận'))
              ) {
                const rendered = this.emailTemplateService.renderPaymentRequestCreated({
                  fullName: inner.fullName || inner.username || 'Quý khách',
                  transactionId: inner.maGiaoDich || '',
                  packageName: inner.tenGoi || 'Gói dịch vụ',
                  amount: inner.soTien || 0,
                });
                mailData.html = rendered.html;
                mailData.subject = mailData.subject || rendered.subject;
                mailData.body = rendered.text;
              } else if (mailData.subject && mailData.subject.includes('Yêu cầu đăng ký gói mới')) {
                const rendered = this.emailTemplateService.renderNotifySuperAdminNewPaymentRequest({
                  fullName: inner.fullName || inner.username || 'Người dùng',
                  transactionId: inner.maGiaoDich || '',
                  packageName: inner.tenGoi || 'Gói dịch vụ',
                  amount: inner.soTien || 0,
                });
                mailData.html = rendered.html;
                mailData.subject = mailData.subject || rendered.subject;
                mailData.body = rendered.text;
              }
            }
            await this.inMemoryMailer!.sendMail(mailData);
          },
        });
      }
      if (!this.queueService.hasHandler('mail')) {
        this.queueService.process({
          queueName: 'mail',
          handler: async (payload: any) => {
            await this.inMemoryMailer!.sendMail(payload);
          },
        });
      }
      if (!this.queueService.hasHandler('email')) {
        this.queueService.process({
          queueName: 'email',
          handler: async (payload: any) => {
            const to = payload.to || payload.email || 'user@nutri.vn';
            let subject = payload.subject;
            let html = payload.html;
            let body = payload.body;

            if (!html && this.emailTemplateService) {
              const rawFrontendUrl =
                this.configService?.get<string>('FRONTEND_URL') ||
                this.configService?.get<string>('app.frontend-url') ||
                process.env.FRONTEND_URL ||
                'https://truenutri.pages.dev';
              const frontendUrl = rawFrontendUrl.split(',')[0].trim().replace(/\/+$/, '');

              if (payload.type === 'VERIFY_EMAIL') {
                const verifyLink =
                  payload.verifyLink || `${frontendUrl}/verify-email?token=${payload.token || ''}`;
                const rendered = this.emailTemplateService.renderRegistrationVerification({
                  fullName: payload.fullName || payload.username || 'Quý khách',
                  verifyLink,
                  expiresInMinutes: 15,
                });
                subject = subject || rendered.subject;
                html = rendered.html;
                body = rendered.text;
              } else if (payload.type === 'RESET_PASSWORD') {
                const resetLink =
                  payload.resetLink || `${frontendUrl}/reset-password?token=${payload.token || ''}`;
                const rendered = this.emailTemplateService.renderResetPassword({
                  fullName: payload.fullName || payload.username || 'Quý khách',
                  resetLink,
                  token: payload.token,
                  expiresInMinutes: 15,
                });
                subject = subject || rendered.subject;
                html = rendered.html;
                body = rendered.text;
              }
            }

            if (!subject) {
              subject =
                payload.type === 'VERIFY_EMAIL'
                  ? 'Xác thực tài khoản Nutri'
                  : payload.type === 'RESET_PASSWORD'
                    ? 'Đặt lại mật khẩu Nutri'
                    : 'Thông báo từ hệ thống Nutri';
            }

            await this.inMemoryMailer!.sendMail({
              to,
              subject,
              payload,
              html,
              body:
                body || `Type: ${payload.type || 'NOTIFICATION'}, Token: ${payload.token || ''}`,
            });
          },
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
      `[EmbeddedQueueWorker] Starting polling worker (interval: ${this.pollIntervalMs}ms, workerId: ${this.workerId})...`,
    );

    this.timer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err: unknown) {
        this.logger.error(`[EmbeddedQueueWorker] Polling tick error: ${(err as Error)?.message}`);
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
    this.logger.log(`[EmbeddedQueueWorker] Polling worker stopped.`);
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
        `[EmbeddedQueueWorker] Worker [${this.workerId}] claimed ${claimedJobs.length} jobs for processing.`,
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
            `No processor handler found for queue: [${rawJob.queueName}]. Marking as temporary error.`,
          );
          await this.handleJobFailure(
            rawJob,
            new Error(`No processor registered for queue "${rawJob.queueName}"`),
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
          this.logger.log(`Job id ${rawJob.id} [${rawJob.queueName}] completed successfully.`);
        } catch (execError: unknown) {
          this.logger.error(
            `Job id ${rawJob.id} [${rawJob.queueName}] failed: ${(execError as Error)?.message}`,
          );
          await this.handleJobFailure(rawJob, execError);
          failedCount++;
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `[EmbeddedQueueWorker] Error in processBatch process: ${(err as Error)?.message}`,
      );
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
    } catch (err: unknown) {
      // Fallback cho môi trường test mock hoặc MariaDB/DB không hỗ trợ cú pháp SKIP LOCKED
      this.logger.debug?.(
        `[EmbeddedQueueWorker] Fallback atomic query because SKIP LOCKED is not supported: ${(err as Error)?.message}`,
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
  private async handleJobFailure(rawJob: any, error: unknown): Promise<void> {
    const nextAttempts = (rawJob.attempts || 0) + 1;
    const maxAttempts = rawJob.maxAttempts || 3;
    const errorMessage = (error as Error)?.message || String(error);
    const errorStack = (error as Error)?.stack || errorMessage;

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
        `Job id ${rawJob.id} will be retried (attempt ${nextAttempts}/${maxAttempts}) at ${nextRunAt.toISOString()}.`,
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
        `Job id ${rawJob.id} exceeded maximum ${maxAttempts} attempts. Moved to Dead Letter Queue (_system_jobs_dlq).`,
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
          `[EmbeddedQueueWorker] Recovered ${result.count} stuck expired jobs back to pending status.`,
        );
      }
      return result.count;
    } catch (err: unknown) {
      this.logger.warn(`Error recovering stuck jobs: ${(err as Error)?.message}`);
      return 0;
    }
  }
}
