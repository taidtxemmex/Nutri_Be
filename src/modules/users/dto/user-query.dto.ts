import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';
import { UserRole } from '../../../config/enums/role.enum';

export class QueryUsersDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole, description: 'Lọc theo vai trò người dùng' })
  @IsOptional()
  @IsEnum(UserRole, { message: 'validation.users.role_invalid' })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái hoạt động' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return undefined;
  })
  @IsBoolean({ message: 'validation.users.status_boolean' })
  active?: boolean;
}
