import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';

const SENSITIVE_KEYS = new Set([
  'password',
  'matkhau',
  'mat_khau',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'cookie',
]);

/**
 * Hàm làm sạch và ẩn thông tin nhạy cảm trong payload trước khi ghi log
 */
export function maskSensitivePayload(payload: any, maxDepth = 4): any {
  if (!payload || typeof payload !== 'object' || maxDepth <= 0) {
    return payload;
  }

  if (Array.isArray(payload)) {
    if (payload.length > 30) {
      return `[Array with ${payload.length} items (truncated)]`;
    }
    return payload.map((item) => maskSensitivePayload(item, maxDepth - 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '***[REDACTED]***';
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `${value.substring(0, 50)}... [TRUNCATED len:${value.length}]`;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = maskSensitivePayload(value, maxDepth - 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * RequestLoggingInterceptor: Tự động ghi nhận chi tiết mọi HTTP Request & Response kèm Payload
 * - Gắn hoặc tái sử dụng traceId thống nhất cho mỗi request
 * - Đo đạc thời gian xử lý chính xác (execution duration in ms)
 * - Tự động che giấu mật khẩu, token, thông tin nhạy cảm (Security Defense)
 * - Phục vụ truy vết (tracing) và phân tích nguyên nhân lỗi (RCA) trong sản xuất
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const startTime = Date.now();

    // 1. Tạo hoặc lấy traceId
    const traceId =
      req.headers['x-trace-id'] ||
      req.headers['x-request-id'] ||
      req.traceId ||
      crypto.randomUUID();

    req.traceId = traceId;
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-Trace-Id', traceId);
    }

    const method = req.method || 'GET';
    const url = req.originalUrl || req.url || '';
    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';

    const userId = req.user?.id || 'anonymous';
    const sanitizedBody = maskSensitivePayload(req.body);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res?.statusCode || 200;

        const logMessage = `[${traceId}] ${method} ${url} ${statusCode} +${duration}ms - user:${userId}`;

        const metadata = {
          traceId,
          method,
          url,
          statusCode,
          durationMs: duration,
          ip,
          userId,
          payload:
            method !== 'GET' && sanitizedBody && Object.keys(sanitizedBody).length > 0
              ? sanitizedBody
              : undefined,
        };

        this.logger.log(logMessage, JSON.stringify(metadata));
      }),
      catchError((error: any) => {
        const duration = Date.now() - startTime;
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : error.status || 500;

        const logMessage = `[${traceId}] ${method} ${url} ${statusCode} +${duration}ms - Error: ${error.message} - user:${userId}`;

        const metadata = {
          traceId,
          method,
          url,
          statusCode,
          durationMs: duration,
          ip,
          userId,
          payload:
            method !== 'GET' && sanitizedBody && Object.keys(sanitizedBody).length > 0
              ? sanitizedBody
              : undefined,
          errorName: error.name,
          errorMessage: error.message,
        };

        if (statusCode >= 500) {
          this.logger.error(logMessage, error.stack, JSON.stringify(metadata));
        } else {
          this.logger.warn(logMessage, JSON.stringify(metadata));
        }

        throw error;
      }),
    );
  }
}
