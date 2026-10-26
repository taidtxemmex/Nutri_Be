import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token được cấp khi đăng nhập' })
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  @IsString({ message: 'Refresh token phải là chuỗi' })
  refreshToken: string;
}
