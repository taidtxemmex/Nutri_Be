import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuDishDetailDto } from './create-menu.dto';

export class ResolveDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn gốc (nếu có)' })
  @IsOptional()
  dishId?: string | number;

  @ApiPropertyOptional({ description: 'Tên món ăn (nếu tạo nhanh)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống/chín', default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Hệ số sống chín phải lớn hơn hoặc bằng 0' })
  @Max(100, { message: 'Hệ số sống chín không được vượt quá 100' })
  coefficient?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu định lượng chi tiết',
    type: [MenuDishDetailDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu tối đa 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => MenuDishDetailDto)
  details?: MenuDishDetailDto[];
}
