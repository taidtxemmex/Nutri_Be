import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MealDishItemDto } from './create-meal.dto';

export class UpdateMealDto {
  @ApiPropertyOptional({ description: 'Tên bữa ăn', example: 'Bữa trưa dinh dưỡng' })
  @IsString({ message: 'validation.meals.name_string' })
  @MaxLength(100, { message: 'validation.meals.name_max' })
  @IsOptional()
  mealName?: string;

  @ApiPropertyOptional({ description: 'Alias tên bữa ăn (từ MealTable.jsx)' })
  @IsString({ message: 'validation.meals.name_string' })
  @MaxLength(100, { message: 'validation.meals.name_max' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (từ MealTable.jsx)', example: '07:00' })
  @IsString({ message: 'validation.meals.start_time_string' })
  @MaxLength(20, { message: 'validation.meals.start_time_max' })
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Giờ kết thúc (từ MealTable.jsx)', example: '08:00' })
  @IsString({ message: 'validation.meals.end_time_string' })
  @MaxLength(20, { message: 'validation.meals.end_time_max' })
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Mô tả bữa ăn (từ MealTable.jsx)' })
  @IsString({ message: 'validation.meals.desc_string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Khung giờ ăn (vd: 12:00 hoặc Trưa)', example: '12:00' })
  @IsString({ message: 'validation.meals.time_string' })
  @MaxLength(50, { message: 'validation.meals.time_max' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn' })
  @IsString({ message: 'validation.meals.status_string' })
  @MaxLength(50, { message: 'validation.meals.status_max' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư' })
  @IsBoolean({ message: 'validation.meals.is_public_boolean' })
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách các món ăn trong bữa', type: [MealDishItemDto] })
  @IsArray({ message: 'validation.meals.dishes_array' })
  @ArrayMaxSize(50, { message: 'validation.meals.dishes_max_50' })
  @ValidateNested({ each: true })
  @Type(() => MealDishItemDto)
  @IsOptional()
  dishes?: MealDishItemDto[];
}
