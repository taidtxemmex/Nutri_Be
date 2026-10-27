import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { UserRole } from '../../src/config/enums/role.enum';
import {
  AUTH_ERROR_FORBIDDEN,
  AUTH_ERROR_UNAUTHORIZED,
} from '../../src/config/constants/auth.constants';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (
    user: any,
    requiredRoles?: (UserRole | string)[],
    isPublic = false,
  ) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'isPublic') return isPublic;
      if (key === 'roles') return requiredRoles;
      return undefined;
    });

    return {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if route is marked @Public()', () => {
    const context = createMockContext(null, [UserRole.ADMIN], true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if no roles are required on endpoint', () => {
    const context = createMockContext({ id: 'u1', role: 'USER' }, undefined, false);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow SUPERADMIN to access any restricted endpoint', () => {
    const context = createMockContext(
      { id: 'super-1', role: UserRole.SUPERADMIN },
      [UserRole.ADMIN, 'BAC_SI'],
      false,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN to access ADMIN-protected endpoint', () => {
    const context = createMockContext(
      { id: 'admin-1', role: UserRole.ADMIN },
      [UserRole.ADMIN],
      false,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block regular USER from accessing ADMIN-protected endpoint with 403 Forbidden', () => {
    const context = createMockContext(
      { id: 'user-1', role: UserRole.USER },
      [UserRole.ADMIN],
      false,
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        code: AUTH_ERROR_FORBIDDEN,
      });
    }
  });

  it('should allow DOCTOR / BAC_SI / EXPERT to access clinical endpoints', () => {
    // User with role BAC_SI accessing endpoint requiring BAC_SI
    const context1 = createMockContext({ id: 'doc-1', role: 'BAC_SI' }, ['BAC_SI'], false);
    expect(guard.canActivate(context1)).toBe(true);

    // User with role EXPERT accessing endpoint requiring BAC_SI (semantic alias)
    const context2 = createMockContext({ id: 'doc-2', role: UserRole.EXPERT }, ['BAC_SI'], false);
    expect(guard.canActivate(context2)).toBe(true);
  });

  it('should block unauthenticated request with 401 Unauthorized if endpoint requires roles', () => {
    const context = createMockContext(null, [UserRole.ADMIN], false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toMatchObject({
        code: AUTH_ERROR_UNAUTHORIZED,
      });
    }
  });
});
