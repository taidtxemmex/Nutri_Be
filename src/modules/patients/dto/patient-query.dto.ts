import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatientQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên, số điện thoại, mã bệnh nhân' })
  @IsOptional()
  @IsString({ message: 'validation.patients.search_string' })
  @MaxLength(255, { message: 'validation.patients.search_max' })
  search?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (alias của search)' })
  @IsOptional()
  @IsString({ message: 'validation.patients.keyword_string' })
  @MaxLength(255, { message: 'validation.patients.search_max' })
  keyword?: string;

  @ApiPropertyOptional({ default: 1, description: 'Số trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.page_int' })
  @Min(1, { message: 'validation.patients.page_min' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Số bản ghi mỗi trang (max 1000)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.patients.limit_int' })
  @Min(1, { message: 'validation.patients.limit_min' })
  @Max(1000, { message: 'validation.patients.limit_max' })
  limit?: number = 20;
}
