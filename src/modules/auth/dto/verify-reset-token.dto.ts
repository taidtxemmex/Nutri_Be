import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetTokenDto {
  @ApiProperty({ description: 'Mã token xác thực đặt lại mật khẩu nhận qua email' })
  @IsNotEmpty({ message: 'validation.auth.verify_token_required' })
  @IsString({ message: 'validation.auth.verify_token_string' })
  @MinLength(1, { message: 'validation.auth.verify_token_required' })
  @MaxLength(64, { message: 'validation.auth.verify_token_max' })
  token: string;
}
