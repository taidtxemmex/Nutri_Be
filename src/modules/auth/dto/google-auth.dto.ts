import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiPropertyOptional({ description: 'Google ID Token từ client SDK' })
  @IsOptional()
  @IsString({ message: 'validation.auth.id_token_string' })
  @MaxLength(4096, { message: 'validation.auth.id_token_max' })
  idToken?: string;

  @ApiPropertyOptional({ description: 'Mã xác thực 1 lần khi redirect OAuth2' })
  @IsOptional()
  @IsString({ message: 'validation.auth.code_string' })
  @MaxLength(1024, { message: 'validation.auth.code_max' })
  code?: string;

  @ApiPropertyOptional({
    description: 'Google Credential (ID Token) từ Google Identity Services button',
  })
  @IsOptional()
  @IsString({ message: 'validation.auth.credential_string' })
  @MaxLength(4096, { message: 'validation.auth.credential_max' })
  credential?: string;
}
