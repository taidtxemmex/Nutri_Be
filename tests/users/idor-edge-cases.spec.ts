import { ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { IdorDefenseService } from '../../src/security/idor/idor-defense.service';
import { IdorUserOwnershipGuard } from '../../src/security/idor/idor-user-ownership.guard';
import { UserRole } from '../../src/config/enums/role.enum';
import { AUTH_ERROR_IDOR_VIOLATION } from '../../src/config/constants/auth.constants';

describe('IDOR Defense & Type Smashing Edge Cases', () => {
  let idorService: IdorDefenseService;
  let idorGuard: IdorUserOwnershipGuard;

  beforeEach(() => {
    idorService = new IdorDefenseService();
    idorGuard = new IdorUserOwnershipGuard();
  });

  const myUserId = 'user-owner-uuid-1111';
  const victimUserId = 'user-victim-uuid-2222';

  describe('IdorDefenseService Assertions', () => {
    it('should allow owner to access their own resource', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.USER, myUserId);
      }).not.toThrow();
    });

    it('should allow ADMIN to access any target resource', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.ADMIN, victimUserId);
      }).not.toThrow();
    });

    it('should allow SUPERADMIN to access any target resource', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.SUPERADMIN, victimUserId);
      }).not.toThrow();
    });

    it('should block regular user from accessing another user data (ERR_IDOR_VIOLATION)', () => {
      try {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.USER, victimUserId);
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.getResponse()?.code).toBe(AUTH_ERROR_IDOR_VIOLATION);
      }
    });

    it('should block type smashing with number: userId = 123', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.USER, 123 as any);
      }).toThrow(ForbiddenException);
    });

    it('should block type smashing with array: userId = ["uuid-victim"]', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.USER, [victimUserId] as any);
      }).toThrow(ForbiddenException);
    });

    it('should block type smashing with object: userId = { id: "victim" }', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin(myUserId, UserRole.USER, { id: victimUserId } as any);
      }).toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if current user is missing', () => {
      expect(() => {
        idorService.assertUserOwnershipOrAdmin('', UserRole.USER, myUserId);
      }).toThrow(UnauthorizedException);
    });

    it('should enforce assertAdmin strictly for admin-only operations', () => {
      expect(() => idorService.assertAdmin(UserRole.ADMIN)).not.toThrow();
      expect(() => idorService.assertAdmin(UserRole.SUPERADMIN)).not.toThrow();
      expect(() => idorService.assertAdmin(UserRole.USER)).toThrow(ForbiddenException);
      expect(() => idorService.assertAdmin(UserRole.DOCTOR)).toThrow(ForbiddenException);
    });
  });

  describe('IdorUserOwnershipGuard HTTP Request Extraction', () => {
    const createMockContext = (requestData: any): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => requestData,
        }),
      } as any);

    it('should allow access when target userId in body matches authenticated user', () => {
      const ctx = createMockContext({
        user: { id: myUserId, role: UserRole.USER },
        body: { userId: myUserId },
      });

      expect(idorGuard.canActivate(ctx)).toBe(true);
    });

    it('should block access when target userId in body belongs to someone else', () => {
      const ctx = createMockContext({
        user: { id: myUserId, role: UserRole.USER },
        body: { userId: victimUserId },
      });

      expect(() => idorGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should block access when target userId in query belongs to someone else', () => {
      const ctx = createMockContext({
        user: { id: myUserId, role: UserRole.USER },
        query: { userId: victimUserId },
      });

      expect(() => idorGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should block access when target userId in params belongs to someone else', () => {
      const ctx = createMockContext({
        user: { id: myUserId, role: UserRole.USER },
        params: { id: victimUserId },
      });

      expect(() => idorGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow ADMIN to bypass IDOR check across all payload locations', () => {
      const ctx = createMockContext({
        user: { id: myUserId, role: UserRole.ADMIN },
        body: { userId: victimUserId },
        params: { id: victimUserId },
        query: { userId: victimUserId },
      });

      expect(idorGuard.canActivate(ctx)).toBe(true);
    });

    it('should throw UnauthorizedException if request has no authenticated user', () => {
      const ctx = createMockContext({
        body: { userId: myUserId },
      });

      expect(() => idorGuard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
