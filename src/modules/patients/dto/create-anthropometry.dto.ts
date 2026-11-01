import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsDateString,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnthropometryDto {
  @ApiPropertyOptional({
    description: 'Ngày đo (YYYY-MM-DD), mặc định là hôm nay',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'validation.patients.anthropometry_date_format' })
  measuredDate?: string;

  @ApiPropertyOptional({
    description: 'Bí danh tiếng Việt cho measuredDate',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'validation.patients.anthropometry_date_format' })
  ngayDo?: string;

  @ApiProperty({
    description: 'Cân nặng (kg)',
    example: 68.5,
  })
  @IsNotEmpty({ message: 'validation.patients.weight_required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.patients.weight_number' })
  @Min(0.01, { message: 'validation.patients.weight_min' })
  @Max(500, { message: 'validation.patients.weight_max' })
  weight: number;

  @ApiProperty({
    description: 'Chiều cao (cm hoặc m)',
    example: 172.0,
  })
  @IsNotEmpty({ message: 'validation.patients.height_required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.patients.height_number' })
  @Min(0.01, { message: 'validation.patients.height_min' })
  @Max(300, { message: 'validation.patients.height_max' })
  height: number;

  @ApiPropertyOptional({
    description: 'Huyết áp tâm thu (mmHg)',
    example: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.systolic_bp_int' })
  @Min(30, { message: 'validation.patients.systolic_bp_min' })
  @Max(300, { message: 'validation.patients.systolic_bp_max' })
  systolicBloodPressure?: number;

  @ApiPropertyOptional({
    description: 'Huyết áp tâm trương (mmHg)',
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.diastolic_bp_int' })
  @Min(20, { message: 'validation.patients.diastolic_bp_min' })
  @Max(200, { message: 'validation.patients.diastolic_bp_max' })
  diastolicBloodPressure?: number;

  @ApiPropertyOptional({
    description: 'Vòng eo (cm)',
    example: 78.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.patients.waist_number' })
  @Min(10, { message: 'validation.patients.waist_min' })
  @Max(300, { message: 'validation.patients.waist_max' })
  waistCircumference?: number;

  @ApiPropertyOptional({
    description: 'Vòng mông (cm)',
    example: 95.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.patients.hip_number' })
  @Min(10, { message: 'validation.patients.hip_min' })
  @Max(300, { message: 'validation.patients.hip_max' })
  hipCircumference?: number;

  @ApiPropertyOptional({
    description: 'Hệ số hoạt động thể lực (PAL)',
    example: 1.55,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.patients.activity_factor_number' })
  @Min(1.0, { message: 'validation.patients.activity_factor_min_1' })
  @Max(2.5, { message: 'validation.patients.activity_factor_max_2_5' })
  activityFactor?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú lâm sàng',
    example: 'Tái khám định kỳ theo hẹn',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.notes_string' })
  @MaxLength(1000, { message: 'validation.patients.notes_max_1000' })
  notes?: string;
}
