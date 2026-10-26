import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateUserStatusDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString()
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái hoạt động' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Alias trạng thái hoạt động' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
