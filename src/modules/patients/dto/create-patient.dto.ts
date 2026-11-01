import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsPositive,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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
  @MaxLength(255)
  patientCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Tự động sinh mã theo SĐT' })
  @IsOptional()
  @IsBoolean()
  autoGenerateCode?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Tự động sinh mã (alias autoCode từ FE)' })
  @IsOptional()
  @IsBoolean()
  autoCode?: boolean;

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
  @Type(() => Number)
  @Transform(({ value, obj, key }) => {
    const raw = obj ? obj[key] : value;
    return raw === '' || raw === null || raw === undefined ? undefined : Number(raw);
  })
  @IsNumber({}, { message: 'Cân nặng phải là số' })
  @IsPositive({ message: 'Cân nặng phải lớn hơn 0' })
  @Min(0.01, { message: 'Cân nặng phải lớn hơn hoặc bằng 0.01 kg' })
  @Max(500, { message: 'Cân nặng không được vượt quá 500 kg' })
  weight?: number;

  @ApiPropertyOptional({ example: 170.0, description: 'Chiều cao (cm hoặc m)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj, key }) => {
    const raw = obj ? obj[key] : value;
    return raw === '' || raw === null || raw === undefined ? undefined : Number(raw);
  })
  @IsNumber({}, { message: 'Chiều cao phải là số' })
  @IsPositive({ message: 'Chiều cao phải lớn hơn 0' })
  @Min(0.01, { message: 'Chiều cao phải lớn hơn hoặc bằng 0.01' })
  @Max(300, { message: 'Chiều cao không được vượt quá 300 cm' })
  height?: number;

  @ApiPropertyOptional({ example: 1.4, description: 'Hệ số hoạt động thể lực PAL (0 - 10)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'Hệ số hoạt động phải là số' })
  @Min(0, { message: 'Hệ số hoạt động phải lớn hơn hoặc bằng 0' })
  @Max(10, { message: 'Hệ số hoạt động không được vượt quá 10' })
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
