import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY, AUTH_ERROR_UNAUTHORIZED } from '../../../config/constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request?.headers?.authorization;
      if (authHeader && typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)) {
        return super.canActivate(context);
      }
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context?: ExecutionContext,
  ): TUser {
    if (err || !user) {
      if (context) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
        if (isPublic) {
          return undefined as unknown as TUser;
        }
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.',
      });
    }
    return user;
  }
}
