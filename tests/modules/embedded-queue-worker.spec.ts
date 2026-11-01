import { MysqlQueueService } from '../../src/core/queue/mysql-queue.service';
import { EmbeddedQueueWorkerService } from '../../src/core/queue/embedded-queue-worker.service';
import { InMemoryMailerService } from '../../src/core/queue/in-memory-mailer.service';

describe('EmbeddedQueueWorker & QueueService Tests (Task 7.4)', () => {
  let queueService: MysqlQueueService;
  let worker: EmbeddedQueueWorkerService;
  let inMemoryMailer: InMemoryMailerService;

  // In-memory Layer 3 DB tables for _system_jobs and _system_jobs_dlq
  let jobsTable: any[] = [];
  let dlqTable: any[] = [];
  let nextJobId = 1n;
  let nextDlqId = 1n;

  let mockPrisma: any;

  beforeEach(() => {
    jobsTable = [];
    dlqTable = [];
    nextJobId = 1n;
    nextDlqId = 1n;

    mockPrisma = {
      systemJob: {
        create: jest.fn(async ({ data }: any) => {
          const id = nextJobId++;
          const row = {
            id,
            queueName: data.queueName,
            payload: data.payload,
            status: data.status || 'pending',
            attempts: data.attempts || 0,
            maxAttempts: data.maxAttempts || 3,
            runAt: data.runAt || new Date(),
            priority: data.priority || 0,
            lockedBy: null,
            lockedAt: null,
            lastError: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          jobsTable.push(row);
          return row;
        }),

        findUnique: jest.fn(async ({ where }: any) => {
          const targetId = BigInt(where.id);
          return jobsTable.find((j) => BigInt(j.id) === targetId) || null;
        }),

        findMany: jest.fn(async (params?: any) => {
          let rows = [...jobsTable];
          if (params?.where?.id?.in) {
            const inIds = params.where.id.in.map((i: any) => BigInt(i));
            rows = rows.filter((r) => inIds.includes(BigInt(r.id)));
          }
          if (params?.where?.status?.in) {
            const allowed = params.where.status.in;
            rows = rows.filter((r) => allowed.includes(r.status));
          }
          if (params?.where?.runAt?.lte) {
            const maxRunAt = params.where.runAt.lte;
            rows = rows.filter((r) => r.runAt <= maxRunAt);
          }
          if (params?.where?.lockedBy === null) {
            rows = rows.filter((r) => r.lockedBy === null);
          }

          // Order by priority desc, id asc
          rows.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.id < b.id ? -1 : 1;
          });

          if (params?.take) {
            rows = rows.slice(0, params.take);
          }
          return rows;
        }),

        update: jest.fn(async ({ where, data }: any) => {
          const targetId = BigInt(where.id);
          const job = jobsTable.find((j) => BigInt(j.id) === targetId);
          if (!job) throw new Error(`Job not found: ${where.id}`);
          Object.assign(job, data, { updatedAt: new Date() });
          return job;
        }),

        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          let inIds: bigint[] = [];
          if (where?.id?.in) {
            inIds = where.id.in.map((i: any) => BigInt(i));
          }
          for (const job of jobsTable) {
            if (inIds.length === 0 || inIds.includes(BigInt(job.id))) {
              Object.assign(job, data, { updatedAt: new Date() });
              count++;
            }
          }
          return { count };
        }),
      },

      systemJobDlq: {
        create: jest.fn(async ({ data }: any) => {
          const id = nextDlqId++;
          const row = {
            id,
            originalJobId: BigInt(data.originalJobId),
            queueName: data.queueName,
            payload: data.payload,
            errorStack: data.errorStack,
            failedAt: data.failedAt || new Date(),
          };
          dlqTable.push(row);
          return row;
        }),

        findMany: jest.fn(async (params?: any) => {
          let rows = [...dlqTable];
          if (params?.where?.queueName) {
            rows = rows.filter((r) => r.queueName === params.where.queueName);
          }
          if (params?.take) {
            rows = rows.slice(0, params.take);
          }
          return rows;
        }),

        deleteMany: jest.fn(async ({ where }: any) => {
          let count = 0;
          if (where?.originalJobId) {
            const origId = BigInt(where.originalJobId);
            const beforeLen = dlqTable.length;
            dlqTable = dlqTable.filter((r) => BigInt(r.originalJobId) !== origId);
            count = beforeLen - dlqTable.length;
          }
          return { count };
        }),
      },

      $queryRaw: jest.fn(async () => {
        // Fallback to standard mock logic
        throw new Error('MOCK_RAW_FALLBACK');
      }),

      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma);
      }),
    };

    inMemoryMailer = new InMemoryMailerService();
    queueService = new MysqlQueueService(mockPrisma);
    worker = new EmbeddedQueueWorkerService(mockPrisma, queueService, inMemoryMailer);
  });

  afterEach(() => {
    worker.stopWorker();
  });

  describe('Happy Path: Email Queue & InMemory Mailer', () => {
    it('bơm 5 jobs email vào bảng _system_jobs; kích hoạt worker; Layer 3 kiểm tra các job chuyển trạng thái completed, In-Memory Mailer nhận đủ 5 email', async () => {
      // 1. Khởi tạo worker module để đăng ký default handlers ('mail:send')
      await worker.onModuleInit();
      worker.stopWorker(); // Dừng auto timer để kích hoạt batch thủ công

      // 2. Bơm 5 jobs email vào bảng _system_jobs
      const emailJobs = [
        {
          to: 'bs_minhanh@benhvien.vn',
          subject: 'Thực đơn lâm sàng BN #101',
          body: 'Chi tiết can thiệp calo 1800 kcal',
        },
        {
          to: 'bs_hoangnam@benhvien.vn',
          subject: 'Cảnh báo giới hạn Kali BN #102',
          body: 'Chỉ số Kali vượt ngưỡng an toàn',
        },
        {
          to: 'bn_thanhhang@gmail.com',
          subject: 'Thực đơn tuần 4',
          body: 'Thực đơn giảm muối cho bệnh nhân tăng huyết áp',
        },
        {
          to: 'admin@truenutri.com',
          subject: 'Báo cáo tổng hợp ngày',
          body: 'Tổng số 42 thực đơn đã xuất bản hôm nay',
        },
        {
          to: 'support@nutri.vn',
          subject: 'Đăng ký PRO thành công',
          body: 'Tài khoản của bạn đã được nâng cấp lên PRO 12 tháng',
        },
      ];

      for (const mail of emailJobs) {
        await queueService.enqueue('mail:send', mail);
      }

      // Assert Layer 3: CSDL có 5 jobs ở trạng thái pending
      expect(jobsTable.length).toBe(5);
      expect(jobsTable.every((j) => j.status === 'pending')).toBe(true);
      expect(inMemoryMailer.getEmailCount()).toBe(0);

      // 3. Kích hoạt worker xử lý batch
      const batchResult = await worker.processBatch(10);

      // 4. Assert Layer 3: Kiểm tra các job chuyển trạng thái 'completed'
      expect(batchResult.claimedCount).toBe(5);
      expect(batchResult.successCount).toBe(5);
      expect(batchResult.failedCount).toBe(0);

      expect(jobsTable.length).toBe(5);
      for (const job of jobsTable) {
        expect(job.status).toBe('completed');
        expect(job.lockedBy).toBeNull();
        expect(job.lastError).toBeNull();
      }

      // 5. In-Memory Mailer nhận đủ 5 email
      expect(inMemoryMailer.getEmailCount()).toBe(5);
      const sentEmails = inMemoryMailer.getSentEmails();
      expect(sentEmails.map((e) => e.to)).toEqual([
        'bs_minhanh@benhvien.vn',
        'bs_hoangnam@benhvien.vn',
        'bn_thanhhang@gmail.com',
        'admin@truenutri.com',
        'support@nutri.vn',
      ]);
    });
  });

  describe('Job Failure, Exponential Backoff & Dead Letter Queue (DLQ)', () => {
    it('should retry failed job with exponential backoff if attempts < maxAttempts', async () => {
      let callCount = 0;
      queueService.process('failing:job', async () => {
        callCount++;
        throw new Error('External API Gateway Timeout');
      });

      // Enqueue job với maxAttempts = 3
      const enqueued = await queueService.enqueue(
        'failing:job',
        { reportId: 456 },
        { maxAttempts: 3 },
      );

      // Lần chạy 1: Job thất bại (attempts = 1 < 3) -> chuyển lại pending, lùi run_at
      const nowBefore = Date.now();
      const batchResult = await worker.processBatch();

      expect(batchResult.failedCount).toBe(1);
      expect(callCount).toBe(1);

      // Layer 3 Assertion: job vẫn ở _system_jobs, status = 'pending', attempts = 1
      const jobInDb = jobsTable.find((j) => j.id.toString() === enqueued.id.toString());
      expect(jobInDb.status).toBe('pending');
      expect(jobInDb.attempts).toBe(1);
      expect(jobInDb.lastError).toBe('External API Gateway Timeout');
      expect(new Date(jobInDb.runAt).getTime()).toBeGreaterThan(nowBefore);

      // Chưa bị đẩy vào DLQ
      expect(dlqTable.length).toBe(0);
    });

    it('should move job to DLQ and mark status failed when attempts reach maxAttempts', async () => {
      queueService.process('fatal:task', async () => {
        throw new Error('Fatal Unrecoverable Exception');
      });

      // Tạo job với maxAttempts = 2 và đã có attempts = 1
      const created = await queueService.enqueue(
        'fatal:task',
        { orderId: 789 },
        { maxAttempts: 2 },
      );
      const jobInDb = jobsTable.find((j) => j.id.toString() === created.id.toString());
      jobInDb.attempts = 1;

      // Xử lý lần tiếp theo (lần thứ 2/2 -> vượt quá maxAttempts)
      const batchResult = await worker.processBatch();

      expect(batchResult.failedCount).toBe(1);

      // Layer 3 Assertion: job trong _system_jobs có status = 'failed'
      expect(jobInDb.status).toBe('failed');
      expect(jobInDb.attempts).toBe(2);

      // Đã được ghi vào bảng _system_jobs_dlq
      expect(dlqTable.length).toBe(1);
      expect(dlqTable[0].originalJobId.toString()).toBe(created.id.toString());
      expect(dlqTable[0].queueName).toBe('fatal:task');
      expect(dlqTable[0].errorStack).toContain('Fatal Unrecoverable Exception');

      // Kiểm tra API getDlq của QueueService
      const dlqList = await queueService.getDlq('fatal:task');
      expect(dlqList.length).toBe(1);
      expect(dlqList[0].payload).toEqual({ orderId: 789 });
    });

    it('should allow retrying a job from DLQ via queueService.retry(id)', async () => {
      // Giả lập 1 job đã failed và nằm trong DLQ
      const created = await queueService.enqueue('retry:task', { syncId: 999 });
      const jobInDb = jobsTable.find((j) => j.id.toString() === created.id.toString());
      jobInDb.status = 'failed';
      jobInDb.attempts = 3;

      await mockPrisma.systemJobDlq.create({
        data: {
          originalJobId: jobInDb.id,
          queueName: 'retry:task',
          payload: JSON.stringify({ syncId: 999 }),
          errorStack: 'Test Error',
        },
      });

      expect(dlqTable.length).toBe(1);

      // Gọi retry
      const success = await queueService.retry(jobInDb.id);
      expect(success).toBe(true);

      // Layer 3 Assertion: Job trở lại pending, attempts = 0
      expect(jobInDb.status).toBe('pending');
      expect(jobInDb.attempts).toBe(0);

      // Bản ghi trong DLQ đã được xóa
      expect(dlqTable.length).toBe(0);
    });
  });

  describe('Priority and Scheduling', () => {
    it('should process higher priority jobs first', async () => {
      const processedOrder: string[] = [];
      queueService.process('prio:queue', async (payload: any) => {
        processedOrder.push(payload.name);
      });

      // Enqueue job priority thấp (0) trước, sau đó priority cao (10)
      await queueService.enqueue('prio:queue', { name: 'Low Priority Job' }, { priority: 0 });
      await queueService.enqueue('prio:queue', { name: 'High Priority Job' }, { priority: 10 });

      // Chạy 1 batch xử lý cả 2
      await worker.processBatch(10);

      expect(processedOrder).toEqual(['High Priority Job', 'Low Priority Job']);
    });

    it('should not process jobs scheduled for future (run_at > now)', async () => {
      const executed: string[] = [];
      queueService.process('future:queue', async (payload: any) => {
        executed.push(payload.id);
      });

      // Enqueue 1 job ngay bây giờ, 1 job trễ 1 tiếng
      await queueService.enqueue('future:queue', { id: 'immediate' }, { delayMs: 0 });
      await queueService.enqueue('future:queue', { id: 'delayed' }, { delayMs: 3600 * 1000 });

      await worker.processBatch(10);

      expect(executed).toEqual(['immediate']);
      const delayedJob = jobsTable.find((j) => JSON.parse(j.payload).id === 'delayed');
      expect(delayedJob.status).toBe('pending');
    });
  });

  describe('Worker Lifecycle', () => {
    it('should cleanly start and stop worker polling', () => {
      worker.startWorker();
      expect(worker.isWorkerRunning()).toBe(true);

      worker.stopWorker();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });
});
