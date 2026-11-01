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
  @IsString({ message: 'validation.patients.fullname_string' })
  @IsNotEmpty({ message: 'validation.patients.fullname_required' })
  @MaxLength(255, { message: 'validation.patients.fullname_max' })
  fullName: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @IsString({ message: 'validation.patients.phone_string' })
  @MaxLength(20, { message: 'validation.patients.phone_max' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'BN-123456', description: 'Mã bệnh nhân bệnh viện' })
  @IsOptional()
  @IsString({ message: 'validation.patients.code_string' })
  @MaxLength(255, { message: 'validation.patients.code_max' })
  patientCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Tự động sinh mã theo SĐT' })
  @IsOptional()
  @IsBoolean({ message: 'validation.patients.auto_code_boolean' })
  autoGenerateCode?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Tự động sinh mã (alias autoCode từ FE)' })
  @IsOptional()
  @IsBoolean({ message: 'validation.patients.auto_code_boolean' })
  autoCode?: boolean;

  @ApiPropertyOptional({ example: '1985-06-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  dob?: string | Date;

  @ApiPropertyOptional({ example: '1985-06-15', description: 'Ngày sinh (alias dateOfBirth)' })
  @IsOptional()
  dateOfBirth?: string | Date;

  @ApiPropertyOptional({ example: false, description: 'Chỉ lưu năm sinh' })
  @IsOptional()
  @IsBoolean({ message: 'validation.patients.birth_year_only_boolean' })
  birthYearOnly?: boolean;

  @ApiProperty({ example: 'NAM', description: 'Giới tính (NAM / NU)' })
  @IsString({ message: 'validation.patients.gender_string' })
  @MaxLength(20, { message: 'validation.patients.gender_max' })
  @IsNotEmpty({ message: 'validation.patients.gender_required' })
  gender: string;

  @ApiPropertyOptional({ example: 65.5, description: 'Cân nặng (kg)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj, key }) => {
    const raw = obj ? obj[key] : value;
    return raw === '' || raw === null || raw === undefined ? undefined : Number(raw);
  })
  @IsNumber({}, { message: 'validation.patients.weight_number' })
  @IsPositive({ message: 'validation.patients.weight_positive' })
  @Min(0.01, { message: 'validation.patients.weight_min' })
  @Max(500, { message: 'validation.patients.weight_max' })
  weight?: number;

  @ApiPropertyOptional({ example: 170.0, description: 'Chiều cao (cm hoặc m)' })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value, obj, key }) => {
    const raw = obj ? obj[key] : value;
    return raw === '' || raw === null || raw === undefined ? undefined : Number(raw);
  })
  @IsNumber({}, { message: 'validation.patients.height_number' })
  @IsPositive({ message: 'validation.patients.height_positive' })
  @Min(0.01, { message: 'validation.patients.height_min' })
  @Max(300, { message: 'validation.patients.height_max' })
  height?: number;

  @ApiPropertyOptional({ example: 1.4, description: 'Hệ số hoạt động thể lực PAL (0 - 10)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.patients.activity_factor_number' })
  @Min(0, { message: 'validation.patients.activity_factor_min' })
  @Max(10, { message: 'validation.patients.activity_factor_max' })
  activityFactor?: number;

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.notes_string' })
  @MaxLength(5000, { message: 'validation.patients.notes_max' })
  notes?: string;

  @ApiPropertyOptional({
    example: 'Bệnh nhân có tiền sử tiểu đường Type 2',
    description: 'Ghi chú lâm sàng (alias note)',
  })
  @IsOptional()
  @IsString({ message: 'validation.patients.notes_string' })
  @MaxLength(5000, { message: 'validation.patients.notes_max' })
  note?: string;
}
