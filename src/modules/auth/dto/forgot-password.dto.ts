import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'bsminhtri@gmail.com', description: 'Địa chỉ email đã đăng ký' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email: string;
}
