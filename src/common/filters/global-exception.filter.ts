import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = (request.headers['x-trace-id'] as string) || 'trace-unknown';
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Hệ thống gặp sự cố bất ngờ. Vui lòng liên hệ quản trị viên.';
    let details: any = undefined;

    // 1. HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      if (typeof res === 'object') {
        errorCode = res.code || this.mapStatusToErrorCode(status);
        message = res.message || exception.message;
        details = res.details;

        if (Array.isArray(res.message)) {
          errorCode = 'VALIDATION_FAILED';
          message = 'Dữ liệu gửi lên không đúng định dạng';
          details = res.message.map((msg: string) => ({ message: msg }));
        }
      } else {
        message = res;
        errorCode = this.mapStatusToErrorCode(status);
      }
    }
    // 2. Prisma ORM errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          errorCode = 'DATA_CONFLICT';
          const fields = (exception.meta?.target as string[]) || [];
          message = `Dữ liệu bị trùng lặp ở trường: ${fields.join(', ')}`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          errorCode = 'RESOURCE_NOT_FOUND';
          message = 'Bản ghi yêu cầu không tồn tại trong cơ sở dữ liệu';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          errorCode = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
          message = 'Không thể thực hiện thao tác do dữ liệu đang được sử dụng ở bảng khác';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          errorCode = `DATABASE_ERROR_${exception.code}`;
          message = 'Lỗi truy vấn cơ sở dữ liệu';
      }
    }
    // 3. Unknown errors
    else {
      const err = exception as Error;
      this.logger.error(
        `[500 ERROR] Trace: ${traceId} | Path: ${request.method} ${request.url} | Error: ${err?.message}`,
        err?.stack,
      );
    }

    response.status(status).json({
      error: {
        code: errorCode,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        timestamp,
        traceId,
      },
    });
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN_RESOURCE';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
