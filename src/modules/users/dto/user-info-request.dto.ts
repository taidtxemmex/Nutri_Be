import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserInfoRequestDto {
  @ApiProperty({
    example: '852bb071-7057-41ec-b08e-cbb39e246ea4',
    description: 'User ID (UUID) cần lấy thông tin',
  })
  @IsNotEmpty({ message: 'validation.users.user_id_required' })
  @IsString({ message: 'validation.users.user_id_string' })
  @MaxLength(50, { message: 'validation.users.user_id_max_50' })
  userId: string;
}
