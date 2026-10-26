import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MealDishResponseDto {
  @ApiProperty({ description: 'ID món ăn', example: '152' })
  id!: string;

  @ApiProperty({ description: 'Tên món ăn', example: 'Rau muống luộc' })
  name!: string;

  @ApiProperty({ description: 'Tổng khối lượng chín của món (gam)', example: 150.0 })
  dishWeight!: number;

  @ApiProperty({ description: 'Hệ số sống chín của món trong bữa', example: 1.0 })
  coefficient!: number;

  @ApiProperty({
    description: '86 chỉ tiêu dinh dưỡng của món ăn',
    example: { energyKcal: 45, protein: 3.2 },
  })
  nutrients!: Record<string, number>;
}

export class MealResponseDto {
  @ApiProperty({ description: 'ID bữa ăn', example: '1' })
  id!: string;

  @ApiPropertyOptional({ description: 'Tên bữa ăn', example: 'Bữa sáng' })
  mealName?: string | null;

  @ApiProperty({ description: 'Khung giờ ăn', example: '07:00' })
  time!: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn', example: 'RIENG_TU' })
  status?: string | null;

  @ApiProperty({ description: 'Bữa ăn công khai', example: false })
  isPublic!: boolean;

  @ApiProperty({
    description: 'Tổng dinh dưỡng của cả bữa ăn (86 chỉ tiêu vi chất)',
    example: { energyKcal: 350.5, protein: 18.2 },
  })
  totalMealNutrients!: Record<string, number>;

  @ApiProperty({ description: 'Danh sách món ăn trong bữa', type: [MealDishResponseDto] })
  dishes!: MealDishResponseDto[];
}
