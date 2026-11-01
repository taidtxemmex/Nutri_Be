import { IsOptional, Matches, IsEnum, IsString, MaxLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';
import { Gender } from '../../../config/enums';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'validation.profiles.fullname_string' })
  @MaxLength(255, { message: 'validation.profiles.fullname_max_255' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @Transform(({ value }) =>
    typeof value === 'string' &&
    (value.trim() === '' || value.trim() === 'Chưa có' || value.trim() === 'Chưa cập nhật')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'validation.profiles.phone_string' })
  @MaxLength(20, { message: 'validation.profiles.phone_max_20' })
  @Matches(PHONE_REGEX, { message: 'validation.profiles.phone_vietnam_format' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'validation.profiles.address_string' })
  @MaxLength(255, { message: 'validation.profiles.address_max_255' })
  address?: string;

  @ApiPropertyOptional({ example: Gender.NAM, enum: Gender, description: 'Giới tính' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsEnum(Gender, { message: 'validation.profiles.gender_enum' })
  gender?: Gender;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'Chưa có' || trimmed === 'Chưa cập nhật') {
      return undefined;
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.profiles.dob_format' })
  @IsDateString({}, { message: 'validation.profiles.dob_format' })
  @MaxLength(20, { message: 'validation.profiles.dob_max_20' })
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'Chưa có' || trimmed === 'Chưa cập nhật') {
      return undefined;
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.profiles.dob_format' })
  @IsDateString({}, { message: 'validation.profiles.dob_format' })
  @MaxLength(20, { message: 'validation.profiles.dob_max_20' })
  birthDate?: string;

  @ApiPropertyOptional({
    example: '/uploads/public/avatars/2026/11/abc-avatar.jpg',
    description: 'Đường dẫn ảnh đại diện (relative path, không chứa domain)',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'validation.profiles.avatar_url_string' })
  @MaxLength(500, { message: 'validation.profiles.avatar_url_max_500' })
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: '/uploads/public/avatars/2026/11/abc-avatar.jpg',
    description: 'Alias snake_case cho avatarUrl',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'validation.profiles.avatar_url_string' })
  @MaxLength(500, { message: 'validation.profiles.avatar_url_max_500' })
  avatar_url?: string;
}
