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
import { Transform, Type } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';
import { MenuMealDto, MenuWeekDto } from './create-menu.dto';

export class UpdateMenuDto {
  @ApiPropertyOptional({ description: 'Tên thực đơn' })
  @IsOptional()
  @IsString({ message: 'validation.menus.name_string' })
  @MaxLength(255, { message: 'validation.menus.name_max' })
  menuName?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn ảnh đại diện thực đơn (relative path)',
    example: '/uploads/public/menus/2026/11/menu-tuan-1.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.menus.image_url_string' })
  @MaxLength(500, { message: 'validation.menus.image_url_max' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias snake_case cho imageUrl',
    example: '/uploads/public/menus/2026/11/menu-tuan-1.jpg',
  })
  @IsOptional()
  @IsString({ message: 'validation.menus.image_url_string' })
  @MaxLength(500, { message: 'validation.menus.image_url_max' })
  image_url?: string;

  @ApiPropertyOptional({
    description: 'Loại thực đơn: NGAY | TUAN | THANG',
    enum: MenuType,
  })
  @IsOptional()
  @IsEnum(MenuType, { message: 'validation.menus.menu_type_enum' })
  menuType?: MenuType;

  @ApiPropertyOptional({
    description: 'Đối tượng thực đơn: BENH_NHAN | NHOM_BENH',
    enum: TargetType,
  })
  @IsOptional()
  @IsEnum(TargetType, { message: 'validation.menus.target_type_enum' })
  targetType?: TargetType;

  @ApiPropertyOptional({ description: 'ID bệnh nhân' })
  @IsOptional()
  patientId?: string | number;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh mở rộng' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.menus.disease_group_id_int' })
  @Min(1, { message: 'validation.menus.disease_group_id_min' })
  diseaseGroupId?: number;

  @ApiPropertyOptional({ description: 'ID bộ giới hạn dinh dưỡng áp dụng' })
  @IsOptional()
  nutritionLimitSetId?: string | number;

  @ApiPropertyOptional({
    description: 'Danh sách bữa ăn cho thực đơn NGAY',
    type: [MenuMealDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.meals_is_array' })
  @ArrayMaxSize(20, { message: 'validation.menus.meals_per_day_max_20' })
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals?: MenuMealDto[];

  @ApiPropertyOptional({
    description: 'Danh sách tuần cho thực đơn TUAN hoặc THANG',
    type: [MenuWeekDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.weeks_is_array' })
  @ArrayMaxSize(5, { message: 'validation.menus.weeks_max_5' })
  @ValidateNested({ each: true })
  @Type(() => MenuWeekDto)
  weeks?: MenuWeekDto[];
}
