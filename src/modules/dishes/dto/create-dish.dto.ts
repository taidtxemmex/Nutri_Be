import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsInt,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class DishIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu thành phần', example: 1 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? value : Number(value),
  )
  @IsInt({ message: 'ID nguyên liệu phải là số nguyên' })
  @Min(1, { message: 'ID nguyên liệu phải lớn hơn 0' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId!: number;

  @ApiProperty({ description: 'Khối lượng sống sạch (gam)', example: 100.0 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? value : Number(value),
  )
  @IsNumber({}, { message: 'Khối lượng phải là số' })
  @Min(0, { message: 'Khối lượng sống sạch phải lớn hơn hoặc bằng 0' })
  @Max(1000000, { message: 'Khối lượng sống sạch không được vượt quá 1000000 gam' })
  @IsNotEmpty({ message: 'Khối lượng không được để trống' })
  netWeight!: number;
}

export class CreateDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn (tùy chọn từ FE)' })
  @IsOptional()
  id?: number | string;

  @ApiProperty({ description: 'Tên món ăn', example: 'Cơm rang dưa bò' })
  @IsString({ message: 'Tên món ăn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  @IsNotEmpty({ message: 'Tên món ăn không được để trống' })
  name!: string;

  @ApiPropertyOptional({ description: 'Trạng thái món ăn' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Món ăn công khai hay riêng tư' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Hệ số sống chín' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber()
  coefficient?: number;

  @ApiProperty({ description: 'Danh sách nguyên liệu thành phần', type: [DishIngredientInputDto] })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ArrayMinSize(1, { message: 'Danh sách nguyên liệu phải có ít nhất 1 mục' })
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu không được vượt quá 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsNotEmpty({ message: 'Danh sách nguyên liệu không được để trống' })
  details!: DishIngredientInputDto[];
}
