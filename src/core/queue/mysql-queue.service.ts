import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService, EnqueueOptions, Job, DlqJob, JobHandler } from './queue.interface';

export interface EnqueueJobParamDto<T = any> {
  queueName: string;
  payload: T;
  options?: EnqueueOptions;
}

export interface ProcessJobParamDto<T = any, R = any> {
  queueName: string;
  handler: JobHandler<T, R>;
}

export interface GetDlqParamDto {
  queueName?: string;
  limit?: number;
}

@Injectable()
export class MysqlQueueService implements QueueService {
  private readonly logger = new Logger(MysqlQueueService.name);
  private readonly handlers = new Map<string, JobHandler<any, any>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đẩy một công việc mới vào hàng đợi CSDL _system_jobs
   */
  async enqueue<T = any>(
    paramOrQueueName: EnqueueJobParamDto<T> | string,
    legacyPayload?: T,
    legacyOptions?: EnqueueOptions,
  ): Promise<Job<T>> {
    let queueName: string;
    let payload: T;
    let options: EnqueueOptions | undefined;

    if (
      paramOrQueueName &&
      typeof paramOrQueueName === 'object' &&
      'queueName' in paramOrQueueName &&
      'payload' in paramOrQueueName
    ) {
      queueName = paramOrQueueName.queueName;
      payload = paramOrQueueName.payload;
      options = paramOrQueueName.options;
    } else {
      queueName = paramOrQueueName as string;
      payload = legacyPayload as T;
      options = legacyOptions;
    }

    const runAt =
      options?.runAt || (options?.delayMs ? new Date(Date.now() + options.delayMs) : new Date());
    const priority = options?.priority ?? 0;
    const maxAttempts = options?.maxAttempts ?? 3;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const created = await this.prisma.systemJob.create({
      data: {
        queueName,
        payload: payloadStr,
        status: 'pending',
        attempts: 0,
        maxAttempts,
        priority,
        runAt,
      },
    });

    return this.mapToJob<T>(created, payload);
  }

  /**
   * Đăng ký một processor handler cho queueName
   */
  process<T = any, R = any>(
    paramOrQueueName: ProcessJobParamDto<T, R> | string,
    legacyHandler?: JobHandler<T, R>,
  ): void {
    let queueName: string;
    let handler: JobHandler<T, R>;

    if (
      paramOrQueueName &&
      typeof paramOrQueueName === 'object' &&
      'queueName' in paramOrQueueName &&
      'handler' in paramOrQueueName
    ) {
      queueName = paramOrQueueName.queueName;
      handler = paramOrQueueName.handler;
    } else {
      queueName = paramOrQueueName as string;
      handler = legacyHandler!;
    }

    if (this.handlers.has(queueName)) {
      this.logger.warn(`Processor cho queue "${queueName}" đã tồn tại. Đang ghi đè processor mới.`);
    }
    this.handlers.set(queueName, handler);
    this.logger.log(`Đã đăng ký processor thành công cho queue: [${queueName}]`);
  }

  /**
   * Lấy handler đã đăng ký cho queueName
   */
  getHandler(queueName: string): JobHandler<any, any> | undefined {
    return this.handlers.get(queueName);
  }

  /**
   * Kiểm tra queueName đã có handler đăng ký chưa
   */
  hasHandler(queueName: string): boolean {
    return this.handlers.has(queueName);
  }

  /**
   * Danh sách tất cả queues đã có handler
   */
  getRegisteredQueues(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Lấy danh sách jobs lỗi từ bảng Dead Letter Queue (_system_jobs_dlq)
   */
  async getDlq(paramOrQueueName?: GetDlqParamDto | string, legacyLimit = 100): Promise<DlqJob[]> {
    let queueName: string | undefined;
    let limit = 100;

    if (
      paramOrQueueName &&
      typeof paramOrQueueName === 'object' &&
      ('queueName' in paramOrQueueName || 'limit' in paramOrQueueName)
    ) {
      queueName = paramOrQueueName.queueName;
      limit = paramOrQueueName.limit ?? 100;
    } else {
      queueName = paramOrQueueName as string | undefined;
      limit = legacyLimit;
    }

    const records = await this.prisma.systemJobDlq.findMany({
      where: queueName ? { queueName } : undefined,
      take: limit,
      orderBy: { failedAt: 'desc' },
    });

    return records.map((r) => {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(r.payload);
      } catch {
        parsedPayload = r.payload;
      }

      return {
        id: r.id.toString(),
        originalJobId: r.originalJobId.toString(),
        queueName: r.queueName,
        payload: parsedPayload,
        errorStack: r.errorStack,
        failedAt: r.failedAt,
      };
    });
  }

  /**
   * Thử lại một job bị lỗi (chuyển lại status 'pending', reset attempts và run_at)
   */
  async retry(jobId: string | bigint | number): Promise<boolean> {
    const id = typeof jobId === 'bigint' ? jobId : BigInt(jobId);

    const job = await this.prisma.systemJob.findUnique({
      where: { id },
    });

    if (!job) {
      this.logger.warn(`Không tìm thấy job id ${jobId} để retry.`);
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.systemJob.update({
        where: { id },
        data: {
          status: 'pending',
          attempts: 0,
          runAt: new Date(),
          lockedBy: null,
          lockedAt: null,
          lastError: null,
        },
      });

      // Xóa bản ghi trong DLQ nếu có
      await tx.systemJobDlq.deleteMany({
        where: { originalJobId: id },
      });
    });

    this.logger.log(`Job id ${jobId} đã được đặt lại về hàng đợi để xử lý lại.`);
    return true;
  }

  private mapToJob<T>(dbJob: any, parsedPayload?: T): Job<T> {
    let payload = parsedPayload;
    if (payload === undefined) {
      try {
        payload = JSON.parse(dbJob.payload);
      } catch {
        payload = dbJob.payload as unknown as T;
      }
    }

    return {
      id: dbJob.id.toString(),
      queueName: dbJob.queueName,
      payload: payload as T,
      status: dbJob.status,
      attempts: dbJob.attempts,
      maxAttempts: dbJob.maxAttempts,
      priority: dbJob.priority,
      runAt: dbJob.runAt,
      lockedBy: dbJob.lockedBy,
      lockedAt: dbJob.lockedAt,
      lastError: dbJob.lastError,
      createdAt: dbJob.createdAt,
      updatedAt: dbJob.updatedAt,
    };
  }
}
