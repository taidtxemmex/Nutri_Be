import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { I18nService } from '../../core/i18n/i18n.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Optional() private readonly i18nService?: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Nếu response headers đã được gửi (ví dụ: streaming file Excel bị lỗi giữa chừng), không set header lại
    if (response.headersSent) {
      this.logger.error(
        `[Stream Exception] Lỗi xảy ra sau khi headers đã gửi: ${
          exception instanceof Error ? exception.stack : exception
        }`,
      );
      return;
    }

    const traceId =
      (request.headers['x-trace-id'] as string) || (request as any).id || crypto.randomUUID();
    response.setHeader('X-Trace-Id', traceId);
    const timestamp = new Date().toISOString();
    const locale = request.locale || 'vi';

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
          message = this.i18nService
            ? this.i18nService.translate(errorCode, locale)
            : 'Dữ liệu đã tồn tại trong hệ thống (vi phạm tính duy nhất).';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          errorCode = 'RESOURCE_NOT_FOUND';
          message = this.i18nService
            ? this.i18nService.translate(errorCode, locale)
            : 'Bản ghi yêu cầu không tồn tại trong cơ sở dữ liệu';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          errorCode = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
          message = this.i18nService
            ? this.i18nService.translate(errorCode, locale)
            : 'Không thể thực hiện thao tác do dữ liệu đang được sử dụng ở bảng khác';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          errorCode = 'DATABASE_ERROR';
          message = this.i18nService
            ? this.i18nService.translate(errorCode, locale)
            : 'Lỗi xử lý cơ sở dữ liệu hệ thống.';
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

    if (this.i18nService) {
      const nestDefaultMessages = [
        'Not Found',
        'Bad Request',
        'Unauthorized',
        'Forbidden',
        'Conflict',
        'Internal Server Error',
        'Too Many Requests',
      ];

      if (nestDefaultMessages.includes(message) && this.i18nService.hasKey(errorCode)) {
        message = this.i18nService.translate(errorCode, locale);
      } else {
        const hasCatalogKey = this.i18nService.hasKey(message);
        const translated = this.i18nService.translateTextOrKey(message, locale);
        if (hasCatalogKey) {
          message = translated || this.i18nService.translate(message, locale);
        } else if (translated && translated !== message) {
          message = translated;
        } else if (this.i18nService.hasKey(errorCode)) {
          message = this.i18nService.translate(errorCode, locale);
        }
      }

      // Dịch chi tiết mảng details
      if (Array.isArray(details)) {
        details = details.map((item) => ({ ...item }));
        for (const item of details) {
          if (item.message) {
            const hasKey = this.i18nService.hasKey(item.message);
            const translated = this.i18nService.translateTextOrKey(item.message, locale);
            if (hasKey || (translated && translated !== item.message)) {
              item.message = translated;
            } else if (item.code && item.field) {
              item.message = this.i18nService.translateValidationConstraint({
                code: item.code,
                field: item.field,
                locale,
              });
            } else {
              item.message = translated;
            }
          } else if (item.code && item.field) {
            item.message = this.i18nService.translateValidationConstraint({
              code: item.code,
              field: item.field,
              locale,
            });
          }
        }
      }
    }

    response.status(status).json({
      message, // Root-level alias for NutriFE frontend compatibility (P0 parity)
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
