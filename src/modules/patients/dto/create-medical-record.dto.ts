import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsDateString, MaxLength, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicalRecordDto {
  @ApiPropertyOptional({
    description: 'Ngày khám (YYYY-MM-DD), mặc định là hôm nay',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày khám không hợp lệ (YYYY-MM-DD)' })
  examDate?: string;

  @ApiPropertyOptional({
    description: 'Bí danh tiếng Việt cho examDate',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày khám không hợp lệ (YYYY-MM-DD)' })
  ngayKham?: string;

  @ApiPropertyOptional({
    description: 'Lý do khám bệnh',
    example: 'Mệt mỏi, sụt cân không rõ nguyên nhân',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do khám không được vượt quá 500 ký tự' })
  reason?: string;

  @ApiProperty({
    description: 'Chẩn đoán chính',
    example: 'Đái tháo đường týp 2 kèm tăng huyết áp',
  })
  @IsNotEmpty({ message: 'Chẩn đoán chính không được để trống' })
  @IsString()
  @MaxLength(500, { message: 'Chẩn đoán chính không được vượt quá 500 ký tự' })
  primaryDiagnosis: string;

  @ApiPropertyOptional({
    description: 'Mã chẩn đoán ICD-10',
    example: 'E11',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Mã ICD-10 không được vượt quá 50 ký tự' })
  icd10Code?: string;

  @ApiPropertyOptional({
    description: 'ID nhóm bệnh mở rộng (fk_med_record_disease)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diseaseGroupId?: number;

  @ApiPropertyOptional({
    description: 'Triệu chứng lâm sàng',
    example: 'Ăn nhiều, uống nhiều, tiểu nhiều',
  })
  @IsOptional()
  @IsString()
  clinicalSymptoms?: string;

  @ApiPropertyOptional({
    description: 'Tiền sử bệnh lý',
    example: 'Tăng huyết áp 5 năm điều trị liên tục',
  })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional({
    description: 'Hướng điều trị / can thiệp dinh dưỡng',
    example: 'Chế độ ăn giảm carbohydrate đơn giản, tăng chất xơ hòa tan',
  })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional({
    description: 'ID thực đơn can thiệp dinh dưỡng gán kèm hồ sơ bệnh án',
    example: '15',
  })
  @IsOptional()
  interventionMenuId?: string | number | bigint;

  @ApiPropertyOptional({
    description: 'Ghi chú lâm sàng bổ sung',
    example: 'Hẹn tái khám sau 2 tuần',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
