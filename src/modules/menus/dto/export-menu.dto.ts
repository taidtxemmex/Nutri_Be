import { IsEnum, IsInt, IsOptional, IsArray, IsString, Min, Max } from 'class-validator';
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
  @IsString({ each: true })
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
