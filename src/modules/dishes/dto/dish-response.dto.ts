import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DishIngredientResponseDto {
  @ApiProperty({ description: 'ID nguyên liệu', example: '1' })
  ingredientId!: string;

  @ApiProperty({ description: 'Tên nguyên liệu', example: 'Thịt bò phi lê' })
  ingredientName!: string;

  @ApiProperty({ description: 'Khối lượng sống sạch (gam)', example: 100.0 })
  netWeight!: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ ăn được (%)', example: 100 })
  edible?: number | null;

  @ApiProperty({ description: '86 chỉ tiêu dinh dưỡng thành phần tương ứng định lượng' })
  nutrients!: Record<string, number>;
}

export class DishSummaryDto {
  @ApiProperty({ description: 'ID món ăn', example: '152' })
  id!: string;

  @ApiProperty({ description: 'Tên món ăn', example: 'Rau muống luộc' })
  name!: string;

  @ApiPropertyOptional({ description: 'Trạng thái món', example: 'RIENG_TU' })
  status?: string | null;

  @ApiPropertyOptional({ description: 'Mã băm công thức SHA-256' })
  recipeHash?: string | null;

  @ApiPropertyOptional({ description: 'Tổng khối lượng món ăn (gam)', example: 200.0 })
  dishWeight?: number;

  @ApiProperty({ description: 'Tổng dinh dưỡng món ăn (86 chỉ tiêu vi chất)' })
  totalNutrients!: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Món ăn do chính người dùng hiện tại tạo ra hay không',
    example: true,
  })
  isMine?: boolean;

  @ApiPropertyOptional({ description: 'Thời điểm tạo món ăn' })
  createdAt?: Date | null;
}

export class DishResponseDto {
  @ApiProperty({ description: 'ID món ăn', example: '152' })
  id!: string;

  @ApiProperty({ description: 'Tên món ăn', example: 'Rau muống luộc' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Trạng thái món (RIENG_TU, CHO_DUYET, DA_DUYET, TU_CHOI, HE_THONG)',
  })
  status?: string | null;

  @ApiPropertyOptional({ description: 'Mã băm công thức SHA-256' })
  recipeHash?: string | null;

  @ApiProperty({ description: 'Tổng khối lượng món ăn (gam)', example: 150.0 })
  dishWeight!: number;

  @ApiProperty({ description: 'Tổng dinh dưỡng món ăn (86 chỉ tiêu vi chất)' })
  totalNutrients!: Record<string, number>;

  @ApiProperty({
    description: 'Danh sách chi tiết nguyên liệu trong món',
    type: [DishIngredientResponseDto],
  })
  details!: DishIngredientResponseDto[];

  @ApiPropertyOptional({ description: 'ID món gốc nếu là bản sao clone', example: '10' })
  originalDishId?: string | null;

  @ApiPropertyOptional({ description: 'Lý do từ chối phê duyệt (nếu có)' })
  rejectReason?: string | null;

  @ApiPropertyOptional({ description: 'Thời điểm được phê duyệt' })
  approvedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Thời điểm tạo món' })
  createdAt?: Date | null;
}
