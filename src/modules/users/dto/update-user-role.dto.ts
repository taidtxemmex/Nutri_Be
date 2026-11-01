import { IsNotEmpty, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../config/enums/role.enum';

export class UpdateUserRoleDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString({ message: 'validation.users.keycloak_user_id_string' })
  @MaxLength(255, { message: 'validation.users.keycloak_user_id_max_255' })
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString({ message: 'validation.users.user_id_string' })
  @MaxLength(50, { message: 'validation.users.user_id_max_50' })
  userId?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Alias for newRole' })
  @IsOptional()
  @IsEnum(UserRole, { message: 'validation.users.role_invalid' })
  role?: UserRole;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USERPRO,
    description: 'Vai trò mới của người dùng',
  })
  @Expose()
  @Transform(({ value, obj }) => value || obj?.role)
  @IsNotEmpty({ message: 'validation.users.new_role_required' })
  @IsEnum(UserRole, { message: 'validation.users.role_invalid' })
  newRole: UserRole;
}
