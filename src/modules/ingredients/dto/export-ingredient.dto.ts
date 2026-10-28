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
import { Type } from 'class-transformer';

export class ExportIngredientDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'ID danh mục' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID danh mục phải là số nguyên' })
  @Min(1, { message: 'ID danh mục phải lớn hơn 0' })
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Loại protein' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Loại protein tối đa 50 ký tự' })
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Danh sách cột dinh dưỡng cần xuất (để trống nếu xuất mặc định)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách cột xuất tối đa 100 cột' })
  @IsString({ each: true, message: 'Tên cột phải là chuỗi' })
  @MaxLength(100, { each: true, message: 'Tên cột tối đa 100 ký tự' })
  columns?: string[];
}
