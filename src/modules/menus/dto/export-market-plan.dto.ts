import { IsInt, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExportMarketPlanDto {
  @ApiPropertyOptional({
    type: Number,
    default: 1,
    description: 'Số suất ăn cần tính toán định lượng đi chợ (mặc định 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.menus.servings_int' })
  @Min(1, { message: 'validation.menus.servings_min' })
  @Max(10000, { message: 'validation.menus.servings_max_10k' })
  servings?: number = 1;

  @ApiPropertyOptional({
    description: 'Chu kỳ lọc đi chợ: "ALL" | "WEEK" | "DAY"',
    default: 'ALL',
  })
  @IsOptional()
  @IsString({ message: 'validation.menus.cycle_string' })
  @MaxLength(50, { message: 'validation.menus.cycle_max' })
  cycle?: 'ALL' | 'WEEK' | 'DAY' | string = 'ALL';

  @ApiPropertyOptional({ description: 'Tuần số cần xuất (nếu cycle=WEEK hoặc DAY)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.menus.week_number_int' })
  @Min(1, { message: 'validation.menus.week_no_min' })
  @Max(52, { message: 'validation.menus.week_no_max' })
  week?: number;

  @ApiPropertyOptional({ description: 'Thứ trong tuần (1..7 hoặc 2..8) nếu cycle=DAY' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.menus.day_of_week_int' })
  @Min(1, { message: 'validation.menus.day_of_week_min' })
  @Max(8, { message: 'validation.menus.day_of_week_max' })
  day?: number;
}
