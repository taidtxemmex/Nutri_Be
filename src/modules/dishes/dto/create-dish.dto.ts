import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsInt,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class DishIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu thành phần', example: 1 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? value : Number(value),
  )
  @IsInt({ message: 'validation.dishes.ingredient_id_int' })
  @Min(1, { message: 'validation.dishes.ingredient_id_min' })
  @IsNotEmpty({ message: 'validation.dishes.ingredient_id_required' })
  ingredientId!: number;

  @ApiProperty({ description: 'Khối lượng sống sạch (gam)', example: 100.0 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? value : Number(value),
  )
  @IsNumber({}, { message: 'validation.dishes.weight_number' })
  @Min(0, { message: 'validation.dishes.weight_min' })
  @Max(1000000, { message: 'validation.dishes.weight_max' })
  @IsNotEmpty({ message: 'validation.dishes.weight_required' })
  netWeight!: number;
}

export class CreateDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn (tùy chọn từ FE)' })
  @IsOptional()
  id?: number | string;

  @ApiProperty({ description: 'Tên món ăn', example: 'Cơm rang dưa bò' })
  @IsString({ message: 'validation.dishes.name_string' })
  @MaxLength(255, { message: 'validation.dishes.name_max' })
  @IsNotEmpty({ message: 'validation.dishes.name_required' })
  name!: string;

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
  @IsString({ message: 'validation.dishes.status_string' })
  status?: string;

  @ApiPropertyOptional({ description: 'Món ăn công khai hay riêng tư' })
  @IsOptional()
  @IsBoolean({ message: 'validation.dishes.is_public_boolean' })
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Hệ số sống chín' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.dishes.coefficient_number' })
  coefficient?: number;

  @ApiProperty({ description: 'Danh sách nguyên liệu thành phần', type: [DishIngredientInputDto] })
  @IsArray({ message: 'validation.dishes.details_array' })
  @ArrayMinSize(1, { message: 'validation.dishes.ingredients_min_1' })
  @ArrayMaxSize(100, { message: 'validation.dishes.ingredients_max_100' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsNotEmpty({ message: 'validation.dishes.details_required' })
  details!: DishIngredientInputDto[];
}
