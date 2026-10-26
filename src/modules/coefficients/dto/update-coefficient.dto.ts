import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCoefficientDto {
  @ApiPropertyOptional({ description: 'ID nguyên liệu liên kết', example: 1 })
  @Type(() => Number)
  @IsNumber({}, { message: 'ID nguyên liệu phải là số' })
  @IsOptional()
  ingredientId?: number;

  @ApiPropertyOptional({ description: 'Phương pháp chế biến', example: 'Xào' })
  @IsString({ message: 'Phương pháp chế biến phải là chuỗi' })
  @IsOptional()
  processingMethod?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống/chín', example: 0.9 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số phải là số' })
  @Min(0.0001, { message: 'Hệ số phải lớn hơn 0' })
  @IsOptional()
  coefficient?: number;

  @ApiPropertyOptional({
    description: 'Có phải hệ số dùng chung toàn hệ thống hay không (Chỉ Admin)',
  })
  @IsOptional()
  isPublic?: boolean;
}
