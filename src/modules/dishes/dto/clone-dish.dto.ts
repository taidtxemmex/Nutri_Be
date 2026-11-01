import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class DishCloneRequestDto {
  @ApiPropertyOptional({
    description: 'Tên mới cho món ăn bản sao',
    example: 'Cơm rang dưa bò (Bản sao)',
  })
  @IsString({ message: 'validation.dishes.name_string' })
  @IsOptional()
  @MaxLength(255, { message: 'validation.dishes.name_max' })
  newName?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thay thế (nếu không truyền sẽ sao chép từ món gốc)',
    type: [DishIngredientInputDto],
  })
  @IsArray({ message: 'validation.dishes.details_array' })
  @ArrayMaxSize(100, { message: 'validation.dishes.ingredients_max_100' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsOptional()
  ingredients?: DishIngredientInputDto[];
}

export class DishCloneResponseDto {
  @ApiProperty({ description: 'ID món ăn mới tạo', example: '180' })
  id!: string;

  @ApiProperty({ description: 'ID món gốc được sao chép', example: '152' })
  originalDishId!: string;

  @ApiProperty({ description: 'Tên món ăn mới', example: 'Cơm rang dưa bò (Bản sao)' })
  name!: string;
}
