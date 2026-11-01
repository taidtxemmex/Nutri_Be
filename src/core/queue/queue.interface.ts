export interface EnqueueOptions {
  priority?: number;
  runAt?: Date;
  delayMs?: number;
  maxAttempts?: number;
}

export interface Job<T = any> {
  id: string | bigint;
  queueName: string;
  payload: T;
  status: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
  runAt: Date;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DlqJob<T = any> {
  id: string | bigint;
  originalJobId: string | bigint;
  queueName: string;
  payload: T;
  errorStack?: string | null;
  failedAt: Date;
}

export type JobHandler<T = any, R = any> = (payload: T, job: Job<T>) => Promise<R>;

/**
 * Universal QueueService interface across all broker implementations
 * (Embedded MySQL SKIP LOCKED, SQLite WAL queue, BullMQ/Redis, pg-boss)
 */
export interface QueueService {
  enqueue<T = any>(queueName: string, payload: T, options?: EnqueueOptions): Promise<Job<T>>;
  process<T = any, R = any>(queueName: string, handler: JobHandler<T, R>): void;
  getDlq(queueName?: string, limit?: number): Promise<DlqJob[]>;
  retry(jobId: string | bigint | number): Promise<boolean>;
}

export const QUEUE_SERVICE_TOKEN = 'QueueService';
