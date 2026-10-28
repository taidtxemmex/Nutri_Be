import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DishIngredientInputDto } from './create-dish.dto';

export class UpdateDishDto {
  @ApiPropertyOptional({ description: 'Tên món ăn', example: 'Cơm rang dưa bò đặc biệt' })
  @IsString({ message: 'Tên món ăn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thành phần',
    type: [DishIngredientInputDto],
  })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu không được vượt quá 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsOptional()
  details?: DishIngredientInputDto[];
}
