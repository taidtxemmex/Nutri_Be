import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DishIngredientInputDto } from './create-dish.dto';

export class DishCloneRequestDto {
  @ApiPropertyOptional({
    description: 'Tên mới cho món ăn bản sao',
    example: 'Cơm rang dưa bò (Bản sao)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  newName?: string;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thay thế (nếu không truyền sẽ sao chép từ món gốc)',
    type: [DishIngredientInputDto],
  })
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu không được vượt quá 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => DishIngredientInputDto)
  @IsOptional()
  ingredients?: DishIngredientInputDto[];
}

export class DishCloneResponseDto {
  @ApiProperty({ description: 'ID món ăn mới tạo', example: '180' })
  id!: string;

  @ApiProperty({ description: 'ID món gốc được sao chép', example: '152' })
  originalDishId!: string;

  @ApiProperty({ description: 'Tên món ăn mới', example: 'Cơm rang dưa bò (Bản sao)' })
  name!: string;
}
