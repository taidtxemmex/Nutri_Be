import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DishIngredientInputDto } from './create-dish.dto';

export class UpdateDishDto {
  @ApiPropertyOptional({ description: 'Tên món ăn', example: 'Cơm rang dưa bò đặc biệt' })
  @IsString({ message: 'Tên món ăn phải là chuỗi' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thành phần',
    type: [DishIngredientInputDto],
  })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsOptional()
  details?: DishIngredientInputDto[];
}
