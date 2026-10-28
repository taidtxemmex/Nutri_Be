import { IsOptional, IsInt, Min, Max, IsString, IsIn, MaxLength } from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../config/constants/pagination.constants';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface NormalizePaginationParamDto {
  query?: { page?: number | string; limit?: number | string; size?: number | string };
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Single Source of Truth chuẩn hóa phân trang (Pillar II & DRY D10)
 */
export function normalizePagination(
  paramOrQuery?:
    | NormalizePaginationParamDto
    | { page?: number | string; limit?: number | string; size?: number | string },
  legacyDefaultLimit = DEFAULT_LIMIT,
  legacyMaxLimit = MAX_LIMIT,
): NormalizedPagination {
  let query:
    { page?: number | string; limit?: number | string; size?: number | string } | undefined;
  let defaultLimit = DEFAULT_LIMIT;
  let maxLimit = MAX_LIMIT;

  if (
    paramOrQuery &&
    typeof paramOrQuery === 'object' &&
    ('query' in paramOrQuery || 'defaultLimit' in paramOrQuery || 'maxLimit' in paramOrQuery)
  ) {
    const dto = paramOrQuery as NormalizePaginationParamDto;
    query = dto.query;
    defaultLimit = dto.defaultLimit ?? DEFAULT_LIMIT;
    maxLimit = dto.maxLimit ?? MAX_LIMIT;
  } else {
    query = paramOrQuery as
      { page?: number | string; limit?: number | string; size?: number | string } | undefined;
    defaultLimit = legacyDefaultLimit;
    maxLimit = legacyMaxLimit;
  }

  const rawPage = query?.page ? Number(query.page) : DEFAULT_PAGE;
  const page = isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : Math.floor(rawPage);

  const rawLimit = query?.limit !== undefined ? query.limit : query?.size;
  const parsedLimit = rawLimit ? Number(rawLimit) : defaultLimit;
  const limit =
    isNaN(parsedLimit) || parsedLimit < 1
      ? defaultLimit
      : Math.min(maxLimit, Math.floor(parsedLimit));

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

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
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ default: 'id', description: 'Sort by field' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sortBy?: string = 'id';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'Sort order' })
  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
