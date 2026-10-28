import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Họ và tên bệnh nhân' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'BN-123456', description: 'Mã bệnh nhân bệnh viện' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
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
  @IsString({ message: 'Giới tính phải là chuỗi' })
  @MaxLength(20, { message: 'Giới tính tối đa 20 ký tự' })
  @IsNotEmpty({ message: 'Giới tính không được để trống' })
  gender: string;

  @ApiPropertyOptional({ example: 65.5, description: 'Cân nặng (kg)' })
  @IsOptional()
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @Min(0, { message: 'Cân nặng không được âm' })
  @Max(500, { message: 'Cân nặng không được vượt quá 500 kg' })
  weight?: number;

  @ApiPropertyOptional({ example: 170.0, description: 'Chiều cao (cm)' })
  @IsOptional()
  @IsNumber({}, { message: 'Chiều cao phải là số' })
  @Min(0, { message: 'Chiều cao không được âm' })
  @Max(300, { message: 'Chiều cao không được vượt quá 300 cm' })
  height?: number;

  @ApiPropertyOptional({ example: 1.4, description: 'Hệ số hoạt động thể lực PAL (1.0 - 2.5)' })
  @IsOptional()
  @IsNumber({}, { message: 'Hệ số hoạt động phải là số' })
  @Min(1.0, { message: 'Hệ số hoạt động phải lớn hơn hoặc bằng 1.0' })
  @Max(2.5, { message: 'Hệ số hoạt động không được vượt quá 2.5' })
  activityFactor?: number;

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng',
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(5000, { message: 'Ghi chú không được vượt quá 5000 ký tự' })
  notes?: string;

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng (alias note)',
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(5000, { message: 'Ghi chú không được vượt quá 5000 ký tự' })
  note?: string;
}
