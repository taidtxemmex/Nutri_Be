import { IsNotEmpty, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'bs_minhtri', description: 'Tên đăng nhập' })
  @IsNotEmpty({ message: 'validation.auth.username_required' })
  @IsString({ message: 'validation.auth.username_string' })
  @MinLength(3, { message: 'validation.auth.username_min_3' })
  @MaxLength(100, { message: 'validation.auth.username_max_100' })
  username: string;

  @ApiProperty({ example: 'P@ssw0rd123!', description: 'Mật khẩu' })
  @IsNotEmpty({ message: 'validation.auth.password_required' })
  @IsString({ message: 'validation.auth.password_string' })
  @MinLength(6, { message: 'validation.auth.password_min_6' })
  @MaxLength(100, { message: 'validation.auth.password_max_100' })
  password: string;

  @ApiPropertyOptional({ example: true, description: 'Ghi nhớ đăng nhập' })
  @IsOptional()
  @IsBoolean({ message: 'validation.auth.remember_me_boolean' })
  rememberMe?: boolean;
}
