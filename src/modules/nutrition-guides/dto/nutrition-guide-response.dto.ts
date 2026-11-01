import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NutritionGuideResponseDto {
  @ApiProperty({ description: 'ID hướng dẫn dinh dưỡng', example: 1 })
  id: number;

  @ApiProperty({ description: 'Tên bệnh / Chủ đề dinh dưỡng', example: 'Đái tháo đường Type 2' })
  diseaseName: string;

  @ApiProperty({ description: 'Mã ký hiệu hướng dẫn', example: 'HD-DTD-01' })
  code: string;

  @ApiPropertyOptional({ description: 'Nguyên tắc dinh dưỡng bệnh lý' })
  nutritionPrinciple?: string;

  @ApiPropertyOptional({ description: 'Cơ cấu khẩu phần' })
  dietaryRequirements?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Ghi chú và cảnh báo lâm sàng' })
  note?: string;

  @ApiPropertyOptional({ description: 'Tiêu đề hướng dẫn' })
  title?: string;

  @ApiPropertyOptional({ description: 'Tên bệnh (tiếng Việt)' })
  tenBenh?: string;

  @ApiPropertyOptional({ description: 'Mã ký hiệu (tiếng Việt)' })
  maKyHieu?: string;

  @ApiPropertyOptional({ description: 'Mô tả hướng dẫn' })
  description?: string;
}
