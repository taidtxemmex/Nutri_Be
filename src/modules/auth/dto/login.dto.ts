import { IsNotEmpty, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'bs_minhtri', description: 'Tên đăng nhập' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi' })
  username: string;

  @ApiProperty({ example: 'P@ssw0rd123!', description: 'Mật khẩu' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  password: string;

  @ApiPropertyOptional({ example: true, description: 'Ghi nhớ đăng nhập' })
  @IsOptional()
  @IsBoolean({ message: 'rememberMe phải là kiểu boolean' })
  rememberMe?: boolean;
}
