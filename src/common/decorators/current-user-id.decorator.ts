import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Trích xuất trực tiếp User ID (UUID) từ JWT payload trong request
 *
 * Cách dùng:
 * async getMe(@CurrentUserId() userId: string) { ... }
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id || request.user?.userId;
  },
);
