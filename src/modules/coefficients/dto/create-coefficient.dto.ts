import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCoefficientDto {
  @ApiProperty({ description: 'ID nguyên liệu liên kết', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'validation.coefficients.ingredient_id_int' })
  @Min(1, { message: 'validation.coefficients.ingredient_id_min' })
  @IsNotEmpty({ message: 'validation.coefficients.ingredient_id_required' })
  ingredientId!: number;

  @ApiProperty({ description: 'Phương pháp chế biến (vd: Luộc, Xào, Rán...)', example: 'Luộc' })
  @IsString({ message: 'validation.coefficients.method_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.coefficients.method_max' })
  @IsNotEmpty({ message: 'validation.coefficients.method_required' })
  processingMethod!: string;

  @ApiProperty({ description: 'Hệ số sống/chín (Shrinkage/Yield coefficient)', example: 0.85 })
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.coefficients.coefficient_number' })
  @Min(0.01, { message: 'validation.coefficients.coefficient_min' })
  @Max(10.0, { message: 'validation.coefficients.coefficient_max' })
  @IsNotEmpty({ message: 'validation.coefficients.coefficient_required' })
  coefficient!: number;

  @ApiPropertyOptional({
    description: 'Có phải hệ số dùng chung toàn hệ thống hay không (Chỉ Admin)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'validation.coefficients.is_public_boolean' })
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'ID nguyên liệu (alias)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.coefficients.ingredient_id_int' })
  @Min(1, { message: 'validation.coefficients.ingredient_id_min' })
  nguyenLieuId?: number;

  @ApiPropertyOptional({ description: 'Phương pháp chế biến (alias tiếng Việt)', example: 'Luộc' })
  @IsOptional()
  @IsString({ message: 'validation.coefficients.method_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.coefficients.method_max' })
  phuongPhapCheBien?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống chín (alias tiếng Việt)', example: 0.85 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.coefficients.coefficient_number' })
  @Min(0.01, { message: 'validation.coefficients.coefficient_min' })
  @Max(10.0, { message: 'validation.coefficients.coefficient_max' })
  heSo?: number;
}
