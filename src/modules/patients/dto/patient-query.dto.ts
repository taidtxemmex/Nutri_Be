import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatientQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên, số điện thoại, mã bệnh nhân' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
  search?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (alias của search)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({ default: 1, description: 'Số trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Số bản ghi mỗi trang (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
