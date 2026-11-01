import {
  IsEnum,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MenuExportType } from '../../../config/enums/domain.enum';

export class ExportMenuDto {
  @ApiPropertyOptional({
    enum: MenuExportType,
    default: MenuExportType.FULL,
    description: 'Chế độ xuất Excel: FULL | NET | NET_NUTRITION | RAW | COOKED',
  })
  @IsOptional()
  @IsEnum(MenuExportType, { message: 'validation.menus.export_type_enum' })
  exportType?: MenuExportType = MenuExportType.FULL;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Danh sách mã chỉ tiêu dinh dưỡng cần xuất (nếu bỏ trống sẽ xuất đầy đủ 86 chỉ tiêu)',
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.columns_is_array' })
  @ArrayMaxSize(100, { message: 'validation.menus.nutrient_codes_max_100' })
  @IsString({ each: true, message: 'validation.menus.nutrient_code_string' })
  @MaxLength(100, { each: true, message: 'validation.menus.nutrient_code_max_len' })
  columns?: string[];

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    description: 'Số suất ăn cần tính toán định lượng (bắt buộc > 0 với chế độ RAW và COOKED)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.menus.servings_int' })
  @Min(1, { message: 'validation.menus.servings_min' })
  @Max(1000000, { message: 'validation.menus.servings_max' })
  servings?: number = 1;
}
