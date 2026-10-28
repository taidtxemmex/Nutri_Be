import { IsNotEmpty, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'bs_minhtri', description: 'Tên đăng nhập' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi' })
  @MinLength(3, { message: 'Tên đăng nhập tối thiểu 3 ký tự' })
  @MaxLength(100, { message: 'Tên đăng nhập không được vượt quá 100 ký tự' })
  username: string;

  @ApiProperty({ example: 'P@ssw0rd123!', description: 'Mật khẩu' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  @MaxLength(100, { message: 'Mật khẩu không được vượt quá 100 ký tự' })
  password: string;

  @ApiPropertyOptional({ example: true, description: 'Ghi nhớ đăng nhập' })
  @IsOptional()
  @IsBoolean({ message: 'rememberMe phải là kiểu boolean' })
  rememberMe?: boolean;
}
