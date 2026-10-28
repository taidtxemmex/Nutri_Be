import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';

/**
 * ThrottlerBehindProxyGuard
 * Bảo vệ ứng dụng chống tấn công DDoS & Brute-Force phía sau Nginx Reverse Proxy
 * - Trích xuất chính xác địa chỉ IP gốc của Client qua X-Forwarded-For
 * - Trả về header Retry-After theo tiêu chuẩn RFC 7231
 * - Chuẩn hóa mã phản hồi lỗi 429 Too Many Requests
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: any): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const url = req?.originalUrl || req?.url || '';

    // Chỉ áp dụng throttler 'auth' cho các endpoint đăng nhập / đăng ký
    if (
      throttler?.name === 'auth' &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register')
    ) {
      return true;
    }

    // Chỉ áp dụng throttler 'sensitive' cho các endpoint quên / đặt lại mật khẩu
    if (
      throttler?.name === 'sensitive' &&
      !url.includes('/auth/forgot-password') &&
      !url.includes('/auth/reset-password')
    ) {
      return true;
    }

    return super.handleRequest(requestProps);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // Lấy địa chỉ IP đầu tiên trong chuỗi proxy (Client IP thực tế)
      return Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
    }
    return req.ips?.length ? req.ips[0] : req.ip || 'unknown-client';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const retryAfter = Math.ceil(throttlerLimitDetail.timeToBlockExpire / 1000) || 60;

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', retryAfter.toString());
    }

    throw new HttpException(
      {
        code: 'TOO_MANY_REQUESTS',
        message: `Bạn đã thực hiện quá nhiều yêu cầu vượt ngưỡng cho phép. Vui lòng thử lại sau ${retryAfter} giây.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
