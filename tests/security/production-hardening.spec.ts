import { createCorsOptions } from '../../src/security/cors/cors.config';
import { getHelmetOptions } from '../../src/security/headers/helmet.config';
import { createSwaggerAuthMiddleware } from '../../src/security/swagger/swagger-auth.middleware';
import { validateProductionSecrets } from '../../src/security/validation/security-secrets.validator';
import { ThrottlerBehindProxyGuard } from '../../src/security/rate-limit/throttler-behind-proxy.guard';
import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

describe('PRODUCTION HARDENING & GO-LIVE SECURITY SUITE', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // 1. CORS CONFIGURATION HARDENING TESTS
  // ============================================================================
  describe('CORS Configuration Defense', () => {
    it('should permit requests from whitelisted production domain: https://nutri.vn', (done) => {
      process.env.NODE_ENV = 'production';
      const corsOptions = createCorsOptions();
      const originFn = corsOptions.origin as any;

      originFn('https://nutri.vn', (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should permit requests from whitelisted production domain: https://ilove.truenutri.vn', (done) => {
      process.env.NODE_ENV = 'production';
      const corsOptions = createCorsOptions();
      const originFn = corsOptions.origin as any;

      originFn('https://ilove.truenutri.vn', (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should permit requests from whitelisted VPS IP: http://165.245.185.11', (done) => {
      process.env.NODE_ENV = 'production';
      const corsOptions = createCorsOptions();
      const originFn = corsOptions.origin as any;

      originFn('http://165.245.185.11', (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should block unauthorized attacker origins with ForbiddenException', (done) => {
      process.env.NODE_ENV = 'production';
      const corsOptions = createCorsOptions();
      const originFn = corsOptions.origin as any;

      originFn('https://malicious-hacker-site.com', (err: Error | null, allow?: boolean) => {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(allow).toBe(false);
        done();
      });
    });

    it('should allow server-to-server or mobile requests without Origin header', (done) => {
      const corsOptions = createCorsOptions();
      const originFn = corsOptions.origin as any;

      originFn(undefined, (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should expose Content-Disposition and tracing headers for client download and tracing', () => {
      const corsOptions = createCorsOptions();
      expect(corsOptions.exposedHeaders).toContain('Content-Disposition');
      expect(corsOptions.exposedHeaders).toContain('X-Total-Count');
      expect(corsOptions.exposedHeaders).toContain('X-Trace-Id');
      expect(corsOptions.exposedHeaders).toContain('X-Cache-Version');
      expect(corsOptions.credentials).toBe(true);
    });
  });

  // ============================================================================
  // 2. HELMET SECURITY HEADERS TESTS
  // ============================================================================
  describe('Helmet Security Headers Defense', () => {
    it('should configure strict security headers: nosniff, SAMEORIGIN, and HSTS', () => {
      process.env.NODE_ENV = 'production';
      const helmetOpts = getHelmetOptions();

      expect(helmetOpts.noSniff).toBe(true);
      expect((helmetOpts.frameguard as any)?.action).toBe('sameorigin');
      expect((helmetOpts.hsts as any)?.maxAge).toBe(31536000);
      expect((helmetOpts.hsts as any)?.includeSubDomains).toBe(true);
      expect(helmetOpts.hidePoweredBy).toBe(true);
      expect((helmetOpts.referrerPolicy as any)?.policy).toBe('strict-origin-when-cross-origin');
    });
  });

  // ============================================================================
  // 3. SWAGGER / OPENAPI GATE & BASIC AUTH TESTS
  // ============================================================================
  describe('Swagger Hardening & Basic Auth Gate', () => {
    it('should completely block public Swagger in production when ENABLE_SWAGGER is not true', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_SWAGGER;

      const middleware = createSwaggerAuthMiddleware();
      const req = { originalUrl: '/api/docs', ip: '127.0.0.1', headers: {} } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    it('should prompt for Basic Auth credentials when header is missing', () => {
      process.env.NODE_ENV = 'development';
      const middleware = createSwaggerAuthMiddleware();

      const req = { originalUrl: '/api/docs', ip: '127.0.0.1', headers: {} } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Basic'),
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid credentials with 401', () => {
      process.env.NODE_ENV = 'development';
      process.env.SWAGGER_USER = 'admin';
      process.env.SWAGGER_PASSWORD = 'super-secret-password';

      const middleware = createSwaggerAuthMiddleware();
      const badCredentials = Buffer.from('admin:wrong-pass').toString('base64');
      const req = {
        originalUrl: '/api/docs',
        ip: '127.0.0.1',
        headers: { authorization: `Basic ${badCredentials}` },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should grant access when valid Basic Auth credentials are provided', () => {
      process.env.NODE_ENV = 'development';
      process.env.SWAGGER_USER = 'admin';
      process.env.SWAGGER_PASSWORD = 'super-secret-password';

      const middleware = createSwaggerAuthMiddleware();
      const validCredentials = Buffer.from('admin:super-secret-password').toString('base64');
      const req = {
        originalUrl: '/api/docs',
        ip: '127.0.0.1',
        headers: { authorization: `Basic ${validCredentials}` },
      } as unknown as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 4. FAIL-FAST SECRETS & ENTROPY VALIDATION TESTS
  // ============================================================================
  describe('Fail-Fast Secrets & Entropy Validator', () => {
    it('should throw fatal error in production if JWT_SECRET is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';

      expect(() => validateProductionSecrets()).toThrow(
        'Fatal Security Exception: JWT_SECRET must be explicitly configured in production.',
      );
    });

    it('should throw fatal error in production if JWT_SECRET is shorter than 32 characters', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short_secret_123';
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';

      expect(() => validateProductionSecrets()).toThrow(
        'Fatal Security Exception: JWT_SECRET must be at least 32 characters for adequate entropy.',
      );
    });

    it('should throw fatal error in production if JWT_SECRET is a known weak default', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET =
        'truenutri_super_secret_jwt_key_2026_clinical_nutrition_protect_token';
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';

      expect(() => validateProductionSecrets()).toThrow(
        'Fatal Security Exception: Do not use default or placeholder JWT secrets in production.',
      );
    });

    it('should pass cleanly when strong production secrets are present', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'c8b3a199857d45e0bb1b4d08b3e8e2c34d88e6a4b1234567890abcdef1234567';
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
      process.env.STORAGE_HMAC_SECRET =
        'storage_hmac_secret_super_strong_for_production_testing_2026';

      expect(() => validateProductionSecrets()).not.toThrow();
    });
  });

  // ============================================================================
  // 5. THROTTLER BEHIND REVERSE PROXY TESTS
  // ============================================================================
  describe('ThrottlerBehindProxyGuard Defense', () => {
    it('should accurately resolve client IP from X-Forwarded-For header', async () => {
      const guard = new ThrottlerBehindProxyGuard({} as any, {} as any, {} as any);
      const req = {
        headers: {
          'x-forwarded-for': '113.190.234.56, 165.245.185.11',
        },
        ip: '127.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('113.190.234.56');
    });

    it('should set Retry-After header and throw HttpException with TOO_MANY_REQUESTS', async () => {
      const guard = new ThrottlerBehindProxyGuard({} as any, {} as any, {} as any);
      const setHeader = jest.fn();
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => ({ setHeader }),
        }),
      } as ExecutionContext;

      await expect(
        (guard as any).throwThrottlingException(mockContext, {
          timeToBlockExpire: 45000,
          totalHits: 6,
          limit: 5,
          ttl: 60000,
        }),
      ).rejects.toThrow(HttpException);

      expect(setHeader).toHaveBeenCalledWith('Retry-After', '45');
    });
  });
});
