import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_FORBIDDEN,
} from '../../config/constants/auth.constants';
import { UserRole } from '../../config/enums/role.enum';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Yêu cầu đăng nhập trước khi thực hiện thao tác.',
      });
    }

    const userRole = String(user.role || '').toUpperCase();
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException({
        code: AUTH_ERROR_FORBIDDEN,
        message: 'Chức năng chỉ dành riêng cho Quản trị viên (ADMIN).',
      });
    }

    return true;
  }
}
