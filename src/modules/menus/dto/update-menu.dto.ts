import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';
import { MenuMealDto, MenuWeekDto } from './create-menu.dto';

export class UpdateMenuDto {
  @ApiPropertyOptional({ description: 'Tên thực đơn' })
  @IsOptional()
  @IsString({ message: 'Tên thực đơn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên thực đơn không được vượt quá 255 ký tự' })
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
  @IsInt({ message: 'ID nhóm bệnh phải là số nguyên' })
  @Min(1, { message: 'ID nhóm bệnh phải lớn hơn 0' })
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
  @ArrayMaxSize(20, { message: 'Danh sách bữa ăn tối đa 20 bữa' })
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals?: MenuMealDto[];

  @ApiPropertyOptional({
    description: 'Danh sách tuần cho thực đơn TUAN hoặc THANG',
    type: [MenuWeekDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Danh sách tuần tối đa 5 tuần' })
  @ValidateNested({ each: true })
  @Type(() => MenuWeekDto)
  weeks?: MenuWeekDto[];
}
