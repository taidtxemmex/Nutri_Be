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
  @IsDateString({}, { message: 'Ngày đo không hợp lệ (YYYY-MM-DD)' })
  measuredDate?: string;

  @ApiPropertyOptional({
    description: 'Bí danh tiếng Việt cho measuredDate',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày đo không hợp lệ (YYYY-MM-DD)' })
  ngayDo?: string;

  @ApiProperty({
    description: 'Cân nặng (kg)',
    example: 68.5,
  })
  @IsNotEmpty({ message: 'Cân nặng không được để trống' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(0.5, { message: 'Cân nặng phải lớn hơn hoặc bằng 0.5 kg' })
  @Max(500, { message: 'Cân nặng không được vượt quá 500 kg' })
  weight: number;

  @ApiProperty({
    description: 'Chiều cao (cm)',
    example: 172.0,
  })
  @IsNotEmpty({ message: 'Chiều cao không được để trống' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều cao phải là số' })
  @Min(20, { message: 'Chiều cao phải lớn hơn hoặc bằng 20 cm' })
  @Max(300, { message: 'Chiều cao không được vượt quá 300 cm' })
  height: number;

  @ApiPropertyOptional({
    description: 'Huyết áp tâm thu (mmHg)',
    example: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Huyết áp tâm thu phải là số nguyên' })
  @Min(30, { message: 'Huyết áp tâm thu phải lớn hơn hoặc bằng 30 mmHg' })
  @Max(300, { message: 'Huyết áp tâm thu không được vượt quá 300 mmHg' })
  systolicBloodPressure?: number;

  @ApiPropertyOptional({
    description: 'Huyết áp tâm trương (mmHg)',
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Huyết áp tâm trương phải là số nguyên' })
  @Min(20, { message: 'Huyết áp tâm trương phải lớn hơn hoặc bằng 20 mmHg' })
  @Max(200, { message: 'Huyết áp tâm trương không được vượt quá 200 mmHg' })
  diastolicBloodPressure?: number;

  @ApiPropertyOptional({
    description: 'Vòng eo (cm)',
    example: 78.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Vòng eo phải là số' })
  @Min(10, { message: 'Vòng eo phải lớn hơn hoặc bằng 10 cm' })
  @Max(300, { message: 'Vòng eo không được vượt quá 300 cm' })
  waistCircumference?: number;

  @ApiPropertyOptional({
    description: 'Vòng mông (cm)',
    example: 95.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Vòng mông phải là số' })
  @Min(10, { message: 'Vòng mông phải lớn hơn hoặc bằng 10 cm' })
  @Max(300, { message: 'Vòng mông không được vượt quá 300 cm' })
  hipCircumference?: number;

  @ApiPropertyOptional({
    description: 'Hệ số hoạt động thể lực (PAL)',
    example: 1.55,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số hoạt động phải là số' })
  @Min(1.0, { message: 'Hệ số hoạt động phải lớn hơn hoặc bằng 1.0' })
  @Max(2.5, { message: 'Hệ số hoạt động không được vượt quá 2.5' })
  activityFactor?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú lâm sàng',
    example: 'Tái khám định kỳ theo hẹn',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú không được vượt quá 1000 ký tự' })
  notes?: string;
}
