import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID danh mục' })
  id: number;

  @ApiProperty({ example: 'Thịt', description: 'Tên danh mục (Category Name)' })
  categoryName: string;

  @ApiProperty({ example: 'Thịt', description: 'Tên danh mục (Tiếng Việt)' })
  tenDanhMuc: string;
}
