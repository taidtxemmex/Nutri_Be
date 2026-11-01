import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token được cấp khi đăng nhập' })
  @IsNotEmpty({ message: 'validation.auth.refresh_token_required' })
  @IsString({ message: 'validation.auth.refresh_token_string' })
  @MaxLength(2048, { message: 'validation.auth.refresh_token_max' })
  refreshToken: string;
}
