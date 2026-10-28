import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsIn, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BasePaginationQueryDto } from '../../../common/dto/base-pagination-query.dto';

export class IngredientQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên nguyên liệu' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Từ khóa tìm kiếm tối đa 255 ký tự' })
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
  @MaxLength(50)
  @IsIn(['THUC_VAT', 'DONG_VAT'])
  loaiProtein?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái duyệt',
    enum: ['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'],
  })
  @Transform(({ value, obj }) => (value !== undefined ? value : obj?.status))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(['DA_DUYET', 'CHO_DUYET', 'TU_CHOI'])
  trangThai?: string;
}
