import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../../config/constants/auth.constants';
import { UserRole } from '../../config/enums/role.enum';

export { ROLES_KEY };
export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
