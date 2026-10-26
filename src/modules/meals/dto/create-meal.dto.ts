import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MealDishItemDto {
  @ApiProperty({ description: 'ID món ăn', example: 152 })
  @Type(() => Number)
  @IsNumber({}, { message: 'ID món ăn phải là số' })
  @IsNotEmpty({ message: 'ID món ăn không được để trống' })
  dishId!: number;

  @ApiPropertyOptional({
    description: 'Hệ số sống/chín riêng cho món trong bữa',
    example: 1.0,
    default: 1.0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @IsOptional()
  coefficient?: number;
}

export class CreateMealDto {
  @ApiPropertyOptional({
    description: 'Tên bữa ăn (Sáng, Trưa, Tối, Phụ sáng...)',
    example: 'Bữa sáng tiêu chuẩn',
  })
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @IsOptional()
  mealName?: string;

  @ApiProperty({ description: 'Khung giờ ăn (vd: 07:00 hoặc Sáng)', example: '07:00' })
  @IsString({ message: 'Khung giờ ăn phải là chuỗi' })
  @IsNotEmpty({ message: 'Khung giờ ăn không được để trống' })
  time!: string;

  @ApiPropertyOptional({
    description: 'Trạng thái bữa ăn (RIENG_TU, CHO_DUYET, DA_DUYET)',
    default: 'RIENG_TU',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư', default: false })
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
