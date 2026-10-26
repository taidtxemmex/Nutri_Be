import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ExportDishDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên món' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Danh sách các cột dinh dưỡng cần xuất ra Excel' })
  @IsArray()
  @IsOptional()
  columns?: string[];
}
