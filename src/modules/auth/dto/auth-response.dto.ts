import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token (15m)' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh Token (7d)' })
  refreshToken: string;

  @ApiPropertyOptional({ description: 'Thời gian hiệu lực của Access Token (giây)', example: 900 })
  expiresIn?: number;

  @ApiProperty({ description: 'User ID (UUID)' })
  userId: string;

  @ApiProperty({ description: 'Tên đăng nhập' })
  username: string;

  @ApiPropertyOptional({ description: 'Địa chỉ email' })
  email?: string;

  @ApiProperty({ description: 'Họ và tên người dùng' })
  fullName: string;

  @ApiProperty({ description: 'Vai trò người dùng' })
  role: string;
}
