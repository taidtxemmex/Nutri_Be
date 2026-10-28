import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Mã token xác thực duy nhất nhận qua email' })
  @IsNotEmpty({ message: 'Token xác thực không được để trống' })
  @IsString({ message: 'Token xác thực phải là chuỗi' })
  @MinLength(1, { message: 'Token xác thực không được để trống' })
  @MaxLength(64, { message: 'Token xác thực không được vượt quá 64 ký tự' })
  token: string;
}
