import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token được cấp khi đăng nhập' })
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  @IsString({ message: 'Refresh token phải là chuỗi' })
  @MaxLength(2048, { message: 'Refresh token không được vượt quá 2048 ký tự' })
  refreshToken: string;
}
