import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicalRecordResponseDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: '10' })
  patientId: string;

  @ApiProperty({ example: '2026-10-27' })
  examDate: string;

  @ApiPropertyOptional({ example: 'Mệt mỏi, sụt cân' })
  reason?: string | null;

  @ApiProperty({ example: 'Đái tháo đường týp 2 kèm tăng huyết áp' })
  primaryDiagnosis: string;

  @ApiPropertyOptional({ example: 'E11' })
  icd10Code?: string | null;

  @ApiPropertyOptional({ example: 1 })
  diseaseGroupId?: number | null;

  @ApiPropertyOptional({ example: 'Đái tháo đường' })
  diseaseGroupName?: string | null;

  @ApiPropertyOptional({ example: 'Ăn nhiều, uống nhiều, tiểu nhiều' })
  clinicalSymptoms?: string | null;

  @ApiPropertyOptional({ example: 'Tăng huyết áp 5 năm' })
  medicalHistory?: string | null;

  @ApiPropertyOptional({ example: 'Giảm carbohydrate đơn giản, tăng chất xơ' })
  treatmentPlan?: string | null;

  @ApiPropertyOptional({ example: '15' })
  interventionMenuId?: string | null;

  @ApiPropertyOptional({ example: 'Thực đơn tiểu đường 1800 kcal' })
  interventionMenuName?: string | null;

  @ApiProperty({ example: 'uuid-doctor' })
  doctorId: string;

  @ApiPropertyOptional({ example: 'Bác Sĩ Nguyễn Văn A' })
  doctorName?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú lâm sàng' })
  notes?: string | null;

  @ApiProperty({ example: '2026-10-27T08:00:00.000Z' })
  createdAt: string;
}
