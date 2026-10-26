import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BasePaginationQueryDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number (1-based index)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) || num <= 0 ? 1 : num;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Limit items per page (max 100)' })
  @IsOptional()
  @Expose()
  @Type(() => Number)
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.size;
    const num = Number(raw);
    if (isNaN(num) || num < 1) return 20;
    return Math.min(100, num);
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Property alias for backward compatibility with NutriFE / Spring Boot
  @ApiPropertyOptional({ description: 'Alias for limit' })
  @IsOptional()
  @Type(() => Number)
  size?: number;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 'id', description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'id';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'Sort order' })
  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
