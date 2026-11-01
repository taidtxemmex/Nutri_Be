import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  ExcelThrottleGuard,
  THROTTLE_EXCEL_EXPORT_KEY,
} from '../../src/security/excel/excel-throttle.guard';

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
}

function createMockContext(handler: any, response: MockResponse): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as any;
}

describe('ExcelConcurrencyQueue & Throttler Tests (VPS 1 Core 2GB Protection)', () => {
  let guard: ExcelThrottleGuard;

  beforeEach(() => {
    ExcelThrottleGuard.resetActiveJobs();
    guard = new ExcelThrottleGuard();
  });

  afterEach(() => {
    ExcelThrottleGuard.resetActiveJobs();
  });

  it('should throttle 10 simultaneous parallel export requests: allow 2 and reject 8 with 429 TOO_MANY_REQUESTS', async () => {
    const handler = () => {};
    Reflect.defineMetadata(THROTTLE_EXCEL_EXPORT_KEY, { maxConcurrent: 2 }, handler);

    const TOTAL_REQUESTS = 10;
    const responses: MockResponse[] = [];
    const contexts: ExecutionContext[] = [];

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      const res = new MockResponse();
      responses.push(res);
      contexts.push(createMockContext(handler, res));
    }

    // Bắn 10 request export đồng thời song song
    const executionResults = await Promise.allSettled(
      contexts.map((ctx) =>
        Promise.resolve().then(() => {
          return guard.canActivate(ctx);
        }),
      ),
    );

    const accepted = executionResults.filter(
      (r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled' && r.value === true,
    );
    const rejected = executionResults.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    // Khẳng định Semaphore khống chế tối đa 2 tiến trình export nặng chạy song song
    expect(accepted.length).toBe(2);
    // Request thứ 3 trở đi nhận phản hồi 429 Too Many Requests
    expect(rejected.length).toBe(8);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(2);

    // Kiểm tra cấu trúc lỗi 429 của toàn bộ 8 request bị từ chối
    for (const rej of rejected) {
      const err = rej.reason;
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.getResponse()).toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    }

    // Giả lập 2 tác vụ đầu hoàn tất xuất dữ liệu (emit 'finish')
    responses[0].emit('finish');
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(1);

    responses[1].emit('finish');
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(0);

    // Sau khi giải phóng, các request tiếp theo có thể thực thi thành công
    const nextRes = new MockResponse();
    const nextCtx = createMockContext(handler, nextRes);
    expect(guard.canActivate(nextCtx)).toBe(true);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(1);

    nextRes.emit('finish');
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(0);
  });

  it('should handle sudden client socket disconnect mid-stream (close event) without leaking semaphore', () => {
    const handler = () => {};
    Reflect.defineMetadata(THROTTLE_EXCEL_EXPORT_KEY, { maxConcurrent: 2 }, handler);

    const res1 = new MockResponse();
    const res2 = new MockResponse();
    const ctx1 = createMockContext(handler, res1);
    const ctx2 = createMockContext(handler, res2);

    expect(guard.canActivate(ctx1)).toBe(true);
    expect(guard.canActivate(ctx2)).toBe(true);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(2);

    // 3rd request is blocked
    const res3 = new MockResponse();
    const ctx3 = createMockContext(handler, res3);
    expect(() => guard.canActivate(ctx3)).toThrow(HttpException);

    // Client 1 suddenly drops connection mid-stream (e.g. browser tab closed, network packet dropped)
    res1.emit('close');
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(1);

    // Request 3 can now acquire the freed slot immediately
    expect(guard.canActivate(ctx3)).toBe(true);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(2);

    // Clean up
    res2.emit('close');
    res3.emit('finish');
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(0);
  });

  it('should handle socket error events gracefully and release semaphore locks', () => {
    const handler = () => {};
    Reflect.defineMetadata(THROTTLE_EXCEL_EXPORT_KEY, { maxConcurrent: 2 }, handler);

    const res1 = new MockResponse();
    const ctx1 = createMockContext(handler, res1);
    expect(guard.canActivate(ctx1)).toBe(true);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(1);

    // Emit socket error (e.g. ECONNRESET or EPIPE)
    res1.emit('error', new Error('ECONNRESET: Client abruptly closed connection'));
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(0);
  });

  it('should pass-through requests on routes without @ThrottleExcelExport decorator', () => {
    const unthrottledHandler = () => {};
    const res = new MockResponse();
    const ctx = createMockContext(unthrottledHandler, res);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ExcelThrottleGuard.getActiveJobs()).toBe(0);
  });
});
