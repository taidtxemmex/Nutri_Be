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
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi' })
  @MinLength(4, { message: 'Tên đăng nhập tối thiểu 4 ký tự' })
  @MaxLength(30, { message: 'Tên đăng nhập tối đa 30 ký tự' })
  @Matches(USERNAME_REGEX, {
    message:
      'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang hoặc dấu chấm (4-30 ký tự)',
  })
  username: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, thường, số, ký tự đặc biệt',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(100, { message: 'Mật khẩu không được vượt quá 100 ký tự' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Minh Trí', description: 'Họ và tên đầy đủ' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString({ message: 'Họ và tên phải là chuỗi' })
  @MinLength(2, { message: 'Họ và tên tối thiểu 2 ký tự' })
  @MaxLength(255, { message: 'Họ và tên không được vượt quá 255 ký tự' })
  fullName: string;

  @ApiProperty({ example: 'bsminhtri@gmail.com', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự' })
  email: string;

  @ApiProperty({ example: '0987654321', description: 'Số điện thoại Việt Nam' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại không được vượt quá 20 ký tự' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone: string;

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Địa chỉ nơi ở' })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự' })
  address?: string;

  @ApiProperty({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @IsEnum(['NAM', 'NU'], { message: 'Giới tính phải là NAM hoặc NU' })
  gender: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  dob?: string;
}
