import { IsEmail, IsNotEmpty, Matches, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PHONE_REGEX,
  PASSWORD_REGEX,
  USERNAME_REGEX,
} from '../../../config/constants/regex.constants';

export class RegisterDto {
  @ApiProperty({ example: 'bs_minhtri', description: 'Tên đăng nhập từ 4-30 ký tự' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @Matches(USERNAME_REGEX, {
    message:
      'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang hoặc dấu chấm (4-30 ký tự)',
  })
  username: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, thường, số, ký tự đặc biệt',
  })
  @Matches(PASSWORD_REGEX, {
    message:
      'Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Minh Trí', description: 'Họ và tên đầy đủ' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  fullName: string;

  @ApiProperty({ example: 'bsminhtri@gmail.com', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '0987654321', description: 'Số điện thoại Việt Nam' })
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone: string;

  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Địa chỉ nơi ở' })
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'NAM', enum: ['NAM', 'NU'], description: 'Giới tính' })
  @IsEnum(['NAM', 'NU'], { message: 'Giới tính phải là NAM hoặc NU' })
  gender: 'NAM' | 'NU';

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải có định dạng YYYY-MM-DD' })
  dob?: string;
}
