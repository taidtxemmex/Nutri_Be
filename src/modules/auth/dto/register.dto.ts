import {
  IsEmail,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PHONE_REGEX,
  PASSWORD_REGEX,
  USERNAME_REGEX,
} from '../../../config/constants/regex.constants';

export class RegisterDto {
  @ApiProperty({ example: 'bs_minhtri', description: 'Tên đăng nhập từ 4-30 ký tự' })
  @IsNotEmpty({ message: 'validation.auth.username_required' })
  @IsString({ message: 'validation.auth.username_string' })
  @MinLength(4, { message: 'validation.auth.username_min_4' })
  @MaxLength(30, { message: 'validation.auth.username_max_30' })
  @Matches(USERNAME_REGEX, {
    message: 'validation.auth.username_pattern',
  })
  username: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, thường, số, ký tự đặc biệt',
  })
  @IsNotEmpty({ message: 'validation.auth.password_required' })
  @IsString({ message: 'validation.auth.password_string' })
  @MinLength(8, { message: 'validation.auth.password_min_8' })
  @MaxLength(100, { message: 'validation.auth.password_max_100' })
  @Matches(PASSWORD_REGEX, {
    message: 'validation.auth.password_pattern',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Minh Trí', description: 'Họ và tên đầy đủ' })
  @IsNotEmpty({ message: 'validation.auth.fullname_required' })
  @IsString({ message: 'validation.auth.fullname_string' })
  @MinLength(2, { message: 'validation.auth.fullname_min_2' })
  @MaxLength(255, { message: 'validation.auth.fullname_max_255' })
  fullName: string;

  @ApiProperty({ example: 'bsminhtri@gmail.com', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'validation.auth.email_invalid' })
  @MaxLength(255, { message: 'validation.auth.email_max_255' })
  email: string;

  @ApiProperty({ example: '0987654321', description: 'Số điện thoại Việt Nam' })
  @IsString({ message: 'validation.auth.phone_string' })
  @MaxLength(20, { message: 'validation.auth.phone_max_20' })
  @Matches(PHONE_REGEX, { message: 'validation.auth.phone_pattern' })
  phone: string;

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Địa chỉ nơi ở' })
  @IsOptional()
  @IsString({ message: 'validation.auth.address_string' })
  @MaxLength(255, { message: 'validation.auth.address_max_255' })
  address?: string;

  @ApiProperty({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @IsEnum(['NAM', 'NU'], { message: 'validation.auth.gender_enum' })
  gender: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.auth.dob_format' })
  dob?: string;
}
