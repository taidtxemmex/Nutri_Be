import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DailyIntakeExportTemplateType } from '../../../config/enums/domain.enum';

export { DailyIntakeExportTemplateType };

export class DailyIntakeExportRequestDto {
  @ApiProperty({
    description:
      'Mẫu báo cáo xuất: 1: TOTAL_FOOD_GROUP_MULTI_PATIENTS, 2: AVG_GROUP_WEIGHT_PER_PATIENT, 3: DAILY_NUTRIENT_INTAKE_PATIENT, 4: TOTAL_WEIGHT_FOOD_GROUP_MULTI_PATIENTS',
    enum: [1, 2, 3, 4],
    example: 1,
  })
  @IsNotEmpty({ message: 'validation.daily_intakes.export_template_required' })
  @IsInt({ message: 'validation.daily_intakes.export_template_int' })
  @Min(1, { message: 'validation.daily_intakes.export_template_min' })
  @Max(4, { message: 'validation.daily_intakes.export_template_max' })
  templateType: number;

  @ApiProperty({ description: 'Ngày bắt đầu (YYYY-MM-DD)', example: '2026-10-01' })
  @IsNotEmpty({ message: 'validation.daily_intakes.export_from_date_required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.daily_intakes.export_from_date_format' })
  fromDate: string;

  @ApiProperty({ description: 'Ngày kết thúc (YYYY-MM-DD)', example: '2026-10-20' })
  @IsNotEmpty({ message: 'validation.daily_intakes.export_to_date_required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.daily_intakes.export_to_date_format' })
  toDate: string;

  @ApiPropertyOptional({
    description: 'ID bệnh nhân (bắt buộc đối với mẫu 3: DAILY_NUTRIENT_INTAKE_PATIENT)',
    example: '1',
  })
  @IsOptional()
  patientId?: string | number;

  @ApiPropertyOptional({
    description: 'Chế độ xuất chi tiết (dùng cho mẫu 3: BY_MEAL / MEAL hoặc INGREDIENT_ONLY / ALL)',
    example: 'BY_MEAL',
  })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.export_mode_string' })
  @MaxLength(50, { message: 'validation.daily_intakes.export_mode_max' })
  mode?: string;

  /**
   * Khống chế dải ngày y tế tối đa 31 ngày chống quá tải hệ thống và nghẽn tài nguyên VPS
   * Ném HttpException 422 Unprocessable Entity nếu dải ngày vượt quá 31 ngày
   */
  public validateDateRange(): void {
    if (!this.fromDate || !this.toDate) {
      throw new HttpException(
        {
          code: 'EXPORT_DATE_REQUIRED',
          message: 'validation.daily_intakes.export_date_required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const fromParts = this.fromDate.split('-').map(Number);
    const toParts = this.toDate.split('-').map(Number);
    const fromDateObj = new Date(Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]));
    const toDateObj = new Date(Date.UTC(toParts[0], toParts[1] - 1, toParts[2]));

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      throw new HttpException(
        {
          code: 'INVALID_DATE',
          message: 'validation.daily_intakes.invalid_date',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (fromDateObj.getTime() > toDateObj.getTime()) {
      throw new HttpException(
        {
          code: 'INVALID_DATE_RANGE',
          message: 'validation.daily_intakes.invalid_date_range',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const diffDays =
      Math.round((toDateObj.getTime() - fromDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 31) {
      throw new HttpException(
        {
          code: 'EXPORT_DATE_RANGE_EXCEEDED',
          message: 'validation.daily_intakes.export_date_range_exceeded',
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (this.templateType === DailyIntakeExportTemplateType.DAILY_NUTRIENT_INTAKE_PATIENT) {
      if (!this.patientId) {
        throw new HttpException(
          {
            code: 'EXPORT_PATIENT_REQUIRED',
            message: 'validation.daily_intakes.export_patient_required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!this.mode) {
        throw new HttpException(
          {
            code: 'EXPORT_MODE_REQUIRED',
            message: 'validation.daily_intakes.export_mode_required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }
}
