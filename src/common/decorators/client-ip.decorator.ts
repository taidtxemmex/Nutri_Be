import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Trích xuất địa chỉ IP thực của Client, hỗ trợ tự động giải mã qua Reverse Proxy (Nginx, Cloudflare, Traefik)
 *
 * Cách dùng:
 * async login(@ClientIp() ip: string) { ... }
 */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    if (ip) return ip;
  }

  return (
    (request.headers['cf-connecting-ip'] as string) ||
    (request.headers['x-real-ip'] as string) ||
    request.ip ||
    request.socket?.remoteAddress ||
    '127.0.0.1'
  );
});
