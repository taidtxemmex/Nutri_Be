import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiPropertyOptional({ description: 'Google ID Token từ client SDK' })
  @IsOptional()
  @IsString()
  @MaxLength(4096, { message: 'idToken không được vượt quá 4096 ký tự' })
  idToken?: string;

  @ApiPropertyOptional({ description: 'Mã xác thực 1 lần khi redirect OAuth2' })
  @IsOptional()
  @IsString()
  @MaxLength(1024, { message: 'code không được vượt quá 1024 ký tự' })
  code?: string;

  @ApiPropertyOptional({
    description: 'Google Credential (ID Token) từ Google Identity Services button',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096, { message: 'credential không được vượt quá 4096 ký tự' })
  credential?: string;
}
