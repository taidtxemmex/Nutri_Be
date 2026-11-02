import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor';
import { Reflector } from '@nestjs/core';

describe('TransformResponseInterceptor - Standard Response Envelope', () => {
  let interceptor: TransformResponseInterceptor<any>;
  let mockReflector: Reflector;

  beforeEach(() => {
    interceptor = new TransformResponseInterceptor();
    mockReflector = (interceptor as any).reflector;
  });

  function createMockExecutionContext(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    isSkipTransform?: boolean;
  }): ExecutionContext {
    const request = {
      method: options.method || 'GET',
      url: options.url || '/api/users/profile',
      headers: options.headers || {},
    };

    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    jest
      .spyOn(mockReflector, 'getAllAndOverride')
      .mockReturnValue(Boolean(options.isSkipTransform));

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  function createMockCallHandler(returnValue: any): CallHandler {
    return {
      handle: () => of(returnValue),
    };
  }

  it('should wrap single entity into standard envelope { data, meta: { timestamp, traceId } }', (done) => {
    const context = createMockExecutionContext({
      headers: { 'x-trace-id': 'custom-trace-uuid-123' },
    });
    const entity = { id: 10, username: 'testuser', email: 'test@example.com' };
    const handler = createMockCallHandler(entity);

    interceptor.intercept(context, handler).subscribe({
      next: (result) => {
        expect(result.data).toEqual(entity);
        expect(result.meta).toBeDefined();
        expect(result.meta.traceId).toBe('custom-trace-uuid-123');
        expect(result.meta.timestamp).toBeDefined();
        expect(result.status).toBe(200);
        expect(result.message).toBe('success');
        done();
      },
      error: done.fail,
    });
  });

  it('should wrap paginated list into standard list envelope with full pagination metadata', (done) => {
    const context = createMockExecutionContext({});
    const paginatedData = {
      items: [{ id: 1 }, { id: 2 }],
      total: 100,
      page: 2,
      limit: 10,
    };
    const handler = createMockCallHandler(paginatedData);

    interceptor.intercept(context, handler).subscribe({
      next: (result) => {
        expect(result.data).toEqual(paginatedData.items);
        expect(result.meta.page).toBe(2);
        expect(result.meta.limit).toBe(10);
        expect(result.meta.totalItems).toBe(100);
        expect(result.meta.totalPages).toBe(10);
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPreviousPage).toBe(true);
        done();
      },
      error: done.fail,
    });
  });

  it('should bypass transformation when @SkipTransform() decorator is present', (done) => {
    const context = createMockExecutionContext({ isSkipTransform: true });
    const rawData = 'RAW_BINARY_OR_EXCEL_STREAM';
    const handler = createMockCallHandler(rawData);

    interceptor.intercept(context, handler).subscribe({
      next: (result) => {
        expect(result).toBe(rawData);
        done();
      },
      error: done.fail,
    });
  });

  it('should preserve legacy raw array GET routes for NutriFE compatibility', (done) => {
    const context = createMockExecutionContext({
      method: 'GET',
      url: '/api/disease-groups',
    });
    const rawItems = [
      { id: 1, name: 'Nhóm 1' },
      { id: 2, name: 'Nhóm 2' },
    ];
    const handler = createMockCallHandler(rawItems);

    interceptor.intercept(context, handler).subscribe({
      next: (result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual(rawItems);
        done();
      },
      error: done.fail,
    });
  });
});
