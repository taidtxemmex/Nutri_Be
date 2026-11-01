import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX } from '../../../config/constants/regex.constants';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Mã xác thực/token đặt lại mật khẩu' })
  @IsNotEmpty({ message: 'validation.auth.reset_token_required' })
  @IsString({ message: 'validation.auth.reset_token_string' })
  @MinLength(1, { message: 'validation.auth.reset_token_required' })
  @MaxLength(64, { message: 'validation.auth.reset_token_max' })
  token: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Mật khẩu mới (tối thiểu 8 ký tự, gồm hoa, thường, số, ký tự đặc biệt)',
  })
  @IsNotEmpty({ message: 'validation.auth.new_password_required' })
  @IsString({ message: 'validation.auth.new_password_string' })
  @MinLength(8, { message: 'validation.auth.new_password_min_8' })
  @MaxLength(100, { message: 'validation.auth.new_password_max_100' })
  @Matches(PASSWORD_REGEX, {
    message: 'validation.auth.password_pattern',
  })
  newPassword: string;
}
