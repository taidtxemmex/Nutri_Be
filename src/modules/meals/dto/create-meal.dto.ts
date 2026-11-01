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
  @IsInt({ message: 'ID món ăn phải là số nguyên' })
  @Min(1, { message: 'ID món ăn phải lớn hơn 0' })
  @IsNotEmpty({ message: 'ID món ăn không được để trống' })
  dishId!: number;

  @ApiPropertyOptional({
    description: 'Hệ số sống/chín riêng cho món trong bữa',
    example: 1.0,
    default: 1.0,
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @Min(0.0001, { message: 'Hệ số phải lớn hơn 0' })
  @Max(100.0, { message: 'Hệ số tối đa là 100.0' })
  @IsOptional()
  coefficient?: number;
}

export class CreateMealDto {
  @ApiPropertyOptional({
    description: 'Tên bữa ăn (Sáng, Trưa, Tối, Phụ sáng...)',
    example: 'Bữa sáng tiêu chuẩn',
  })
  @Transform(({ value, obj }) => value ?? obj?.name)
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @MaxLength(100, { message: 'Tên bữa ăn không được vượt quá 100 ký tự' })
  @IsOptional()
  mealName?: string;

  @ApiPropertyOptional({
    description: 'Alias tên bữa ăn',
    example: 'Bữa sáng tiêu chuẩn',
  })
  @Transform(({ value, obj }) => value ?? obj?.mealName)
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @MaxLength(100, { message: 'Tên bữa ăn không được vượt quá 100 ký tự' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (từ MealTable.jsx)', example: '07:00' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Giờ kết thúc (từ MealTable.jsx)', example: '08:00' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Mô tả bữa ăn (từ MealTable.jsx)' })
  @IsString()
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
  @IsString({ message: 'Khung giờ ăn phải là chuỗi' })
  @MaxLength(50, { message: 'Khung giờ ăn không được vượt quá 50 ký tự' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái bữa ăn (RIENG_TU, CHO_DUYET, DA_DUYET)',
    default: 'RIENG_TU',
  })
  @IsString()
  @MaxLength(50, { message: 'Trạng thái tối đa 50 ký tự' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Bữa ăn công khai hay riêng tư', default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách các món ăn trong bữa', type: [MealDishItemDto] })
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  @IsArray({ message: 'Danh sách món ăn phải là mảng' })
  @ArrayMaxSize(50, { message: 'Danh sách món ăn trong bữa tối đa 50 món' })
  @ValidateNested({ each: true })
  @Type(() => MealDishItemDto)
  @IsOptional()
  dishes?: MealDishItemDto[] = [];
}
