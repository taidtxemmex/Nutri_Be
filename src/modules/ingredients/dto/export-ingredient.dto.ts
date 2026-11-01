import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsArray,
  MaxLength,
  Min,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ExportIngredientDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên' })
  @IsOptional()
  @IsString({ message: 'validation.ingredients.search_string' })
  @MaxLength(255, { message: 'validation.ingredients.search_max' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'ID danh mục' })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.ingredients.category_id_int' })
  @Min(1, { message: 'validation.ingredients.category_id_min' })
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Loại protein' })
  @IsOptional()
  @IsString({ message: 'validation.ingredients.protein_type_string' })
  @MaxLength(50, { message: 'validation.ingredients.protein_type_max' })
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Danh sách cột dinh dưỡng cần xuất (để trống nếu xuất mặc định)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'validation.ingredients.export_columns_array' })
  @ArrayMaxSize(100, { message: 'validation.ingredients.export_columns_max' })
  @IsString({ each: true, message: 'validation.ingredients.column_name_string' })
  @MaxLength(100, { each: true, message: 'validation.ingredients.column_name_max' })
  columns?: string[];
}
