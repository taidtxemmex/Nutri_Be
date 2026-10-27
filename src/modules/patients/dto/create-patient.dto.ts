import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
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

  @ApiPropertyOptional({ example: true, description: 'Tự động sinh mã theo SĐT' })
  @IsOptional()
  @IsBoolean()
  autoGenerateCode?: boolean;

  @ApiPropertyOptional({ example: '1985-06-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  dob?: string | Date;

  @ApiPropertyOptional({ example: '1985-06-15', description: 'Ngày sinh (alias dateOfBirth)' })
  @IsOptional()
  dateOfBirth?: string | Date;

  @ApiPropertyOptional({ example: false, description: 'Chỉ lưu năm sinh' })
  @IsOptional()
  @IsBoolean()
  birthYearOnly?: boolean;

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

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng (alias note)',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
