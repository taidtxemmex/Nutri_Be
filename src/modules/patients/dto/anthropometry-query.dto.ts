import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AnthropometryQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại (bắt đầu từ 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.page_int' })
  @Min(1, { message: 'validation.patients.page_min' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số bản ghi trên mỗi trang (1-100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.limit_int' })
  @Min(1, { message: 'validation.patients.limit_min' })
  @Max(100, { message: 'validation.daily_intakes.limit_max' })
  limit?: number = 20;
}
