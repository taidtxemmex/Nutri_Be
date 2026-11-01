import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface StandardResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

const LEGACY_RAW_ARRAY_PATTERNS: readonly RegExp[] = [
  /^\/api\/categor(y|ies)(\/public-lookup)?\/?$/i,
  /^\/api\/coefficients(\/(public|my))?\/?$/i,
  /^\/api\/daily-intakes\/patient\/[^/]+\/?$/i,
  /^\/api\/dish(es)?(\/(public|my|admin|autocomplete))?\/?$/i,
  /^\/api\/disease-groups\/?$/i,
  /^\/api\/extended-disease-groups\/?$/i,
  /^\/api\/ingredients?\/(summary|all)\/?$/i,
  /^\/api\/meals?\/?$/i,
  /^\/api\/menus?\/?$/i,
  /^\/api\/nutrition-limit-sets\/?$/i,
  /^\/api\/patients\/?$/i,
  /^\/api\/proposers?\/?$/i,
];

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T> | T | any
> {
  private reflector = new Reflector();

  isLegacyRawArrayRoute(method: string, url: string): boolean {
    if ((method || '').toUpperCase() !== 'GET') {
      return false;
    }
    const cleanPath = (url || '').split('?')[0];
    if (cleanPath.toLowerCase().startsWith('/api/v1/')) {
      return false;
    }
    return LEGACY_RAW_ARRAY_PATTERNS.some((pattern) => pattern.test(cleanPath));
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T> | T | any> {
    const isSkipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipTransform) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const httpResponse = context.switchToHttp().getResponse();
    const traceId =
      (request.headers['x-trace-id'] as string) ||
      (request as { id?: string }).id ||
      crypto.randomUUID();
    if (httpResponse && typeof httpResponse.setHeader === 'function') {
      httpResponse.setHeader('X-Trace-Id', traceId);
    }

    const reqMethod = request?.method || 'GET';
    const reqUrl = request?.originalUrl || request?.url || '';

    return next.handle().pipe(
      map((response) => {
        const timestamp = new Date().toISOString();
        const statusCode = httpResponse?.statusCode || 200;

        // 1. Stream file (Excel, PDF, StreamableFile, Writable/Readable)
        if (
          response &&
          (response.isStream ||
            typeof response.pipe === 'function' ||
            typeof response.getStream === 'function' ||
            response.constructor?.name === 'StreamableFile')
        ) {
          return response;
        }

        // 1b. Legacy Java Raw-Array GET routes (NutriFE expects Array.isArray(res.data))
        if (this.isLegacyRawArrayRoute(reqMethod, reqUrl)) {
          if (response && Array.isArray((response as { items?: unknown[] }).items)) {
            return (response as { items: unknown[] }).items;
          }
          if (Array.isArray(response)) {
            return response;
          }
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
            items: response.items,
            content: response.items,
            totalItems: response.total,
            totalElements: response.total,
            totalPages,
            page,
            size: limit,
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
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          const resObj = response as Record<string, unknown>;
          return {
            ...response,
            status: typeof resObj.status === 'string' ? resObj.status : statusCode,
            message: (typeof resObj.message === 'string' ? resObj.message : '') || 'success',
            data: response,
            meta: {
              timestamp,
              traceId,
            },
          };
        }

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
