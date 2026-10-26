import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiPropertyOptional({ description: 'Google ID Token từ client SDK' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ description: 'Mã xác thực 1 lần khi redirect OAuth2' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Google Credential (ID Token) từ Google Identity Services button',
  })
  @IsOptional()
  @IsString()
  credential?: string;
}
