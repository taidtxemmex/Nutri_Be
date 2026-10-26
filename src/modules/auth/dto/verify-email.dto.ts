import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Mã token xác thực duy nhất nhận qua email' })
  @IsNotEmpty({ message: 'Token xác thực không được để trống' })
  @IsString({ message: 'Token xác thực phải là chuỗi' })
  token: string;
}
