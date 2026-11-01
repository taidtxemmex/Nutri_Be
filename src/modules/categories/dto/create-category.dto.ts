import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    example: 'Thịt gia cầm',
    description: 'Tên danh mục (CamelCase FE convention)',
  })
  @IsOptional()
  @IsString({ message: 'Tên danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên danh mục tối đa 255 ký tự' })
  categoryName?: string;

  @ApiPropertyOptional({
    example: 'Thịt gia cầm',
    description: 'Tên danh mục (Snake/Tiếng Việt convention)',
  })
  @IsOptional()
  @IsString({ message: 'Tên danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên danh mục tối đa 255 ký tự' })
  tenDanhMuc?: string;

  @ApiPropertyOptional({
    example: 'CAT_01',
    description: 'Mã danh mục (CamelCase FE convention)',
  })
  @IsOptional()
  @IsString({ message: 'Mã danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã danh mục tối đa 50 ký tự' })
  categoryCode?: string;

  @ApiPropertyOptional({
    example: 'CAT_01',
    description: 'Mã danh mục (Snake/Tiếng Việt convention)',
  })
  @IsOptional()
  @IsString({ message: 'Mã danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã danh mục tối đa 50 ký tự' })
  maDanhMuc?: string;

  @ApiPropertyOptional({
    example: 'Mô tả chi tiết nhóm thực phẩm',
    description: 'Mô tả danh mục',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả danh mục tối đa 5000 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Mô tả chi tiết nhóm thực phẩm',
    description: 'Mô tả danh mục (Tiếng Việt)',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả danh mục tối đa 5000 ký tự' })
  moTa?: string;

  /**
   * Helper method lấy tên danh mục chuẩn hóa đã trim
   */
  getName(): string {
    const raw = this.categoryName || this.tenDanhMuc || '';
    return raw.trim();
  }

  /**
   * Helper method lấy mã danh mục chuẩn hóa đã trim
   */
  getCode(): string {
    const raw = this.categoryCode || this.maDanhMuc || '';
    return raw.trim();
  }

  /**
   * Helper method lấy mô tả danh mục chuẩn hóa đã trim
   */
  getDescription(): string {
    const raw = this.description || this.moTa || '';
    return raw.trim();
  }
}
