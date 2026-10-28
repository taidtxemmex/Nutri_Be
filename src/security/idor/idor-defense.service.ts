import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  AUTH_ERROR_FORBIDDEN,
  AUTH_ERROR_IDOR_VIOLATION,
  AUTH_ERROR_UNAUTHORIZED,
} from '../../config/constants/auth.constants';
import { isAdminRole } from '../../config/enums/role.enum';

export interface AssertOwnershipParamDto {
  currentUserId: string;
  currentUserRole: string;
  targetUserId?: string;
}

export interface IsOwnerParamDto {
  currentUserId?: string;
  targetUserId?: string;
}

export interface SanitizePiiParamDto<T extends Record<string, any>> {
  data: T;
  isPrivileged: boolean;
}

@Injectable()
export class IdorDefenseService {
  /**
   * Check if a role has administrator privileges (SSOT via isAdminRole)
   */
  isAdmin(role?: string): boolean {
    return isAdminRole(role);
  }

  /**
   * Check if current user owns the target resource
   */
  isOwner(paramOrCurrentUserId?: IsOwnerParamDto | string, legacyTargetUserId?: string): boolean {
    let currentUserId: string | undefined;
    let targetUserId: string | undefined;

    if (
      paramOrCurrentUserId &&
      typeof paramOrCurrentUserId === 'object' &&
      'currentUserId' in paramOrCurrentUserId
    ) {
      currentUserId = paramOrCurrentUserId.currentUserId;
      targetUserId = paramOrCurrentUserId.targetUserId;
    } else {
      currentUserId = paramOrCurrentUserId as string | undefined;
      targetUserId = legacyTargetUserId;
    }

    if (!currentUserId || !targetUserId) return false;
    return String(currentUserId).trim() === String(targetUserId).trim();
  }

  /**
   * Enforce user ownership or admin privilege.
   * Throws 403 Forbidden with ERR_IDOR_VIOLATION if unauthorized.
   */
  assertUserOwnershipOrAdmin(
    paramOrCurrentUserId: AssertOwnershipParamDto | string,
    legacyCurrentUserRole?: string,
    legacyTargetUserId?: string,
  ): void {
    let currentUserId: string;
    let currentUserRole: string;
    let targetUserId: string | undefined;

    if (
      paramOrCurrentUserId &&
      typeof paramOrCurrentUserId === 'object' &&
      'currentUserId' in paramOrCurrentUserId
    ) {
      currentUserId = paramOrCurrentUserId.currentUserId;
      currentUserRole = paramOrCurrentUserId.currentUserRole;
      targetUserId = paramOrCurrentUserId.targetUserId;
    } else {
      currentUserId = paramOrCurrentUserId as string;
      currentUserRole = legacyCurrentUserRole!;
      targetUserId = legacyTargetUserId;
    }

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
    if (!this.isOwner({ currentUserId, targetUserId })) {
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
  sanitizePii<T extends Record<string, any>>(
    paramOrData: SanitizePiiParamDto<T> | T,
    legacyIsPrivileged?: boolean,
  ): Partial<T> {
    let data: T;
    let isPrivileged: boolean;

    if (paramOrData && typeof paramOrData === 'object' && 'data' in paramOrData) {
      data = paramOrData.data;
      isPrivileged = Boolean(paramOrData.isPrivileged);
    } else {
      data = paramOrData as T;
      isPrivileged = Boolean(legacyIsPrivileged);
    }

    // Mật khẩu hash tuyệt đối KHÔNG bao giờ được trả về cho bất kỳ ai (kể cả Admin)
    const { mat_khau: _mat_khau, ...rest } = data;
    if (isPrivileged) {
      return rest as Partial<T>;
    }

    const { keycloak_user_id: _keycloak_user_id, ...sanitized } = rest;

    return sanitized as Partial<T>;
  }
}
