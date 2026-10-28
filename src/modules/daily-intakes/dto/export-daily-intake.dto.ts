import { IsEnum, IsOptional, IsString, IsDateString, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DailyIntakeClinicalReportType } from '../../../config/enums/domain.enum';

export class ExportDailyIntakeDto {
  @ApiPropertyOptional({
    enum: DailyIntakeClinicalReportType,
    default: DailyIntakeClinicalReportType.ALL_IN_ONE,
    description:
      'Mẫu báo cáo lâm sàng: ALL_IN_ONE | RDA_COMPARISON | PLC_STRUCTURE | MEAL_DISTRIBUTION | INGREDIENT_DETAILS',
  })
  @IsOptional()
  @IsEnum(DailyIntakeClinicalReportType)
  reportType?: DailyIntakeClinicalReportType = DailyIntakeClinicalReportType.ALL_IN_ONE;
}

export class ImportDailyIntakeQueryDto {
  @ApiPropertyOptional({
    description: 'ID bệnh nhân sở hữu khẩu phần 24h (tùy chọn khi dùng file mẫu đa bệnh nhân)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'ID bệnh nhân tối đa 50 ký tự' })
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Ngày ăn (định dạng YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Ghi đè nếu đã tồn tại bản ghi khẩu phần 24h cùng ngày của bệnh nhân',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean = false;
}
