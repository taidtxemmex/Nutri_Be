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
  @IsNotEmpty({ message: 'Vui lòng chọn mẫu xuất báo cáo (1..4)' })
  @IsInt({ message: 'Mẫu xuất báo cáo phải là số nguyên (1..4)' })
  @Min(1, { message: 'Mẫu xuất báo cáo không hợp lệ (chỉ nhận 1..4)' })
  @Max(4, { message: 'Mẫu xuất báo cáo không hợp lệ (chỉ nhận 1..4)' })
  templateType: number;

  @ApiProperty({ description: 'Ngày bắt đầu (YYYY-MM-DD)', example: '2026-10-01' })
  @IsNotEmpty({ message: 'Vui lòng chọn ngày bắt đầu' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày bắt đầu phải là YYYY-MM-DD' })
  fromDate: string;

  @ApiProperty({ description: 'Ngày kết thúc (YYYY-MM-DD)', example: '2026-10-20' })
  @IsNotEmpty({ message: 'Vui lòng chọn ngày kết thúc' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng ngày kết thúc phải là YYYY-MM-DD' })
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
  @IsString({ message: 'Chế độ xuất phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Chế độ xuất tối đa 50 ký tự' })
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
          message: 'Vui lòng chọn dải ngày xuất báo cáo',
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
          message: 'Định dạng ngày tháng không hợp lệ (YYYY-MM-DD)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (fromDateObj.getTime() > toDateObj.getTime()) {
      throw new HttpException(
        {
          code: 'INVALID_DATE_RANGE',
          message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc',
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
          message: 'Dải ngày xuất báo cáo không được vượt quá 31 ngày',
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (this.templateType === DailyIntakeExportTemplateType.DAILY_NUTRIENT_INTAKE_PATIENT) {
      if (!this.patientId) {
        throw new HttpException(
          {
            code: 'EXPORT_PATIENT_REQUIRED',
            message: 'Vui lòng chọn bệnh nhân cho mẫu báo cáo này',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!this.mode) {
        throw new HttpException(
          {
            code: 'EXPORT_MODE_REQUIRED',
            message: 'Vui lòng chọn chế độ xuất (BY_MEAL hoặc INGREDIENT_ONLY)',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }
}
