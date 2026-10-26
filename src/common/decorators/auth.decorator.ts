import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { ApiErrorResponse } from './api-standard-response.decorator';
import { UserRole } from '../../config/enums/role.enum';

/**
 * Composite Decorator gom toàn bộ cấu hình xác thực JWT, phân quyền RBAC và Swagger Bearer
 *
 * Cách dùng:
 * - `@Auth()` : Bắt buộc đăng nhập JWT (JwtAuthGuard + RolesGuard + ApiBearerAuth + 401)
 * - `@Auth(UserRole.ADMIN, UserRole.SUPERADMIN)` : Bắt buộc đăng nhập + đúng vai trò (Roles + 401 + 403)
 */
export function Auth(...roles: UserRole[]) {
  if (roles.length > 0) {
    return applyDecorators(
      Roles(...roles),
      UseGuards(JwtAuthGuard, RolesGuard),
      ApiBearerAuth('JWT-auth'),
      ApiErrorResponse(401, 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn'),
      ApiErrorResponse(403, 'Không đủ quyền hạn truy cập tài nguyên này'),
    );
  }

  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth('JWT-auth'),
    ApiErrorResponse(401, 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn'),
  );
}
