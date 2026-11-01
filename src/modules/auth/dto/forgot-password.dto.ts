import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EMAIL_OR_USERNAME_REGEX } from '../../../config/constants/regex.constants';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'bsminhtri@gmail.com',
    description: 'Địa chỉ email hoặc tên đăng nhập đã đăng ký',
  })
  @IsNotEmpty({ message: 'validation.auth.email_or_username_required' })
  @IsString({ message: 'validation.auth.email_or_username_string' })
  @MaxLength(255, { message: 'validation.auth.email_or_username_max' })
  @Matches(EMAIL_OR_USERNAME_REGEX, {
    message: 'validation.auth.email_or_username_pattern',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'https://truenutri.pages.dev',
    description: 'Địa chỉ frontend nhận link đặt lại mật khẩu (tùy chọn)',
  })
  @IsOptional()
  @IsString({ message: 'validation.auth.redirect_url_string' })
  @MaxLength(500, { message: 'validation.auth.redirect_url_max' })
  redirectUrl?: string;
}
