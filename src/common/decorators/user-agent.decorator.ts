import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Trích xuất chuỗi User-Agent của Client
 *
 * Cách dùng:
 * async login(@UserAgent() userAgent: string) { ... }
 */
export const UserAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return (request.headers['user-agent'] as string) || '';
});
