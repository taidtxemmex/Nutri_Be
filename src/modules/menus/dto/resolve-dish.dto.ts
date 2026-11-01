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
  @IsString({ message: 'validation.menus.dish_name_string' })
  @MaxLength(255, { message: 'validation.menus.dish_name_max' })
  name?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống/chín', default: 1.0 })
  @IsOptional()
  @IsNumber({}, { message: 'validation.menus.coefficient_number' })
  @Min(0, { message: 'validation.menus.coefficient_min' })
  @Max(100, { message: 'validation.menus.coefficient_max' })
  coefficient?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu định lượng chi tiết',
    type: [MenuDishDetailDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.details_is_array' })
  @ArrayMaxSize(100, { message: 'validation.menus.details_max_100' })
  @ValidateNested({ each: true })
  @Type(() => MenuDishDetailDto)
  details?: MenuDishDetailDto[];
}
