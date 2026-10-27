import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';
import { MenuMealDto, MenuWeekDto } from './create-menu.dto';

export class UpdateMenuDto {
  @ApiPropertyOptional({ description: 'Tên thực đơn' })
  @IsOptional()
  @IsString()
  menuName?: string;

  @ApiPropertyOptional({
    description: 'Loại thực đơn: NGAY | TUAN | THANG',
    enum: MenuType,
  })
  @IsOptional()
  @IsEnum(MenuType)
  menuType?: MenuType;

  @ApiPropertyOptional({
    description: 'Đối tượng thực đơn: BENH_NHAN | NHOM_BENH',
    enum: TargetType,
  })
  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  @IsOptional()
  patientId?: string | number;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh mở rộng' })
  @IsOptional()
  @IsNumber()
  diseaseGroupId?: number;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn dinh dưỡng áp dụng' })
  @IsOptional()
  nutritionLimitSetId?: string | number;

  @ApiPropertyOptional({
    description: 'Danh sách bữa ăn cho thực đơn NGAY',
    type: [MenuMealDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals?: MenuMealDto[];

  @ApiPropertyOptional({
    description: 'Danh sách tuần cho thực đơn TUAN hoặc THANG',
    type: [MenuWeekDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuWeekDto)
  weeks?: MenuWeekDto[];
}
