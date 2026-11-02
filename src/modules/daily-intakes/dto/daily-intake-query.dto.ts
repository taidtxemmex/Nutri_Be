import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsDateString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyIntakeQueryDto {
  @ApiPropertyOptional({ description: 'ID bệnh nhân lọc' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.patient_id_string' })
  @MaxLength(50, { message: 'validation.daily_intakes.patient_id_max' })
  patientId?: string;

  @ApiPropertyOptional({ description: 'Ngày ăn cụ thể (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.daily_intakes.date_invalid' })
  date?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.daily_intakes.date_invalid' })
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.daily_intakes.date_invalid' })
  toDate?: string;

  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.daily_intakes.page_int' })
  @Min(1, { message: 'validation.daily_intakes.page_min' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mục trên trang', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.daily_intakes.limit_int' })
  @Min(1, { message: 'validation.daily_intakes.limit_min' })
  @Max(100, { message: 'validation.daily_intakes.limit_max' })
  limit?: number = 10;
}
