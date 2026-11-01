import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class MealDishItemDto {
  @ApiPropertyOptional({ description: 'ID món ăn (alias từ FE)', example: 152 })
  @IsOptional()
  id?: number | string;

  @ApiProperty({ description: 'ID món ăn', example: 152 })
  @Transform(({ value, obj }) => {
    const raw = value ?? (obj as Record<string, unknown>)?.id;
    return raw !== undefined && raw !== null && raw !== '' ? Number(raw) : raw;
  })
  @IsInt({ message: 'validation.meals.dish_id_int' })
  @Min(1, { message: 'validation.meals.dish_id_min' })
  @IsNotEmpty({ message: 'validation.meals.dish_id_required' })
  dishId!: number;

  @ApiPropertyOptional({
    description: 'Hệ số sống/chín riêng cho món trong bữa',
    example: 1.0,
    default: 1.0,
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.meals.coefficient_number' })
  @Min(0.0001, { message: 'validation.meals.coefficient_min' })
  @Max(100.0, { message: 'validation.meals.coefficient_max' })
  @IsOptional()
  coefficient?: number;
}

export class CreateMealDto {
  @ApiPropertyOptional({
    description: 'Tên bữa ăn (Sáng, Trưa, Tối, Phụ sáng...)',
    example: 'Bữa sáng tiêu chuẩn',
  })
  @Transform(({ value, obj }) => value ?? obj?.name)
  @IsString({ message: 'validation.meals.name_string' })
  @MaxLength(100, { message: 'validation.meals.name_max' })
  @IsOptional()
  mealName?: string;

  @ApiPropertyOptional({
    description: 'Alias tên bữa ăn',
    example: 'Bữa sáng tiêu chuẩn',
  })
  @Transform(({ value, obj }) => value ?? obj?.mealName)
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

  @ApiPropertyOptional({ description: 'Khung giờ ăn (vd: 07:00 hoặc Sáng)', example: '07:00' })
  @Transform(({ value, obj }) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
    const start = obj?.startTime ? String(obj.startTime).trim() : '';
    const end = obj?.endTime ? String(obj.endTime).trim() : '';
    if (start && end) return `${start}-${end}`;
    if (start) return start;
    if (end) return end;
    return value === '' ? undefined : value;
  })
  @IsString({ message: 'validation.meals.time_string' })
  @MaxLength(50, { message: 'validation.meals.time_max' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái bữa ăn (RIENG_TU, CHO_DUYET, DA_DUYET)',
    default: 'RIENG_TU',
  })
  @IsString({ message: 'validation.meals.status_string' })
  @MaxLength(50, { message: 'validation.meals.status_max' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư', default: false })
  @IsBoolean({ message: 'validation.meals.is_public_boolean' })
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách các món ăn trong bữa', type: [MealDishItemDto] })
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  @IsArray({ message: 'validation.meals.dishes_array' })
  @ArrayMaxSize(50, { message: 'validation.meals.dishes_max_50' })
  @ValidateNested({ each: true })
  @Type(() => MealDishItemDto)
  @IsOptional()
  dishes?: MealDishItemDto[] = [];
}
