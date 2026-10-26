import { ApiProperty } from '@nestjs/swagger';

export class IngredientSummaryDto {
  @ApiProperty({ example: '1', description: 'ID nguyên liệu' })
  id: string;

  @ApiProperty({ example: 'Gạo tẻ', description: 'Tên nguyên liệu' })
  ten_nguyen_lieu: string;

  @ApiProperty({ example: 'Gạo tẻ', description: 'Tên nguyên liệu (alias NutriFE)' })
  material: string;
}
