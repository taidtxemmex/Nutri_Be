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
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @MaxLength(100, { message: 'Tên bữa ăn không được vượt quá 100 ký tự' })
  @IsOptional()
  mealName?: string;

  @ApiPropertyOptional({ description: 'Khung giờ ăn (vd: 12:00 hoặc Trưa)', example: '12:00' })
  @IsString({ message: 'Khung giờ ăn phải là chuỗi' })
  @MaxLength(20, { message: 'Khung giờ ăn không được vượt quá 20 ký tự' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn' })
  @IsString()
  @MaxLength(50, { message: 'Trạng thái tối đa 50 ký tự' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách các món ăn trong bữa', type: [MealDishItemDto] })
  @IsArray({ message: 'Danh sách món ăn phải là mảng' })
  @ArrayMaxSize(50, { message: 'Danh sách món ăn trong bữa tối đa 50 món' })
  @ValidateNested({ each: true })
  @Type(() => MealDishItemDto)
  @IsOptional()
  dishes?: MealDishItemDto[];
}
