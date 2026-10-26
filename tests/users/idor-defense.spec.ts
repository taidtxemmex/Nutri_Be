import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { IdorUserOwnershipGuard } from '../../src/security/idor/idor-user-ownership.guard';
import { AdminOnlyGuard } from '../../src/security/idor/admin-only.guard';
import { IdorDefenseService } from '../../src/security/idor/idor-defense.service';
import {
  AUTH_ERROR_IDOR_VIOLATION,
  AUTH_ERROR_FORBIDDEN,
} from '../../src/config/constants/auth.constants';
import { UserRole } from '../../src/config/enums/role.enum';

describe('IDOR Defense System', () => {
  describe('IdorUserOwnershipGuard', () => {
    let guard: IdorUserOwnershipGuard;

    beforeEach(() => {
      guard = new IdorUserOwnershipGuard();
    });

    const createMockContext = (user: any, body: any = {}, params: any = {}) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            body,
            params,
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('should allow user accessing their own data (body.userId === req.user.id)', () => {
      const context = createMockContext(
        { id: 'user-uuid-1', role: 'USER' },
        { userId: 'user-uuid-1' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should BLOCK user from accessing another user data with 403 Forbidden and ERR_IDOR_VIOLATION', () => {
      const context = createMockContext(
        { id: 'user-uuid-attacker', role: 'USER' },
        { userId: 'user-uuid-victim' },
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AUTH_ERROR_IDOR_VIOLATION,
        });
      }
    });

    it('should allow ADMIN to view any user data (bypassing IDOR)', () => {
      const context = createMockContext(
        { id: 'admin-uuid', role: UserRole.ADMIN },
        { userId: 'victim-uuid' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow SUPERADMIN to view any user data', () => {
      const context = createMockContext(
        { id: 'super-admin-uuid', role: UserRole.SUPERADMIN },
        { userId: 'victim-uuid' },
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block unauthenticated requests with 401 Unauthorized', () => {
      const context = createMockContext(null, { userId: 'some-uuid' });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('AdminOnlyGuard', () => {
    let guard: AdminOnlyGuard;

    beforeEach(() => {
      guard = new AdminOnlyGuard();
    });

    const createMockContext = (user: any) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    };

    it('should allow ADMIN to access /api/profile/getAll', () => {
      const context = createMockContext({ id: 'admin-1', role: UserRole.ADMIN });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow SUPERADMIN to access /api/profile/getAll', () => {
      const context = createMockContext({ id: 'super-1', role: UserRole.SUPERADMIN });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block regular USER with 403 Forbidden', () => {
      const context = createMockContext({ id: 'user-1', role: UserRole.USER });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AUTH_ERROR_FORBIDDEN,
        });
      }
    });
  });

  describe('IdorDefenseService', () => {
    let service: IdorDefenseService;

    beforeEach(() => {
      service = new IdorDefenseService();
    });

    it('should assert ownership correctly', () => {
      expect(() =>
        service.assertUserOwnershipOrAdmin('user-1', 'USER', 'user-1'),
      ).not.toThrow();

      expect(() =>
        service.assertUserOwnershipOrAdmin('admin-1', 'ADMIN', 'target-99'),
      ).not.toThrow();

      expect(() =>
        service.assertUserOwnershipOrAdmin('user-attacker', 'USER', 'user-victim'),
      ).toThrow(ForbiddenException);
    });

    it('should assert admin privilege correctly', () => {
      expect(() => service.assertAdmin('ADMIN')).not.toThrow();
      expect(() => service.assertAdmin('SUPERADMIN')).not.toThrow();
      expect(() => service.assertAdmin('USER')).toThrow(ForbiddenException);
    });

    it('should sanitize sensitive PII for non-privileged viewers', () => {
      const rawUser = {
        id: 'u1',
        ten_dang_nhap: 'john',
        mat_khau: '$2b$10$hashed_secret',
        keycloak_user_id: 'kc-1234',
        email: 'john@example.com',
      };

      const sanitized = service.sanitizePii(rawUser, false);
      expect((sanitized as any).mat_khau).toBeUndefined();
      expect((sanitized as any).keycloak_user_id).toBeUndefined();
      expect(sanitized.email).toBe('john@example.com');

      const adminView = service.sanitizePii(rawUser, true);
      expect((adminView as any).mat_khau).toBeUndefined();
      expect(adminView.email).toBe('john@example.com');
    });
  });
});
