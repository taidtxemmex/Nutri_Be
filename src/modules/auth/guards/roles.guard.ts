import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ROLES_KEY,
  IS_PUBLIC_KEY,
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_FORBIDDEN,
} from '../../../config/constants/auth.constants';
import { UserRole } from '../../../config/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Yêu cầu đăng nhập để truy cập tài nguyên này.',
      });
    }

    const userRole = String(user.role).toUpperCase();

    // SUPERADMIN has bypass access to all role-restricted endpoints
    if (userRole === UserRole.SUPERADMIN) {
      return true;
    }

    const hasRole = this.matchRoles(userRole, requiredRoles);

    if (!hasRole) {
      throw new ForbiddenException({
        code: AUTH_ERROR_FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này.',
      });
    }

    return true;
  }

  private matchRoles(userRole: string, requiredRoles: (UserRole | string)[]): boolean {
    const normalizedRequired = requiredRoles.map((r) => String(r).toUpperCase());

    // 1. Direct exact match
    if (normalizedRequired.includes(userRole)) {
      return true;
    }

    // 2. Admin role hierarchy: ADMIN can access endpoints requiring ADMIN
    if (userRole === UserRole.ADMIN && normalizedRequired.includes(UserRole.ADMIN)) {
      return true;
    }

    // 3. Clinical/Doctor alias mapping: BAC_SI <-> DOCTOR <-> EXPERT <-> USERPRO
    const doctorAliases = [UserRole.EXPERT, UserRole.DOCTOR, UserRole.BAC_SI, UserRole.USERPRO];
    const requiresDoctor = normalizedRequired.some(
      (r) =>
        doctorAliases.includes(r as UserRole) || r === 'BAC_SI' || r === 'DOCTOR' || r === 'EXPERT',
    );
    if (
      requiresDoctor &&
      (doctorAliases.includes(userRole as UserRole) || userRole === UserRole.ADMIN)
    ) {
      return true;
    }

    // 4. Patient/User alias mapping: BENH_NHAN <-> USER <-> USERPRO
    const patientAliases = [UserRole.USER, UserRole.BENH_NHAN, UserRole.USERPRO];
    const requiresPatient = normalizedRequired.some(
      (r) => patientAliases.includes(r as UserRole) || r === 'BENH_NHAN' || r === 'USER',
    );
    return Boolean(
      requiresPatient &&
      (patientAliases.includes(userRole as UserRole) || userRole === UserRole.ADMIN),
    );
  }
}
