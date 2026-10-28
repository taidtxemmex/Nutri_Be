import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  IsInt,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DishIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu thành phần', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'ID nguyên liệu phải là số nguyên' })
  @Min(1, { message: 'ID nguyên liệu phải lớn hơn 0' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId!: number;

  @ApiProperty({ description: 'Khối lượng sống sạch (gam)', example: 100.0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Khối lượng phải là số' })
  @Min(0.0001, { message: 'Khối lượng sống sạch phải lớn hơn 0' })
  @Max(10000, { message: 'Khối lượng sống sạch không được vượt quá 10000 gam' })
  @IsNotEmpty({ message: 'Khối lượng không được để trống' })
  netWeight!: number;
}

export class CreateDishDto {
  @ApiProperty({ description: 'Tên món ăn', example: 'Cơm rang dưa bò' })
  @IsString({ message: 'Tên món ăn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  @IsNotEmpty({ message: 'Tên món ăn không được để trống' })
  name!: string;

  @ApiProperty({ description: 'Danh sách nguyên liệu thành phần', type: [DishIngredientInputDto] })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ArrayMinSize(1, { message: 'Danh sách nguyên liệu phải có ít nhất 1 mục' })
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu không được vượt quá 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsNotEmpty({ message: 'Danh sách nguyên liệu không được để trống' })
  details!: DishIngredientInputDto[];
}
