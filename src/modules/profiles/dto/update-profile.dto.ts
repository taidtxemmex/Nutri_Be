import { IsOptional, Matches, IsEnum, IsString, MaxLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';
import { Gender } from '../../../config/enums';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'Họ và tên phải là chuỗi' })
  @MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @Transform(({ value }) =>
    typeof value === 'string' &&
    (value.trim() === '' || value.trim() === 'Chưa có' || value.trim() === 'Chưa cập nhật')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @MaxLength(255, { message: 'Địa chỉ tối đa 255 ký tự' })
  address?: string;

  @ApiPropertyOptional({ example: Gender.NAM, enum: Gender, description: 'Giới tính' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính phải là NAM hoặc NU' })
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @MaxLength(20, { message: 'Ngày sinh tối đa 20 ký tự' })
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @MaxLength(20, { message: 'Ngày sinh tối đa 20 ký tự' })
  birthDate?: string;
}
