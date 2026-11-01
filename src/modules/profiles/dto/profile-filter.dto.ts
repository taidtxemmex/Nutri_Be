import { IsOptional, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_LIMIT } from '../../../config/constants/pagination.constants';

export class ProfileFilterDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Trang cần lấy (0-indexed theo chuẩn FE)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.profiles.page_int' })
  @Min(0, { message: 'validation.profiles.page_min_0' })
  page?: number = 0;

  @ApiPropertyOptional({
    example: 20,
    default: DEFAULT_LIMIT,
    maximum: 5000,
    description: 'Số lượng phần tử mỗi trang (tối đa 5000)',
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return DEFAULT_LIMIT;
    return Math.min(5000, num);
  })
  @IsInt({ message: 'validation.profiles.size_int' })
  @Min(1, { message: 'validation.profiles.size_min_1' })
  @Max(5000, { message: 'validation.profiles.size_max_5000' })
  size?: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (tên, email, username)' })
  @IsOptional()
  @IsString({ message: 'validation.profiles.keyword_string' })
  @MaxLength(255, { message: 'validation.profiles.keyword_max_255' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Lọc theo vai trò (role)' })
  @IsOptional()
  @IsString({ message: 'validation.profiles.role_string' })
  role?: string;

  @ApiPropertyOptional({ description: 'Lọc theo giới tính (gender)' })
  @IsOptional()
  @IsString({ message: 'validation.profiles.gender_string' })
  gender?: string;

  @ApiPropertyOptional({ description: 'Trường sắp xếp (sortBy)' })
  @IsOptional()
  @IsString({ message: 'validation.profiles.sort_by_string' })
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Chiều sắp xếp (sortDir)' })
  @IsOptional()
  @IsString({ message: 'validation.profiles.sort_dir_string' })
  sortDir?: string;
}
