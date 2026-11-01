import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserInfoRequestDto {
  @ApiProperty({
    example: '852bb071-7057-41ec-b08e-cbb39e246ea4',
    description: 'User ID (UUID) cần lấy thông tin',
  })
  @IsNotEmpty({ message: 'userId không được để trống' })
  @IsString({ message: 'userId phải là chuỗi' })
  @MaxLength(50, { message: 'userId tối đa 50 ký tự' })
  userId: string;
}
