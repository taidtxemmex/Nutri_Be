import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Thịt bò tươi', description: 'Tên danh mục cập nhật' })
  @IsOptional()
  @IsString({ message: 'Tên danh mục phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên danh mục tối đa 255 ký tự' })
  categoryName?: string;

  @ApiPropertyOptional({
    example: 'Thịt bò tươi',
    description: 'Tên danh mục cập nhật (Tiếng Việt)',
  })
  @IsOptional()
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
