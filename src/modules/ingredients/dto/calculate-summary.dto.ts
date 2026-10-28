import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateSummaryItemDto {
  @ApiPropertyOptional({ example: 1, description: 'ID nguyên liệu' })
  @IsOptional()
  @IsInt({ message: 'validation.is_int' })
  @IsPositive({ message: 'validation.is_positive' })
  ingredientId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID nguyên liệu (alias id)' })
  @IsOptional()
  @IsInt({ message: 'validation.is_int' })
  @IsPositive({ message: 'validation.is_positive' })
  id?: number;

  @ApiPropertyOptional({ example: 100, description: 'Khối lượng (gam)' })
  @IsOptional()
  @IsNumber({}, { message: 'validation.is_number' })
  @IsPositive({ message: 'validation.is_positive' })
  @Max(10000, { message: 'Khối lượng tối đa 10000 gam' })
  weight?: number;

  @ApiPropertyOptional({ example: 100, description: 'Khối lượng (gam, alias weightGrams)' })
  @IsOptional()
  @IsNumber({}, { message: 'validation.is_number' })
  @IsPositive({ message: 'validation.is_positive' })
  @Max(10000, { message: 'Khối lượng tối đa 10000 gam' })
  weightGrams?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Khối lượng sạch (đã trừ vỏ/xương), mặc định true',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'validation.is_boolean' })
  isNetWeight?: boolean;

  @ApiPropertyOptional({
    example: 0.85,
    description: 'Hệ số sống/chín (ví dụ: 0.85)',
    default: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'validation.is_number' })
  @IsPositive({ message: 'validation.is_positive' })
  @Max(10, { message: 'Hệ số sống chín tối đa 10' })
  coefficient?: number;
}

export class CalculateSummaryDto {
  @ApiProperty({
    type: [CalculateSummaryItemDto],
    description: 'Danh sách các thành phần nguyên liệu cần tính dinh dưỡng',
  })
  @IsArray({ message: 'validation.is_array' })
  @ArrayMinSize(1, { message: 'validation.array_min_size' })
  @ArrayMaxSize(500, { message: 'validation.array_max_size' })
  @ValidateNested({ each: true })
  @Type(() => CalculateSummaryItemDto)
  items: CalculateSummaryItemDto[];
}

export class CalculateSummaryItemResultDto {
  @ApiProperty({ example: 1, description: 'ID nguyên liệu' })
  ingredientId: number;

  @ApiProperty({ example: 'Gạo tẻ', description: 'Tên nguyên liệu' })
  name: string;

  @ApiPropertyOptional({ example: 'Gạo tẻ', description: 'Tên nguyên liệu (alias tiếng Việt)' })
  ten_nguyen_lieu?: string;

  @ApiProperty({ example: 100, description: 'Khối lượng sống/thô (gam)' })
  grossWeight: number;

  @ApiProperty({ example: 100, description: 'Khối lượng ăn được / sạch (gam)' })
  edibleWeight: number;

  @ApiProperty({ example: 85, description: 'Khối lượng chín (gam)' })
  cookedWeight: number;

  @ApiProperty({ example: 1, description: 'Hệ số sống/chín' })
  coefficient: number;

  @ApiProperty({ example: true, description: 'Cờ khối lượng sạch' })
  isNetWeight: boolean;

  @ApiProperty({ description: 'Các chỉ tiêu dinh dưỡng thành phần' })
  nutrients: Record<string, number>;
}

export class CalculateSummaryResponseDto {
  @ApiProperty({ example: 250, description: 'Tổng khối lượng sống / thô (gam)' })
  totalGrossWeight: number;

  @ApiProperty({ example: 200, description: 'Tổng khối lượng ăn được / sạch (gam)' })
  totalEdibleWeight: number;

  @ApiProperty({ example: 180, description: 'Tổng khối lượng chín (gam)' })
  totalCookedWeight: number;

  @ApiProperty({ description: 'Tổng hợp 86 chỉ tiêu vi chất dinh dưỡng' })
  nutrients: Record<string, number>;

  @ApiProperty({
    type: [CalculateSummaryItemResultDto],
    description: 'Chi tiết từng nguyên liệu thành phần',
  })
  items: CalculateSummaryItemResultDto[];
}
