export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  EXPERT = 'EXPERT',
  DOCTOR = 'DOCTOR',
  BAC_SI = 'BAC_SI',
  USERPRO = 'USERPRO',
  USER = 'USER',
  BENH_NHAN = 'BENH_NHAN',
}

export const ADMIN_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN] as const;
export const DOCTOR_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.EXPERT,
  UserRole.DOCTOR,
  UserRole.BAC_SI,
  UserRole.USERPRO,
] as const;
export const PATIENT_ROLES = [UserRole.USER, UserRole.BENH_NHAN, UserRole.USERPRO] as const;

/**
 * Single Source of Truth kiểm tra quyền Quản trị viên (ADMIN / SUPERADMIN)
 * Đáp ứng luật DRY (D2), quy định tập trung tại một nơi duy nhất.
 */
export function isAdminRole(roleOrUser?: string | { role?: string } | null): boolean {
  if (!roleOrUser) return false;
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.role;
  if (!role) return false;
  return (
    role === UserRole.ADMIN ||
    role === UserRole.SUPERADMIN ||
    role === 'ADMIN' ||
    role === 'SUPERADMIN'
  );
}

/**
 * Single Source of Truth kiểm tra quyền Bác sĩ / Chuyên gia
 */
export function isDoctorRole(roleOrUser?: string | { role?: string } | null): boolean {
  if (!roleOrUser) return false;
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.role;
  if (!role) return false;
  return (DOCTOR_ROLES as readonly string[]).includes(role);
}
