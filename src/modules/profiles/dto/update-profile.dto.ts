import { IsOptional, Matches, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../config/constants/regex.constants';
import { Gender } from '../../../config/enums';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Minh Trí', description: 'Họ và tên' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321', description: 'Số điện thoại' })
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @ApiPropertyOptional({ example: '123 Giải Phóng, Hà Nội', description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: Gender.NAM, enum: Gender, description: 'Giới tính' })
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính phải là NAM hoặc NU' })
  gender?: Gender;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Alias ngày sinh cho Frontend cũ (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  birthDate?: string;
}
