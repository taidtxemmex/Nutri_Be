import { IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    example: 'Thịt gia cầm',
    description: 'Tên danh mục (CamelCase FE convention)',
  })
  @IsString({ message: 'Tên danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên danh mục tối đa 255 ký tự' })
  categoryName?: string;

  @ApiPropertyOptional({
    example: 'Thịt gia cầm',
    description: 'Tên danh mục (Snake/Tiếng Việt convention)',
  })
  @IsString({ message: 'Tên danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên danh mục tối đa 255 ký tự' })
  tenDanhMuc?: string;

  /**
   * Helper method lấy tên danh mục chuẩn hóa đã trim
   */
  getName(): string {
    const raw = this.categoryName || this.tenDanhMuc || '';
    return raw.trim();
  }
}
