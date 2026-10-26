import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX } from '../../../config/constants/regex.constants';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Mã xác thực/token đặt lại mật khẩu' })
  @IsNotEmpty({ message: 'Mã xác thực không được để trống' })
  @IsString({ message: 'Mã xác thực phải là chuỗi' })
  token: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Mật khẩu mới (tối thiểu 8 ký tự, gồm hoa, thường, số, ký tự đặc biệt)',
  })
  @Matches(PASSWORD_REGEX, {
    message:
      'Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt',
  })
  newPassword: string;
}
