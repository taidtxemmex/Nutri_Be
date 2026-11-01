import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateNutritionGuideDto {
  @ApiProperty({ description: 'Tên bệnh / Chủ đề dinh dưỡng', example: 'Đái tháo đường Type 2' })
  @IsString({ message: 'validation.nutrition_guides.disease_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.disease_name_max_255' })
  @IsNotEmpty({ message: 'validation.nutrition_guides.disease_name_required' })
  diseaseName: string;

  @ApiPropertyOptional({
    description: 'Tên bệnh (tenBenh alias)',
    example: 'Đái tháo đường Type 2',
  })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_guides.disease_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.disease_name_max_255' })
  tenBenh?: string;

  @ApiProperty({ description: 'Mã ký hiệu hướng dẫn', example: 'HD-DTD-01' })
  @IsString({ message: 'validation.nutrition_guides.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.code_max_255' })
  @IsNotEmpty({ message: 'validation.nutrition_guides.code_required' })
  code: string;

  @ApiPropertyOptional({ description: 'Mã ký hiệu (maKyHieu alias)', example: 'HD-DTD-01' })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_guides.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.code_max_255' })
  maKyHieu?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề hướng dẫn (tieuDe)',
    example: 'Hướng dẫn chế độ ăn cho người đái tháo đường',
  })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_guides.title_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.title_max_255' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề hướng dẫn (tieuDe alias)',
    example: 'Hướng dẫn chế độ ăn cho người đái tháo đường',
  })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_guides.title_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.nutrition_guides.title_max_255' })
  tieuDe?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng bệnh lý',
    example: 'Hạn chế đường đơn, kiểm soát carbohydrate',
  })
  @IsString({ message: 'validation.nutrition_guides.principles_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.principles_max_65000' })
  @IsOptional()
  nutritionPrinciple?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng (nguyenTacDinhDuong alias)',
    example: 'Hạn chế đường đơn, kiểm soát carbohydrate',
  })
  @IsString({ message: 'validation.nutrition_guides.principles_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.principles_max_65000' })
  @IsOptional()
  nguyenTacDinhDuong?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng (nguyenTac alias)',
  })
  @IsString({ message: 'validation.nutrition_guides.principles_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.principles_max_65000' })
  @IsOptional()
  nguyenTac?: string;

  @ApiPropertyOptional({
    description: 'Mô tả hướng dẫn dinh dưỡng',
    example: 'Mô tả chi tiết phác đồ dinh dưỡng',
  })
  @IsString({ message: 'validation.nutrition_guides.description_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.description_max_65000' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Mô tả hướng dẫn dinh dưỡng (moTa alias)',
  })
  @IsString({ message: 'validation.nutrition_guides.description_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.description_max_65000' })
  @IsOptional()
  moTa?: string;

  @ApiPropertyOptional({
    description: 'Cơ cấu khẩu phần / yêu cầu ăn kiêng',
    example: { glucid: '50-60%', protein: '15-20%' },
  })
  @IsOptional()
  dietaryRequirements?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Cơ cấu khẩu phần (coCauKhauPhan alias)',
  })
  @IsOptional()
  coCauKhauPhan?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Ghi chú và cảnh báo lâm sàng' })
  @IsString({ message: 'validation.nutrition_guides.note_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.note_max_65000' })
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng (luuY alias)' })
  @IsString({ message: 'validation.nutrition_guides.note_string' })
  @MaxLength(65000, { message: 'validation.nutrition_guides.note_max_65000' })
  @IsOptional()
  luuY?: string;
}
