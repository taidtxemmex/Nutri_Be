import { applyDecorators, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from './auth.decorator';
import { UserRole } from '../../config/enums/role.enum';

export interface ApiControllerOptions {
  auth?: boolean;
  roles?: UserRole[];
}

/**
 * Gom cụm @ApiTags + @Controller + @Auth (tùy chọn) vào 1 dòng duy nhất
 *
 * Cách dùng:
 * @ApiController('Users', 'users', { auth: true })
 * export class UsersController { ... }
 */
export function ApiController(
  tag: string,
  path?: string | string[],
  options?: ApiControllerOptions,
) {
  const controllerPath = path !== undefined ? path : tag.toLowerCase();

  if (options?.roles && options.roles.length > 0) {
    return applyDecorators(ApiTags(tag), Controller(controllerPath), Auth(...options.roles));
  }

  if (options?.auth) {
    return applyDecorators(ApiTags(tag), Controller(controllerPath), Auth());
  }

  return applyDecorators(ApiTags(tag), Controller(controllerPath));
}
