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
