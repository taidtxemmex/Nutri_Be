import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthRateLimitGuard } from '../../src/security/rate-limit/auth-rate-limit.guard';
import {
  THROTTLE_AUTH_LIMIT,
  THROTTLE_SENSITIVE_LIMIT,
} from '../../src/config/constants/auth.constants';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;

  beforeEach(() => {
    guard = new AuthRateLimitGuard();
  });

  const createMockContext = (ip: string, url: string, method = 'POST') => {
    const headers: Record<string, string> = { 'x-forwarded-for': ip };
    const responseHeaders: Record<string, any> = {};

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          ip,
          originalUrl: url,
          url,
          method,
        }),
        getResponse: () => ({
          setHeader: (k: string, v: any) => {
            responseHeaders[k] = v;
          },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow requests within the rate limit for login', () => {
    const ip = '192.168.1.10';
    const url = '/api/v1/auth/login';

    for (let i = 0; i < THROTTLE_AUTH_LIMIT; i++) {
      expect(guard.canActivate(createMockContext(ip, url))).toBe(true);
    }
  });

  it('should block requests exceeding the limit with 429 Too Many Requests', () => {
    const ip = '192.168.1.11';
    const url = '/api/v1/auth/login';

    for (let i = 0; i < THROTTLE_AUTH_LIMIT; i++) {
      guard.canActivate(createMockContext(ip, url));
    }

    // 6th request should fail
    expect(() => guard.canActivate(createMockContext(ip, url))).toThrow(
      HttpException,
    );

    try {
      guard.canActivate(createMockContext(ip, url));
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.getResponse()).toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    }
  });

  it('should apply stricter limit (3 req/min) for sensitive endpoints', () => {
    const ip = '192.168.1.12';
    const url = '/api/v1/auth/forgot-password';

    for (let i = 0; i < THROTTLE_SENSITIVE_LIMIT; i++) {
      expect(guard.canActivate(createMockContext(ip, url))).toBe(true);
    }

    // 4th request should fail
    expect(() => guard.canActivate(createMockContext(ip, url))).toThrow(
      HttpException,
    );
  });
});
