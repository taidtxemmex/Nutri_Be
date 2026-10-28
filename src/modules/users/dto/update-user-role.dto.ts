import { IsNotEmpty, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../config/enums/role.enum';

export class UpdateUserRoleDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString({ message: 'keycloakUserId phải là chuỗi' })
  @MaxLength(255, { message: 'keycloakUserId tối đa 255 ký tự' })
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString({ message: 'userId phải là chuỗi' })
  @MaxLength(50, { message: 'userId tối đa 50 ký tự' })
  userId?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Alias for newRole' })
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USERPRO,
    description: 'Vai trò mới của người dùng',
  })
  @Expose()
  @Transform(({ value, obj }) => value || obj?.role)
  @IsNotEmpty({ message: 'Vai trò mới không được để trống' })
  @IsEnum(UserRole, { message: 'Vai trò người dùng không hợp lệ' })
  newRole: UserRole;
}
