import {
  IsOptional,
  Matches,
  IsEnum,
  IsString,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';

export class UpdateUserInfoReqDto {
  @ApiPropertyOptional({ description: 'Keycloak User ID hoặc UUID tương ứng' })
  @IsOptional()
  @IsString({ message: 'validation.users.keycloak_user_id_string' })
  @MaxLength(255, { message: 'validation.users.keycloak_user_id_max_255' })
  keycloakUserId?: string;

  @ApiPropertyOptional({ description: 'User ID (UUID)' })
  @IsOptional()
  @IsString({ message: 'validation.users.user_id_string' })
  @MaxLength(50, { message: 'validation.users.user_id_max_50' })
  userId?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.fullname_string' })
  @MinLength(2, { message: 'validation.users.fullname_min_2' })
  @MaxLength(255, { message: 'validation.users.fullname_max_255' })
  fullName?: string;

  @ApiPropertyOptional({ example: 'bsminhtri@gmail.com', description: 'Email' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.email_string' })
  @IsEmail({}, { message: 'validation.users.email_invalid' })
  @MaxLength(255, { message: 'validation.users.email_max_255' })
  email?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @Transform(({ value }) =>
    typeof value === 'string' &&
    (value.trim() === '' ||
      value.trim() === 'Chưa có' ||
      value.trim() === 'Chưa cập nhật' ||
      value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.phone_string' })
  @MaxLength(20, { message: 'validation.users.phone_max_20' })
  @Matches(PHONE_REGEX, { message: 'validation.users.phone_vietnam_format' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @Transform(({ value }) =>
    typeof value === 'string' &&
    (value.trim() === '' ||
      value.trim() === 'Chưa có' ||
      value.trim() === 'Chưa cập nhật' ||
      value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.address_string' })
  @MaxLength(500, { message: 'validation.users.address_max_500' })
  address?: string;

  @ApiPropertyOptional({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @Transform(({ value }) =>
    typeof value === 'string' &&
    (value.trim() === '' ||
      value.trim() === 'Chưa có' ||
      value.trim() === 'Chưa cập nhật' ||
      value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsEnum(['NAM', 'NU'], { message: 'validation.users.gender_enum' })
  gender?: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (
      trimmed === '' ||
      trimmed === 'Chưa có' ||
      trimmed === 'Chưa cập nhật' ||
      trimmed === 'Chưa có email'
    ) {
      return undefined;
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
  })
  @IsOptional()
  @IsString({ message: 'validation.users.dob_string' })
  @MaxLength(10, { message: 'validation.users.dob_max_10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.users.dob_format' })
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (
      trimmed === '' ||
      trimmed === 'Chưa có' ||
      trimmed === 'Chưa cập nhật' ||
      trimmed === 'Chưa có email'
    ) {
      return undefined;
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
  })
  @IsOptional()
  @IsString({ message: 'validation.users.dob_string' })
  @MaxLength(10, { message: 'validation.users.dob_max_10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.users.dob_format' })
  birthDate?: string;

  // Career / Job fields mapping to nguoi_de_xuat
  @ApiPropertyOptional({ example: 'Bác sĩ Chuyên khoa I', description: 'Trình độ học vấn' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.education_string' })
  @MaxLength(100, { message: 'validation.users.education_max_100' })
  education?: string;

  @ApiPropertyOptional({ example: 'Dinh dưỡng Lâm sàng', description: 'Chuyên ngành' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.specialty_string' })
  @MaxLength(100, { message: 'validation.users.specialty_max_100' })
  major?: string;

  @ApiPropertyOptional({ example: 'Bệnh viện Bạch Mai', description: 'Đơn vị công tác' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.workplace_string' })
  @MaxLength(255, { message: 'validation.users.workplace_max_255' })
  unit?: string;

  @ApiPropertyOptional({
    example: 'Bệnh viện Bạch Mai',
    description: 'Đơn vị công tác (alias workUnit)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.workplace_string' })
  @MaxLength(255, { message: 'validation.users.workplace_max_255' })
  workUnit?: string;

  @ApiPropertyOptional({ example: 'Bác sĩ điều trị', description: 'Vị trí công tác' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.position_string' })
  @MaxLength(100, { message: 'validation.users.position_max_100' })
  position?: string;

  @ApiPropertyOptional({ example: 'Hồi sức tích cực', description: 'Lĩnh vực công tác' })
  @Transform(({ value }) =>
    typeof value === 'string' && (value.trim() === '' || value.trim() === 'Chưa có email')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.users.field_of_work_string' })
  @MaxLength(100, { message: 'validation.users.field_of_work_max_100' })
  field?: string;
}
