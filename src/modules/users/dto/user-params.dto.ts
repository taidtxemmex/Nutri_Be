import { QueryUsersDto } from './user-query.dto';
import { UpdateUserInfoReqDto } from './update-user-info.dto';
import { CreateUserItemDto } from './batch-users.dto';
import { UserRole } from '../../../config/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

export class FindAllUsersParamsDto {
  query?: QueryUsersDto;
}

export class FindUserByIdParamsDto {
  id: string;
}

export class GetMeParamsDto {
  currentUserId: string;
}

export class GetUserInfoParamsDto {
  targetUserId: string;
  currentUser: AuthenticatedUser;
}

export class UpdateUserInfoParamsDto {
  dto: UpdateUserInfoReqDto;
  currentUser: AuthenticatedUser;
}

export class UpdateUserRoleParamsDto {
  targetUserId: string;
  newRole: UserRole;
  currentUser: AuthenticatedUser;
}

export class UpdateUserStatusParamsDto {
  targetUserId: string;
  isActive: boolean;
  currentUser: AuthenticatedUser;
}

export class CheckProfileParamsDto {
  userId: string;
}

export class SoftDeleteUserParamsDto {
  targetUserId: string;
  currentUser: AuthenticatedUser;
}

export class SoftDeleteBatchParamsDto {
  userIds: string[];
  currentUser: AuthenticatedUser;
}

export class UpdateStatusBatchParamsDto {
  userIds: string[];
  isActive: boolean;
  currentUser: AuthenticatedUser;
}

export class CreateBatchUsersParamsDto {
  dtoList: CreateUserItemDto[];
  currentUser: AuthenticatedUser;
}
