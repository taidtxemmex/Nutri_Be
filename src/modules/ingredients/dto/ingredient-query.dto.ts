import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class IngredientQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên nguyên liệu' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID danh mục' })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.category || obj?.danhMuc;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const num = Number(raw);
    return isNaN(num) ? undefined : num;
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo loại protein',
    enum: ['THUC_VAT', 'DONG_VAT'],
  })
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.proteinType;
    if (raw === 'Thực vật') return 'THUC_VAT';
    if (raw === 'Động vật' || raw === 'Động Vật') return 'DONG_VAT';
    return raw;
  })
  @IsOptional()
  @IsString()
  @IsIn(['THUC_VAT', 'DONG_VAT'])
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái duyệt',
    enum: ['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'],
  })
  @Transform(({ value, obj }) => (value !== undefined ? value : obj?.status))
  @IsOptional()
  @IsString()
  @IsIn(['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'])
  trangThai?: string;
}
