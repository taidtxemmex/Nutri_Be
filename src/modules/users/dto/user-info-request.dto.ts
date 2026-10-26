import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserInfoRequestDto {
  @ApiProperty({
    example: '852bb071-7057-41ec-b08e-cbb39e246ea4',
    description: 'User ID (UUID) cần lấy thông tin',
  })
  @IsNotEmpty({ message: 'userId không được để trống' })
  @IsString({ message: 'userId phải là chuỗi' })
  userId: string;
}
