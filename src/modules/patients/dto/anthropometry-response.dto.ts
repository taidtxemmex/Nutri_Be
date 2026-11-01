import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnthropometryResponseDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ example: '10' })
  patientId: string;

  @ApiProperty({ example: '2026-10-27' })
  measuredDate: string;

  @ApiProperty({ example: 68.5 })
  weight: number;

  @ApiProperty({ example: 172.0 })
  height: number;

  @ApiProperty({ example: 23.2 })
  bmi: number;

  @ApiProperty({ example: 'OVERWEIGHT' })
  bmiLevel: string;

  @ApiProperty({ example: 'Thừa cân' })
  bmiStatus: string;

  @ApiPropertyOptional({ example: 1650 })
  bmr?: number | null;

  @ApiPropertyOptional({ example: 2558 })
  tdee?: number | null;

  @ApiPropertyOptional({ example: 120 })
  systolicBloodPressure?: number | null;

  @ApiPropertyOptional({ example: 80 })
  diastolicBloodPressure?: number | null;

  @ApiPropertyOptional({ example: 78.5 })
  waistCircumference?: number | null;

  @ApiPropertyOptional({ example: 95.0 })
  hipCircumference?: number | null;

  @ApiPropertyOptional({ example: 1.55 })
  activityFactor?: number | null;

  @ApiPropertyOptional({ example: 'Ghi chú lâm sàng' })
  notes?: string | null;

  @ApiProperty({ example: 'uuid-doctor' })
  creatorId: string;

  @ApiProperty({ example: '2026-10-27T08:00:00.000Z' })
  createdAt: string;
}
