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
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MenuExportType } from '../../../config/enums/domain.enum';

export class ExportMenuDto {
  @ApiPropertyOptional({
    enum: MenuExportType,
    default: MenuExportType.FULL,
    description: 'Chế độ xuất Excel: FULL | NET | NET_NUTRITION | RAW | COOKED',
  })
  @IsOptional()
  @IsEnum(MenuExportType)
  exportType?: MenuExportType = MenuExportType.FULL;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Danh sách mã chỉ tiêu dinh dưỡng cần xuất (nếu bỏ trống sẽ xuất đầy đủ 86 chỉ tiêu)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách mã chỉ tiêu dinh dưỡng tối đa 100 mục' })
  @IsString({ each: true })
  @MaxLength(100, { each: true, message: 'Mã chỉ tiêu dinh dưỡng tối đa 100 ký tự' })
  columns?: string[];

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    description: 'Số suất ăn cần tính toán định lượng (bắt buộc > 0 với chế độ RAW và COOKED)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  servings?: number = 1;
}
