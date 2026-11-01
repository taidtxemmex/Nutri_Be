import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DishIngredientInputDto } from './create-dish.dto';

export class UpdateDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn (tùy chọn từ FE)' })
  @IsOptional()
  id?: number | string;

  @ApiPropertyOptional({ description: 'Tên món ăn', example: 'Cơm rang dưa bò đặc biệt' })
  @IsString({ message: 'validation.dishes.name_string' })
  @MaxLength(255, { message: 'validation.dishes.name_max' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh món ăn (relative path, không chứa domain)',
    example: '/uploads/public/dishes/2026/11/abc-dish.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.dishes.image_url_string' })
  @MaxLength(500, { message: 'validation.dishes.image_url_max' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case cho imageUrl',
    example: '/uploads/public/dishes/2026/11/abc-dish.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.dishes.image_url_string' })
  @MaxLength(500, { message: 'validation.dishes.image_url_max' })
  image_url?: string;

  @ApiPropertyOptional({ description: 'Trạng thái món ăn' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Món ăn công khai hay riêng tư' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Hệ số sống chín' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber()
  coefficient?: number;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thành phần',
    type: [DishIngredientInputDto],
  })
  @IsArray({ message: 'validation.dishes.details_array' })
  @ArrayMaxSize(100, { message: 'validation.dishes.ingredients_max_100' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsOptional()
  details?: DishIngredientInputDto[];
}
