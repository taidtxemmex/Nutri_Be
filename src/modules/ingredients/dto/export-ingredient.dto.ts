import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ExportIngredientDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'ID danh mục' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Loại protein' })
  @IsOptional()
  @IsString()
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Danh sách cột dinh dưỡng cần xuất (để trống nếu xuất mặc định)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  columns?: string[];
}
