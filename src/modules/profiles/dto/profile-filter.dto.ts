import { IsOptional, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_LIMIT, DEFAULT_LIMIT } from '../../../config/constants/pagination.constants';

export class ProfileFilterDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Trang cần lấy (0-indexed theo chuẩn FE)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number = 0;

  @ApiPropertyOptional({
    example: 20,
    default: DEFAULT_LIMIT,
    maximum: MAX_LIMIT,
    description: 'Số lượng phần tử mỗi trang (tự động ép về tối đa 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return DEFAULT_LIMIT;
    return Math.min(MAX_LIMIT, num);
  })
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  size?: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (tên, email, username)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
  keyword?: string;
}
