import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsIn, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class IngredientQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên nguyên liệu' })
  @IsOptional()
  @IsString({ message: 'validation.ingredients.search_string' })
  @MaxLength(255, { message: 'validation.ingredients.search_max' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID danh mục' })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.category || obj?.danhMuc;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const num = Number(raw);
    return isNaN(num) ? undefined : num;
  })
  @IsOptional()
  @IsInt({ message: 'validation.ingredients.category_id_int' })
  @Min(1, { message: 'validation.ingredients.category_id_min' })
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo tên hoặc ID nhóm nguyên liệu' })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : String(value).trim(),
  )
  @IsOptional()
  @IsString({ message: 'validation.ingredients.category_string' })
  @MaxLength(255, { message: 'validation.ingredients.category_max' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo loại protein',
    enum: ['THUC_VAT', 'DONG_VAT'],
  })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.proteinType;
    if (raw === '' || raw === null || raw === undefined) return undefined;
    if (raw === 'Thực vật') return 'THUC_VAT';
    if (raw === 'Động vật' || raw === 'Động Vật') return 'DONG_VAT';
    return raw;
  })
  @IsOptional()
  @IsString({ message: 'validation.ingredients.protein_type_string' })
  @MaxLength(50, { message: 'validation.ingredients.protein_type_max' })
  @IsIn(['THUC_VAT', 'DONG_VAT'], { message: 'validation.ingredients.protein_type_enum' })
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái duyệt',
    enum: ['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'],
  })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.status;
    if (raw === '' || raw === null || raw === undefined) return undefined;
    return raw;
  })
  @IsOptional()
  @IsString({ message: 'validation.ingredients.status_string' })
  @MaxLength(50, { message: 'validation.ingredients.status_max' })
  @IsIn(['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'], { message: 'validation.ingredients.status_enum' })
  trangThai?: string;
}
