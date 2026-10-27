import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionGuard } from '../../src/security/guards/subscription.guard';
import { RequirePro, REQUIRE_PRO_KEY } from '../../src/security/decorators/require-pro.decorator';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  ERR_PRO_SUBSCRIPTION_REQUIRED,
  AUTH_ERROR_UNAUTHORIZED,
  IS_PUBLIC_KEY,
} from '../../src/config/constants/auth.constants';

describe('SubscriptionGuard & @RequirePro() Tests', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockPrisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
      },
    };
    guard = new SubscriptionGuard(reflector, mockPrisma);
  });

  function createMockContext(
    user: any,
    metadata: { isPublic?: boolean; requirePro?: boolean } = {},
  ): ExecutionContext {
    const handler = () => {};
    const targetClass = class TestController {};

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.isPublic ?? false;
      if (key === REQUIRE_PRO_KEY) return metadata.requirePro ?? true;
      return null;
    });

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Decorator metadata', () => {
    it('should set REQUIRE_PRO_KEY metadata when @RequirePro() is applied', () => {
      class SampleController {
        @RequirePro()
        proAction() {}
      }

      const instance = new SampleController();
      const metadata = Reflect.getMetadata(REQUIRE_PRO_KEY, instance.proAction);
      expect(metadata).toBe(true);
    });
  });

  describe('SubscriptionGuard Access Control', () => {
    it('should allow access if route is marked @Public()', async () => {
      const context = createMockContext(null, { isPublic: true, requirePro: true });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access if route does NOT require @RequirePro()', async () => {
      const context = createMockContext(null, { requirePro: false });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException (401) when user is unauthenticated', async () => {
      const context = createMockContext(null, { requirePro: true });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          code: AUTH_ERROR_UNAUTHORIZED,
        },
      });
    });

    it('should bypass and allow SUPERADMIN unconditionally', async () => {
      const user = { id: 'admin-1', role: UserRole.SUPERADMIN };
      const context = createMockContext(user, { requirePro: true });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should bypass and allow ADMIN unconditionally', async () => {
      const user = { id: 'admin-2', vai_tro: UserRole.ADMIN };
      const context = createMockContext(user, { requirePro: true });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow USERPRO with valid active subscription (pro_expired_at >= now)', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in future
      const user = {
        id: 'pro-user-1',
        role: UserRole.USERPRO,
        pro_expired_at: futureDate,
      };

      const context = createMockContext(user, { requirePro: true });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException (403) for USERPRO when pro_expired_at < now', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in past
      const user = {
        id: 'pro-user-expired',
        role: UserRole.USERPRO,
        pro_expired_at: pastDate,
      };

      const context = createMockContext(user, { requirePro: true });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          code: ERR_PRO_SUBSCRIPTION_REQUIRED,
          message: 'Tính năng này yêu cầu gói tài khoản PRO còn hiệu lực.',
        },
      });
    });

    it('should throw ForbiddenException (403) for standard USER without PRO tier', async () => {
      const user = {
        id: 'free-user-1',
        role: UserRole.USER,
        pro_expired_at: null,
      };

      const context = createMockContext(user, { requirePro: true });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          code: ERR_PRO_SUBSCRIPTION_REQUIRED,
          message: 'Tính năng này yêu cầu gói tài khoản PRO còn hiệu lực.',
        },
      });
    });

    it('should throw ForbiddenException (403) for other roles (BENH_NHAN)', async () => {
      const user = {
        id: 'patient-1',
        role: UserRole.BENH_NHAN,
      };

      const context = createMockContext(user, { requirePro: true });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          code: ERR_PRO_SUBSCRIPTION_REQUIRED,
        },
      });
    });

    it('should query Prisma DB if pro_expired_at is undefined on request.user and allow valid PRO', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'db-user-1',
        vai_tro: 'USERPRO',
        pro_expired_at: futureDate,
      });

      const user = {
        id: 'db-user-1',
        role: 'USERPRO',
        // pro_expired_at is undefined here
      };

      const context = createMockContext(user, { requirePro: true });
      const result = await guard.canActivate(context);

      expect(mockPrisma.nguoi_dung.findUnique).toHaveBeenCalledWith({
        where: { id: 'db-user-1' },
        select: { vai_tro: true, pro_expired_at: true },
      });
      expect(result).toBe(true);
    });

    it('should query Prisma DB and reject if DB user has expired pro_expired_at', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'db-user-2',
        vai_tro: 'USERPRO',
        pro_expired_at: pastDate,
      });

      const user = {
        id: 'db-user-2',
        role: 'USERPRO',
      };

      const context = createMockContext(user, { requirePro: true });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
