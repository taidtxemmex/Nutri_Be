import { UserRole } from '../enums/role.enum';
import { Permission } from '../enums/permission.enum';

/**
 * Role to Permissions Mapping Matrix (SSOT)
 * Centralized RBAC + PBAC policy.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // 1. SUPERADMIN: Full permissions across all features
  [UserRole.SUPERADMIN]: Object.values(Permission),

  // 2. ADMIN: System operations & user/content management
  [UserRole.ADMIN]: [
    Permission.USER_VIEW_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_VIEW_ALL,
    Permission.USER_MANAGE_ROLE,
    Permission.USER_MANAGE_STATUS,
    Permission.CATEGORY_VIEW,
    Permission.CATEGORY_MANAGE,
    Permission.DISEASE_GROUP_VIEW,
    Permission.DISEASE_GROUP_MANAGE,
    Permission.INGREDIENT_VIEW,
    Permission.INGREDIENT_APPROVE,
    Permission.INGREDIENT_MANAGE,
    Permission.INGREDIENT_DELETE,
    Permission.DISH_VIEW,
    Permission.DISH_APPROVE_COMMUNITY,
    Permission.DISH_MANAGE,
    Permission.MENU_VIEW,
    Permission.PACKAGE_VIEW,
    Permission.PACKAGE_MANAGE,
    Permission.PAYMENT_REQUEST_APPROVE,
    Permission.REPORT_EXPORT_EXCEL,
    Permission.DATA_IMPORT_EXCEL,
    Permission.SYSTEM_AUDIT_LOG_VIEW,
    Permission.SYSTEM_CACHE_MANAGE,
  ],

  // 3. USERPRO: Clinical Nutritionists / Doctors (Paid Pro plan)
  [UserRole.USERPRO]: [
    Permission.USER_VIEW_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.CATEGORY_VIEW,
    Permission.DISEASE_GROUP_VIEW,
    Permission.INGREDIENT_VIEW,
    Permission.INGREDIENT_PROPOSE,
    Permission.DISH_VIEW,
    Permission.DISH_CREATE_PERSONAL,
    Permission.MEAL_MANAGE,
    Permission.MENU_VIEW,
    Permission.MENU_CREATE,
    Permission.MENU_CLINICAL_ASSIGN,
    Permission.INTAKE_24H_VIEW,
    Permission.INTAKE_24H_MANAGE,
    Permission.PATIENT_VIEW,
    Permission.PATIENT_MANAGE,
    Permission.PACKAGE_VIEW,
    Permission.PAYMENT_REQUEST_CREATE,
    Permission.REPORT_EXPORT_EXCEL,
  ],

  // 4. USER: Regular users / Patients
  [UserRole.USER]: [
    Permission.USER_VIEW_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.CATEGORY_VIEW,
    Permission.DISEASE_GROUP_VIEW,
    Permission.INGREDIENT_VIEW,
    Permission.DISH_VIEW,
    Permission.DISH_CREATE_PERSONAL,
    Permission.INTAKE_24H_VIEW,
    Permission.INTAKE_24H_MANAGE,
    Permission.PACKAGE_VIEW,
    Permission.PAYMENT_REQUEST_CREATE,
  ],

  // Semantic Aliases
  [UserRole.BAC_SI]: [],
  [UserRole.DOCTOR]: [],
  [UserRole.EXPERT]: [],
  [UserRole.BENH_NHAN]: [],
};

// Map semantic aliases
ROLE_PERMISSIONS[UserRole.BAC_SI] = ROLE_PERMISSIONS[UserRole.USERPRO];
ROLE_PERMISSIONS[UserRole.DOCTOR] = ROLE_PERMISSIONS[UserRole.USERPRO];
ROLE_PERMISSIONS[UserRole.EXPERT] = ROLE_PERMISSIONS[UserRole.USERPRO];
ROLE_PERMISSIONS[UserRole.BENH_NHAN] = ROLE_PERMISSIONS[UserRole.USER];

export interface HasPermissionParamDto {
  userRole: UserRole | string;
  requiredPermission: Permission;
}

export interface HasAnyPermissionParamDto {
  userRole: UserRole | string;
  requiredPermissions: Permission[];
}

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(
  paramOrRole: HasPermissionParamDto | UserRole | string,
  legacyPermission?: Permission,
): boolean {
  let userRole: UserRole | string;
  let requiredPermission: Permission;

  if (
    paramOrRole &&
    typeof paramOrRole === 'object' &&
    'userRole' in paramOrRole &&
    'requiredPermission' in paramOrRole
  ) {
    userRole = (paramOrRole as HasPermissionParamDto).userRole;
    requiredPermission = (paramOrRole as HasPermissionParamDto).requiredPermission;
  } else {
    userRole = paramOrRole as UserRole | string;
    requiredPermission = legacyPermission!;
  }

  const role = userRole as UserRole;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(requiredPermission);
}

/**
 * Check if a role possesses any of the required permissions
 */
export function hasAnyPermission(
  paramOrRole: HasAnyPermissionParamDto | UserRole | string,
  legacyPermissions?: Permission[],
): boolean {
  let userRole: UserRole | string;
  let requiredPermissions: Permission[];

  if (
    paramOrRole &&
    typeof paramOrRole === 'object' &&
    'userRole' in paramOrRole &&
    'requiredPermissions' in paramOrRole
  ) {
    userRole = (paramOrRole as HasAnyPermissionParamDto).userRole;
    requiredPermissions = (paramOrRole as HasAnyPermissionParamDto).requiredPermissions;
  } else {
    userRole = paramOrRole as UserRole | string;
    requiredPermissions = legacyPermissions!;
  }

  const role = userRole as UserRole;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return requiredPermissions.some((p) => permissions.includes(p));
}
