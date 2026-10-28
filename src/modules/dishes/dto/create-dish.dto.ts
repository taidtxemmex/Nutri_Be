import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DishIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu thành phần', example: 1 })
  @Type(() => Number)
  @IsNumber({}, { message: 'ID nguyên liệu phải là số' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId!: number;

  @ApiProperty({ description: 'Khối lượng sống sạch (gam)', example: 100.0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Khối lượng phải là số' })
  @Min(0.0001, { message: 'Khối lượng sống sạch phải lớn hơn 0' })
  @IsNotEmpty({ message: 'Khối lượng không được để trống' })
  netWeight!: number;
}

export class CreateDishDto {
  @ApiProperty({ description: 'Tên món ăn', example: 'Cơm rang dưa bò' })
  @IsString({ message: 'Tên món ăn phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên món ăn không được để trống' })
  name!: string;

  @ApiProperty({ description: 'Danh sách nguyên liệu thành phần', type: [DishIngredientInputDto] })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsNotEmpty({ message: 'Danh sách nguyên liệu không được để trống' })
  details!: DishIngredientInputDto[];
}
