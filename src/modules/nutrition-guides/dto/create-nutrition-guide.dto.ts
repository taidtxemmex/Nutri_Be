import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateNutritionGuideDto {
  @ApiProperty({ description: 'Tên bệnh / Chủ đề dinh dưỡng', example: 'Đái tháo đường Type 2' })
  @IsString({ message: 'Tên bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên bệnh tối đa 255 ký tự' })
  @IsNotEmpty({ message: 'Tên bệnh không được để trống' })
  diseaseName: string;

  @ApiPropertyOptional({
    description: 'Tên bệnh (tenBenh alias)',
    example: 'Đái tháo đường Type 2',
  })
  @IsOptional()
  @IsString({ message: 'Tên bệnh phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên bệnh tối đa 255 ký tự' })
  tenBenh?: string;

  @ApiProperty({ description: 'Mã ký hiệu hướng dẫn', example: 'HD-DTD-01' })
  @IsString({ message: 'Mã ký hiệu phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Mã ký hiệu tối đa 255 ký tự' })
  @IsNotEmpty({ message: 'Mã ký hiệu không được để trống' })
  code: string;

  @ApiPropertyOptional({ description: 'Mã ký hiệu (maKyHieu alias)', example: 'HD-DTD-01' })
  @IsOptional()
  @IsString({ message: 'Mã ký hiệu phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Mã ký hiệu tối đa 255 ký tự' })
  maKyHieu?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề hướng dẫn (tieuDe)',
    example: 'Hướng dẫn chế độ ăn cho người đái tháo đường',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tiêu đề tối đa 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề hướng dẫn (tieuDe alias)',
    example: 'Hướng dẫn chế độ ăn cho người đái tháo đường',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tiêu đề tối đa 255 ký tự' })
  tieuDe?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng bệnh lý',
    example: 'Hạn chế đường đơn, kiểm soát carbohydrate',
  })
  @IsString({ message: 'Nguyên tắc dinh dưỡng phải là chuỗi' })
  @MaxLength(10000, { message: 'Nguyên tắc dinh dưỡng tối đa 10000 ký tự' })
  @IsOptional()
  nutritionPrinciple?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng (nguyenTacDinhDuong alias)',
    example: 'Hạn chế đường đơn, kiểm soát carbohydrate',
  })
  @IsString({ message: 'Nguyên tắc dinh dưỡng phải là chuỗi' })
  @MaxLength(10000, { message: 'Nguyên tắc dinh dưỡng tối đa 10000 ký tự' })
  @IsOptional()
  nguyenTacDinhDuong?: string;

  @ApiPropertyOptional({
    description: 'Nguyên tắc dinh dưỡng (nguyenTac alias)',
  })
  @IsString({ message: 'Nguyên tắc dinh dưỡng phải là chuỗi' })
  @MaxLength(10000, { message: 'Nguyên tắc dinh dưỡng tối đa 10000 ký tự' })
  @IsOptional()
  nguyenTac?: string;

  @ApiPropertyOptional({
    description: 'Mô tả hướng dẫn dinh dưỡng',
    example: 'Mô tả chi tiết phác đồ dinh dưỡng',
  })
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(10000, { message: 'Mô tả tối đa 10000 ký tự' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Mô tả hướng dẫn dinh dưỡng (moTa alias)',
  })
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(10000, { message: 'Mô tả tối đa 10000 ký tự' })
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
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(10000, { message: 'Ghi chú tối đa 10000 ký tự' })
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng (luuY alias)' })
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(10000, { message: 'Ghi chú tối đa 10000 ký tự' })
  @IsOptional()
  luuY?: string;
}
