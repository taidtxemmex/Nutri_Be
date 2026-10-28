import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNutritionGuideDto {
  @ApiProperty({ description: 'Tên bệnh / Chủ đề dinh dưỡng', example: 'Đái tháo đường Type 2' })
  @IsString()
  @IsNotEmpty()
  diseaseName: string;

  @ApiProperty({ description: 'Mã ký hiệu hướng dẫn', example: 'HD-DTD-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng bệnh lý',
    example: 'Hạn chế đường đơn, kiểm soát carbohydrate',
  })
  @IsString()
  @IsOptional()
  nutritionPrinciple?: string;

  @ApiPropertyOptional({
    description: 'Cơ cấu khẩu phần / yêu cầu ăn kiêng',
    example: { glucid: '50-60%', protein: '15-20%' },
  })
  @IsOptional()
  dietaryRequirements?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Ghi chú và cảnh báo lâm sàng' })
  @IsString()
  @IsOptional()
  note?: string;
}
