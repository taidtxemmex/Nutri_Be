import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientResponseDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiPropertyOptional({ example: '0987654321' })
  phoneNumber?: string | null;

  @ApiPropertyOptional({ example: 'BN-123456' })
  patientCode?: string | null;

  @ApiPropertyOptional({ example: '1985-06-15' })
  dob?: string | null;

  @ApiPropertyOptional({ example: '1985-06-15' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: false })
  birthYearOnly?: boolean;

  @ApiPropertyOptional({ example: 41 })
  age?: number | null;

  @ApiProperty({ example: 'NAM' })
  gender: string;

  @ApiPropertyOptional({ example: 65.5 })
  weight?: number | null;

  @ApiPropertyOptional({ example: 170.0 })
  height?: number | null;

  @ApiPropertyOptional({ example: 22.7 })
  bmi?: number | null;

  @ApiPropertyOptional({ example: 'NORMAL' })
  bmiLevel?: string | null;

  @ApiPropertyOptional({ example: 'Bình thường' })
  bmiStatus?: string | null;

  @ApiPropertyOptional({ example: 2150 })
  tdee?: number | null;

  @ApiPropertyOptional({ example: 1.4 })
  activityFactor?: number | null;

  @ApiPropertyOptional({ example: 'Ghi chú lâm sàng' })
  notes?: string | null;

  @ApiPropertyOptional({ example: 'Ghi chú lâm sàng' })
  note?: string | null;

  @ApiPropertyOptional()
  createdAt?: string | null;
}
