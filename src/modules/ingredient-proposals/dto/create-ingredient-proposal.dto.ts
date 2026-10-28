import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  MaxLength,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngredientProposalDto {
  @ApiPropertyOptional({ example: 'THEM_MOI' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'loại đề xuất tối đa 50 ký tự' })
  proposalType?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  ingredientId?: string | number;

  @ApiProperty({ example: 'Sữa hạt sen organic' })
  @IsString()
  @IsNotEmpty({ message: 'Tên nguyên liệu không được để trống' })
  @MaxLength(255, { message: 'Tên nguyên liệu không được vượt quá 255 ký tự' })
  ingredientName: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'ID danh mục phải là số nguyên' })
  @Min(1, { message: 'ID danh mục phải lớn hơn 0' })
  @IsNotEmpty({ message: 'ID danh mục không được để trống' })
  categoryId: number;

  @ApiPropertyOptional({ example: 'THUC_VAT' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Loại protein tối đa 50 ký tự' })
  loaiProtein?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỷ lệ ăn được phải là số' })
  @Min(0, { message: 'Tỷ lệ ăn được phải lớn hơn hoặc bằng 0' })
  @Max(100, { message: 'Tỷ lệ ăn được không được vượt quá 100%' })
  edible?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  nutrients?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Ghi chú tối đa 2000 ký tự' })
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Danh sách minh chứng tối đa 20 file' })
  evidences?: any[];
}
