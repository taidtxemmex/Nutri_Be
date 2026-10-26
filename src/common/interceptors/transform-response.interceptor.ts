import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface StandardResponse<T> {
  data: T;
  meta: Record<string, any>;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T> | T
> {
  private reflector = new Reflector();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isSkipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipTransform) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const httpResponse = context.switchToHttp().getResponse();
    const traceId = request.headers['x-trace-id'] || 'trace-local';

    return next.handle().pipe(
      map((response) => {
        const timestamp = new Date().toISOString();
        const statusCode = httpResponse?.statusCode || 200;

        // 1. Stream file (Excel, PDF)
        if (response && response.isStream) {
          return response;
        }

        // 2. Paginated list: { items, total, page, limit }
        if (response && Array.isArray(response.items) && typeof response.total === 'number') {
          const page = Number(response.page) || 1;
          const limit = Number(response.limit) || response.items.length;
          const totalPages = Math.ceil(response.total / limit) || 1;

          return {
            status: statusCode,
            message: 'success',
            data: response.items,
            content: response.items,
            meta: {
              page,
              limit,
              totalItems: response.total,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
              timestamp,
              traceId,
            },
          };
        }

        // 3. Single Entity or Mutation
        return {
          status: statusCode,
          message: 'success',
          data: response ?? null,
          meta: {
            timestamp,
            traceId,
          },
        };
      }),
    );
  }
}
