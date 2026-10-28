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
  @IsInt({ message: 'ID nguyên liệu phải là số nguyên' })
  @Min(1, { message: 'ID nguyên liệu phải lớn hơn 0' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId!: number;

  @ApiProperty({ description: 'Phương pháp chế biến (vd: Luộc, Xào, Rán...)', example: 'Luộc' })
  @IsString({ message: 'Phương pháp chế biến phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Phương pháp chế biến tối đa 100 ký tự' })
  @IsNotEmpty({ message: 'Phương pháp chế biến không được để trống' })
  processingMethod!: string;

  @ApiProperty({ description: 'Hệ số sống/chín (Shrinkage/Yield coefficient)', example: 0.85 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @Min(0.01, { message: 'Hệ số sống chín phải lớn hơn hoặc bằng 0.01' })
  @Max(10.0, { message: 'Hệ số sống chín phải nhỏ hơn hoặc bằng 10.0' })
  @IsNotEmpty({ message: 'Hệ số không được để trống' })
  coefficient!: number;

  @ApiPropertyOptional({
    description: 'Có phải hệ số dùng chung toàn hệ thống hay không (Chỉ Admin)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isPublic phải là kiểu boolean' })
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'ID nguyên liệu (alias)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID nguyên liệu phải là số nguyên' })
  @Min(1, { message: 'ID nguyên liệu phải lớn hơn 0' })
  nguyenLieuId?: number;

  @ApiPropertyOptional({ description: 'Phương pháp chế biến (alias tiếng Việt)', example: 'Luộc' })
  @IsOptional()
  @IsString({ message: 'Phương pháp chế biến phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Phương pháp chế biến tối đa 100 ký tự' })
  phuongPhapCheBien?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống chín (alias tiếng Việt)', example: 0.85 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @Min(0.01, { message: 'Hệ số sống chín phải lớn hơn hoặc bằng 0.01' })
  @Max(10.0, { message: 'Hệ số sống chín phải nhỏ hơn hoặc bằng 10.0' })
  heSo?: number;
}
