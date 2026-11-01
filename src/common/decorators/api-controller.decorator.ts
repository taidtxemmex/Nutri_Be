import { applyDecorators, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from './auth.decorator';
import { UserRole } from '../../config/enums/role.enum';

export interface ApiControllerOptions {
  auth?: boolean;
  roles?: UserRole[];
}

export interface ApiControllerParamDto {
  tag: string;
  path?: string | string[];
  options?: ApiControllerOptions;
}

/**
 * Gom cụm @ApiTags + @Controller + @Auth (tùy chọn) vào 1 dòng duy nhất
 *
 * Cách dùng:
 * @ApiController('Users', 'users', { auth: true })
 * export class UsersController { ... }
 */
export function ApiController(
  paramOrTag: ApiControllerParamDto | string,
  legacyPath?: string | string[],
  legacyOptions?: ApiControllerOptions,
) {
  let tag: string;
  let path: string | string[] | undefined;
  let options: ApiControllerOptions | undefined;

  if (typeof paramOrTag === 'object') {
    tag = paramOrTag.tag;
    path = paramOrTag.path;
    options = paramOrTag.options;
  } else {
    tag = paramOrTag;
    path = legacyPath;
    options = legacyOptions;
  }

  const controllerPath = path !== undefined ? path : tag.toLowerCase();

  if (options?.roles && options.roles.length > 0) {
    return applyDecorators(ApiTags(tag), Controller(controllerPath), Auth(...options.roles));
  }

  if (options?.auth) {
    return applyDecorators(ApiTags(tag), Controller(controllerPath), Auth());
  }

  return applyDecorators(ApiTags(tag), Controller(controllerPath));
}
