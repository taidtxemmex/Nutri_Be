import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicalRecordDto {
  @ApiPropertyOptional({
    description: 'Ngày khám (YYYY-MM-DD), mặc định là hôm nay',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'validation.patients.examination_date_format' })
  examDate?: string;

  @ApiPropertyOptional({
    description: 'Bí danh tiếng Việt cho examDate',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({}, { message: 'validation.patients.examination_date_format' })
  ngayKham?: string;

  @ApiPropertyOptional({
    description: 'Lý do khám bệnh',
    example: 'Mệt mỏi, sụt cân không rõ nguyên nhân',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.reason_string' })
  @MaxLength(500, { message: 'validation.patients.reason_max' })
  reason?: string;

  @ApiProperty({
    description: 'Chẩn đoán chính',
    example: 'Đái tháo đường týp 2 kèm tăng huyết áp',
  })
  @IsNotEmpty({ message: 'validation.patients.primary_diagnosis_required' })
  @IsString({ message: 'validation.patients.primary_diagnosis_string' })
  @MaxLength(500, { message: 'validation.patients.primary_diagnosis_max' })
  primaryDiagnosis: string;

  @ApiPropertyOptional({
    description: 'Mã chẩn đoán ICD-10',
    example: 'E11',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.icd10_code_string' })
  @MaxLength(50, { message: 'validation.patients.icd10_code_max' })
  icd10Code?: string;

  @ApiPropertyOptional({
    description: 'ID nhóm bệnh mở rộng (fk_med_record_disease)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.disease_group_id_int' })
  @Min(1, { message: 'validation.patients.disease_group_id_min' })
  diseaseGroupId?: number;

  @ApiPropertyOptional({
    description: 'Triệu chứng lâm sàng',
    example: 'Ăn nhiều, uống nhiều, tiểu nhiều',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.clinical_symptoms_string' })
  @MaxLength(5000, { message: 'validation.patients.clinical_symptoms_max' })
  clinicalSymptoms?: string;

  @ApiPropertyOptional({
    description: 'Tiền sử bệnh lý',
    example: 'Tăng huyết áp 5 năm điều trị liên tục',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.medical_history_string' })
  @MaxLength(5000, { message: 'validation.patients.medical_history_max' })
  medicalHistory?: string;

  @ApiPropertyOptional({
    description: 'Hướng điều trị / can thiệp dinh dưỡng',
    example: 'Chế độ ăn giảm carbohydrate đơn giản, tăng chất xơ hòa tan',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.treatment_plan_string' })
  @MaxLength(5000, { message: 'validation.patients.treatment_plan_max' })
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
  @IsString({ message: 'validation.patients.notes_string' })
  @MaxLength(2000, { message: 'validation.patients.notes_max_2000' })
  notes?: string;
}
