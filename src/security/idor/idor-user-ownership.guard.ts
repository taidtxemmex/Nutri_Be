import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_IDOR_VIOLATION,
} from '../../config/constants/auth.constants';
import { UserRole } from '../../config/enums/role.enum';

@Injectable()
export class IdorUserOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Yêu cầu xác thực tài khoản.',
      });
    }

    const userRole = String(user.role || '').toUpperCase();

    // 1. ADMIN / SUPERADMIN bypass IDOR check
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) {
      return true;
    }

    // 2. Extract target user ID from body, params, or query
    const targetUserId =
      request.body?.userId ||
      request.body?.id ||
      request.params?.userId ||
      request.params?.id ||
      request.query?.userId ||
      request.query?.id;

    // If no target ID specified in payload, default allows self-request
    if (!targetUserId) {
      return true;
    }

    // 3. Ownership verification: target ID must strictly match authenticated user ID
    if (String(targetUserId).trim() !== String(user.id).trim()) {
      throw new ForbiddenException({
        code: AUTH_ERROR_IDOR_VIOLATION,
        message: 'Bạn không có quyền truy cập dữ liệu của người dùng khác.',
      });
    }

    return true;
  }
}
