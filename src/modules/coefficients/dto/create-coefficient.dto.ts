import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCoefficientDto {
  @ApiProperty({ description: 'ID nguyên liệu liên kết', example: 1 })
  @Type(() => Number)
  @IsNumber({}, { message: 'ID nguyên liệu phải là số' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId!: number;

  @ApiProperty({ description: 'Phương pháp chế biến (vd: Luộc, Xào, Rán...)', example: 'Luộc' })
  @IsString({ message: 'Phương pháp chế biến phải là chuỗi' })
  @IsNotEmpty({ message: 'Phương pháp chế biến không được để trống' })
  processingMethod!: string;

  @ApiProperty({ description: 'Hệ số sống/chín (Shrinkage/Yield coefficient)', example: 0.85 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @Min(0.0001, { message: 'Hệ số phải lớn hơn 0' })
  @IsNotEmpty({ message: 'Hệ số không được để trống' })
  coefficient!: number;

  @ApiPropertyOptional({
    description: 'Có phải hệ số dùng chung toàn hệ thống hay không (Chỉ Admin)',
    default: false,
  })
  @IsOptional()
  isPublic?: boolean;
}
