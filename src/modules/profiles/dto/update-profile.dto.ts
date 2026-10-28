import { IsOptional, Matches, IsEnum, IsString, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';
import { Gender } from '../../../config/enums';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @IsOptional()
  @IsString({ message: 'Họ và tên phải là chuỗi' })
  @MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @MaxLength(255, { message: 'Địa chỉ tối đa 255 ký tự' })
  address?: string;

  @ApiPropertyOptional({ example: Gender.NAM, enum: Gender, description: 'Giới tính' })
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính phải là NAM hoặc NU' })
  gender?: Gender;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @MaxLength(20, { message: 'Ngày sinh tối đa 20 ký tự' })
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  @MaxLength(20, { message: 'Ngày sinh tối đa 20 ký tự' })
  birthDate?: string;
}
