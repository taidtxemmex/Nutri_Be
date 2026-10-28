import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MealDishItemDto } from './create-meal.dto';

export class UpdateMealDto {
  @ApiPropertyOptional({ description: 'Tên bữa ăn', example: 'Bữa trưa dinh dưỡng' })
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @IsOptional()
  mealName?: string;

  @ApiPropertyOptional({ description: 'Khung giờ ăn (vd: 12:00 hoặc Trưa)', example: '12:00' })
  @IsString({ message: 'Khung giờ ăn phải là chuỗi' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách các món ăn trong bữa', type: [MealDishItemDto] })
  @IsArray({ message: 'Danh sách món ăn phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => MealDishItemDto)
  @IsOptional()
  dishes?: MealDishItemDto[];
}
