import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_PRO_KEY,
  IS_PUBLIC_KEY,
  AUTH_ERROR_UNAUTHORIZED,
  ERR_PRO_SUBSCRIPTION_REQUIRED,
} from '../../config/constants/auth.constants';
import { UserRole } from '../../config/enums/role.enum';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isRequirePro = this.reflector.getAllAndOverride<boolean>(REQUIRE_PRO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu endpoint không yêu cầu @RequirePro() -> cho phép đi tiếp
    if (!isRequirePro) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Yêu cầu đăng nhập để truy cập tài nguyên này.',
      });
    }

    let userRole = String(user.vai_tro || user.role || '').toUpperCase();
    let proExpiredAt: Date | string | null | undefined = user.pro_expired_at;

    // 1. Nếu user là SUPERADMIN hoặc ADMIN: Cho phép truy cập (Bypass)
    if (
      userRole === UserRole.SUPERADMIN ||
      userRole === UserRole.ADMIN ||
      userRole === 'SUPERADMIN' ||
      userRole === 'ADMIN'
    ) {
      return true;
    }

    // 2. Nếu thông tin pro_expired_at chưa có trên request.user nhưng có prisma và user.id
    if (proExpiredAt === undefined && this.prisma && user.id) {
      const dbUser = await this.prisma.nguoi_dung.findUnique({
        where: { id: user.id },
        select: { vai_tro: true, pro_expired_at: true },
      });

      if (dbUser) {
        userRole = String(dbUser.vai_tro).toUpperCase();
        proExpiredAt = dbUser.pro_expired_at;

        // Bypass nếu là ADMIN / SUPERADMIN từ DB
        if (
          userRole === UserRole.SUPERADMIN ||
          userRole === UserRole.ADMIN ||
          userRole === 'SUPERADMIN' ||
          userRole === 'ADMIN'
        ) {
          return true;
        }
      }
    }

    // 3. Nếu user là USERPRO: Kiểm tra pro_expired_at
    if (userRole === UserRole.USERPRO || userRole === 'USERPRO') {
      if (proExpiredAt && new Date(proExpiredAt).getTime() >= Date.now()) {
        return true;
      }
    }

    // 4. Ngược lại (nếu là USER hoặc pro_expired_at < new Date() hoặc không hợp lệ):
    throw new ForbiddenException({
      code: ERR_PRO_SUBSCRIPTION_REQUIRED,
      message: 'Tính năng này yêu cầu gói tài khoản PRO còn hiệu lực.',
    });
  }
}
