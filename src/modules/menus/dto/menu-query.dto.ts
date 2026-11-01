import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';

export class MenuQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'validation.menus.page_min' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mục trên mỗi trang (tối đa 100)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'validation.menus.limit_min' })
  @Max(100, { message: 'validation.menus.limit_max' })
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên thực đơn' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'validation.menus.keyword_max' })
  keyword?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm phụ (tương thích FE)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'validation.menus.search_max' })
  search?: string;

  @ApiPropertyOptional({
    enum: MenuType,
    description: 'Lọc theo loại thực đơn: NGAY | TUAN | THANG',
  })
  @IsOptional()
  @IsEnum(MenuType, { message: 'validation.menus.menu_type_enum' })
  menuType?: MenuType;

  @ApiPropertyOptional({
    enum: TargetType,
    description: 'Lọc theo đối tượng: BENH_NHAN | NHOM_BENH',
  })
  @IsOptional()
  @IsEnum(TargetType, { message: 'validation.menus.target_type_enum' })
  targetType?: TargetType;

  @ApiPropertyOptional({ description: 'Lọc theo ID bệnh nhân' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'validation.menus.patient_id_max' })
  patientId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhóm bệnh mở rộng' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.menus.disease_group_id_int' })
  @Min(1, { message: 'validation.menus.disease_group_id_min' })
  diseaseGroupId?: number;

  @ApiPropertyOptional({ description: 'Lọc thực đơn công khai' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'validation.menus.is_public_boolean' })
  isPublic?: boolean;
}
