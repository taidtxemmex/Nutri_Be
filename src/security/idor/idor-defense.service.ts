import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  AUTH_ERROR_FORBIDDEN,
  AUTH_ERROR_IDOR_VIOLATION,
  AUTH_ERROR_UNAUTHORIZED,
} from '../../config/constants/auth.constants';
import { UserRole } from '../../config/enums/role.enum';

@Injectable()
export class IdorDefenseService {
  /**
   * Check if a role has administrator privileges
   */
  isAdmin(role?: string): boolean {
    if (!role) return false;
    const normalized = role.toUpperCase();
    return normalized === UserRole.ADMIN || normalized === UserRole.SUPERADMIN;
  }

  /**
   * Check if current user owns the target resource
   */
  isOwner(currentUserId?: string, targetUserId?: string): boolean {
    if (!currentUserId || !targetUserId) return false;
    return String(currentUserId).trim() === String(targetUserId).trim();
  }

  /**
   * Enforce user ownership or admin privilege.
   * Throws 403 Forbidden with ERR_IDOR_VIOLATION if unauthorized.
   */
  assertUserOwnershipOrAdmin(
    currentUserId: string,
    currentUserRole: string,
    targetUserId?: string,
  ): void {
    if (!currentUserId) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Yêu cầu xác thực tài khoản.',
      });
    }

    // Admins bypass IDOR check
    if (this.isAdmin(currentUserRole)) {
      return;
    }

    // If targetUserId is omitted, default to current user
    if (!targetUserId) {
      return;
    }

    // Strict ownership verification
    if (!this.isOwner(currentUserId, targetUserId)) {
      throw new ForbiddenException({
        code: AUTH_ERROR_IDOR_VIOLATION,
        message: 'Bạn không có quyền truy cập dữ liệu của người dùng khác.',
      });
    }
  }

  /**
   * Enforce strict admin-only privilege (e.g. for /api/profile/getAll).
   * Throws 403 Forbidden if not admin.
   */
  assertAdmin(currentUserRole?: string): void {
    if (!currentUserRole || !this.isAdmin(currentUserRole)) {
      throw new ForbiddenException({
        code: AUTH_ERROR_FORBIDDEN,
        message: 'Chức năng chỉ dành riêng cho Quản trị viên (ADMIN).',
      });
    }
  }

  /**
   * Strip sensitive PII fields if user is neither admin nor the owner
   */
  sanitizePii<T extends Record<string, any>>(data: T, isPrivileged: boolean): Partial<T> {
    // Mật khẩu hash tuyệt đối KHÔNG bao giờ được trả về cho bất kỳ ai (kể cả Admin)
    const { mat_khau: _mat_khau, ...rest } = data;
    if (isPrivileged) {
      return rest as Partial<T>;
    }

    const { keycloak_user_id: _keycloak_user_id, ...sanitized } = rest;

    return sanitized as Partial<T>;
  }
}
