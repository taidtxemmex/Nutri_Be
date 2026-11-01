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
  @IsInt()
  @Min(1)
  @Max(10000)
  servings?: number = 1;

  @ApiPropertyOptional({
    description: 'Chu kỳ lọc đi chợ: "ALL" | "WEEK" | "DAY"',
    default: 'ALL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cycle?: 'ALL' | 'WEEK' | 'DAY' | string = 'ALL';

  @ApiPropertyOptional({ description: 'Tuần số cần xuất (nếu cycle=WEEK hoặc DAY)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  week?: number;

  @ApiPropertyOptional({ description: 'Thứ trong tuần (1..7 hoặc 2..8) nếu cycle=DAY' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  day?: number;
}
