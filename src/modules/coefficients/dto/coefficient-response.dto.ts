import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CoefficientResponseDto {
  @ApiProperty({ description: 'ID hệ số sống chín', example: '1' })
  id!: string;

  @ApiPropertyOptional({ description: 'ID nguyên liệu liên kết', example: 1 })
  ingredientId?: number | null;

  @ApiPropertyOptional({ description: 'Tên nguyên liệu liên kết', example: 'Thịt bò' })
  ingredientName?: string | null;

  @ApiPropertyOptional({ description: 'Phương pháp chế biến', example: 'Luộc' })
  processingMethod?: string | null;

  @ApiPropertyOptional({ description: 'Hệ số sống/chín', example: 0.85 })
  coefficient?: number | null;

  @ApiProperty({ description: 'Hệ số công khai dùng chung hay riêng tư', example: true })
  isPublic!: boolean;

  @ApiPropertyOptional({ description: 'ID người tạo (nếu riêng tư)', example: 'USE000001' })
  userId?: string | null;
}
