import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { AUTH_ERROR_UNAUTHORIZED } from '../../src/config/constants/auth.constants';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = (isPublic = false) => {
    const handler = () => {};
    const targetClass = class {};

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access without token if route is marked with @Public()', () => {
    const context = createMockContext(true);
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should call passport super.canActivate if route is not public', () => {
    const context = createMockContext(false);
    const superCanActivateSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(context);
    expect(superCanActivateSpy).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException with code AUTH_001 if authentication fails', () => {
    expect(() => guard.handleRequest(new Error('Jwt expired'), null, null)).toThrow();

    try {
      guard.handleRequest(null, null, null);
    } catch (err: any) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.getResponse()).toMatchObject({
        code: AUTH_ERROR_UNAUTHORIZED,
      });
    }
  });

  it('should return user when authentication succeeds', () => {
    const mockUser = { id: 'uuid-1', username: 'admin', role: 'ADMIN' };
    const result = guard.handleRequest(null, mockUser, null);
    expect(result).toEqual(mockUser);
  });
});
