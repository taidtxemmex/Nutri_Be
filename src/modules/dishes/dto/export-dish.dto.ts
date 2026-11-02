import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class ExportDishDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên món' })
  @IsString({ message: 'validation.dishes.name_string' })
  @IsOptional()
  @MaxLength(255, { message: 'validation.dishes.keyword_max' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Danh sách các cột dinh dưỡng cần xuất ra Excel' })
  @IsArray({ message: 'validation.dishes.columns_array' })
  @ArrayMaxSize(100, { message: 'validation.dishes.export_columns_max' })
  @IsString({ each: true, message: 'validation.dishes.column_string' })
  @MaxLength(100, { each: true, message: 'validation.dishes.column_max' })
  @IsOptional()
  columns?: string[];
}
