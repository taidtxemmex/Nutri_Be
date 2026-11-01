import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  THROTTLE_AUTH_LIMIT,
  THROTTLE_AUTH_TTL,
  THROTTLE_SENSITIVE_LIMIT,
  THROTTLE_SENSITIVE_TTL,
  THROTTLE_DEFAULT_LIMIT,
  THROTTLE_DEFAULT_TTL,
} from '../../config/constants/auth.constants';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, RateLimitBucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const xForwardedFor = request.headers['x-forwarded-for'];
    const ip =
      (xForwardedFor
        ? (Array.isArray(xForwardedFor)
            ? xForwardedFor[0]
            : xForwardedFor.toString().split(',')[0]
          ).trim()
        : null) ||
      (request.ips && request.ips.length ? request.ips[0] : null) ||
      request.ip ||
      request.socket?.remoteAddress ||
      request.connection?.remoteAddress ||
      'unknown-ip';

    const url = request.originalUrl || request.url || '';
    const method = request.method || 'GET';

    const { limit, ttl } = this.resolveLimits(url, method);
    const key = `${ip}:${method}:${url.split('?')[0]}`;
    const now = Date.now();

    let bucket = this.hits.get(key);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + ttl * 1000,
      };
      this.hits.set(key, bucket);
      this.cleanupOldBuckets(now);
      return true;
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      const retryAfterSeconds = Math.ceil((bucket.resetTime - now) / 1000);
      const response = context.switchToHttp().getResponse();
      if (response && response.setHeader) {
        response.setHeader('Retry-After', retryAfterSeconds);
      }

      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: `Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveLimits(url: string, _method: string): { limit: number; ttl: number } {
    if (url.includes('/auth/login') || url.includes('/auth/register')) {
      return { limit: THROTTLE_AUTH_LIMIT, ttl: THROTTLE_AUTH_TTL };
    }
    if (url.includes('/auth/forgot-password') || url.includes('/auth/reset-password')) {
      return { limit: THROTTLE_SENSITIVE_LIMIT, ttl: THROTTLE_SENSITIVE_TTL };
    }
    return { limit: THROTTLE_DEFAULT_LIMIT, ttl: THROTTLE_DEFAULT_TTL };
  }

  private cleanupOldBuckets(now: number): void {
    if (this.hits.size > 10000) {
      for (const [k, b] of this.hits.entries()) {
        if (now > b.resetTime) {
          this.hits.delete(k);
        }
      }

      // Phòng thủ quá tải bộ nhớ (CWE-400): Giới hạn cứng dung lượng Map dưới áp lực DDoS
      if (this.hits.size > 15000) {
        const toDeleteCount = this.hits.size - 10000;
        let count = 0;
        for (const k of this.hits.keys()) {
          this.hits.delete(k);
          count++;
          if (count >= toDeleteCount) break;
        }
      }
    }
  }
}
