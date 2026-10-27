import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên bệnh nhân' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'BN-123456', description: 'Mã bệnh nhân bệnh viện' })
  @IsOptional()
  @IsString()
  patientCode?: string;

  @ApiPropertyOptional({ example: '1985-06-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  dob?: string | Date;

  @ApiProperty({ example: 'NAM', description: 'Giới tính (NAM / NU)' })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiPropertyOptional({ example: 65.5, description: 'Cân nặng (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ example: 170.0, description: 'Chiều cao (cm)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  height?: number;

  @ApiPropertyOptional({ example: 1.4, description: 'Hệ số hoạt động thể lực PAL' })
  @IsOptional()
  @IsNumber()
  activityFactor?: number;

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
