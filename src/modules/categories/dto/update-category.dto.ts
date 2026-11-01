import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Thịt bò tươi', description: 'Tên danh mục cập nhật' })
  @IsOptional()
  @IsString({ message: 'validation.categories.name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.categories.name_max' })
  categoryName?: string;

  @ApiPropertyOptional({
    example: 'Thịt bò tươi',
    description: 'Tên danh mục cập nhật (Tiếng Việt)',
  })
  @IsOptional()
  @IsString({ message: 'validation.categories.name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.categories.name_max' })
  tenDanhMuc?: string;

  @ApiPropertyOptional({
    example: 'CAT_01',
    description: 'Mã danh mục cập nhật (CamelCase FE convention)',
  })
  @IsOptional()
  @IsString({ message: 'validation.categories.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.categories.code_max' })
  categoryCode?: string;

  @ApiPropertyOptional({
    example: 'CAT_01',
    description: 'Mã danh mục cập nhật (Snake/Tiếng Việt convention)',
  })
  @IsOptional()
  @IsString({ message: 'validation.categories.code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.categories.code_max' })
  maDanhMuc?: string;

  @ApiPropertyOptional({
    example: 'Mô tả chi tiết nhóm thực phẩm cập nhật',
    description: 'Mô tả danh mục',
  })
  @IsOptional()
  @IsString({ message: 'validation.categories.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.categories.desc_max' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Mô tả chi tiết nhóm thực phẩm cập nhật',
    description: 'Mô tả danh mục (Tiếng Việt)',
  })
  @IsOptional()
  @IsString({ message: 'validation.categories.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.categories.desc_max' })
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
