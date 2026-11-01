import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsInt,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';

export class MenuDishDetailDto {
  @ApiProperty({ description: 'ID nguyên liệu' })
  @IsNotEmpty({ message: 'validation.menus.ingredient_id_required' })
  ingredientId: string | number;

  @ApiProperty({ description: 'Khối lượng sống sạch (g)' })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.menus.net_weight_number' })
  @Min(0, { message: 'validation.menus.net_weight_min' })
  @Max(1000000, { message: 'validation.menus.net_weight_max' })
  netWeight: number;
}

export class MenuDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn (nếu dùng món có sẵn)' })
  @IsOptional()
  dishId?: string | number;

  @ApiPropertyOptional({ description: 'Tên món ăn (nếu tạo món mới inline)' })
  @IsOptional()
  @IsString({ message: 'validation.menus.dish_name_string' })
  @MaxLength(255, { message: 'validation.menus.dish_name_max' })
  name?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống chín / tỉ lệ hao hụt', default: 1.0 })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.menus.coefficient_number' })
  @Min(0, { message: 'validation.menus.coefficient_min' })
  @Max(100, { message: 'validation.menus.coefficient_max' })
  coefficient?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thành phần (nếu chỉnh sửa công thức inline)',
    type: [MenuDishDetailDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.details_is_array' })
  @ArrayMaxSize(100, { message: 'validation.menus.details_max_100' })
  @ValidateNested({ each: true })
  @Type(() => MenuDishDetailDto)
  details?: MenuDishDetailDto[];
}

export class MenuMealDto {
  @ApiPropertyOptional({ description: 'ID bữa ăn (nếu tái sử dụng bữa ăn)' })
  @IsOptional()
  mealId?: string | number;

  @ApiPropertyOptional({ description: 'Tên bữa ăn (ví dụ: Bữa Sáng, Bữa Trưa)' })
  @IsOptional()
  @IsString({ message: 'validation.menus.meal_name_string' })
  @MaxLength(255, { message: 'validation.menus.meal_name_max' })
  mealName?: string;

  @ApiPropertyOptional({ description: 'Giờ ăn định dạng HH:mm', example: '07:00' })
  @IsOptional()
  @IsString({ message: 'validation.menus.meal_time_string' })
  @MaxLength(50, { message: 'validation.menus.meal_time_max' })
  time?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn', default: 'RIENG_TU' })
  @IsOptional()
  @IsString({ message: 'validation.menus.status_string' })
  @MaxLength(50, { message: 'validation.menus.status_max' })
  status?: string;

  @ApiPropertyOptional({ description: 'Có công khai bữa ăn không', default: false })
  @IsOptional()
  @IsBoolean({ message: 'validation.menus.is_public_boolean' })
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách món ăn trong bữa',
    type: [MenuDishDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.menus.dishes_is_array' })
  @ArrayMaxSize(50, { message: 'validation.menus.dishes_max_50' })
  @ValidateNested({ each: true })
  @Type(() => MenuDishDto)
  dishes?: MenuDishDto[];
}

export class MenuDayDto {
  @ApiProperty({ description: 'Thứ trong tuần (1..7 hoặc 2..8 cho Thứ 2 -> CN)', example: 2 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.menus.day_of_week_int' })
  @Min(1, { message: 'validation.menus.day_of_week_min' })
  @Max(8, { message: 'validation.menus.day_of_week_max' })
  dayOfWeek: number;

  @ApiProperty({
    description: 'Danh sách bữa ăn trong ngày',
    type: [MenuMealDto],
  })
  @IsArray({ message: 'validation.menus.meals_is_array' })
  @ArrayMaxSize(20, { message: 'validation.menus.meals_per_day_max_20' })
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals: MenuMealDto[];
}

export class MenuWeekDto {
  @ApiProperty({ description: 'Số thứ tự tuần (1..4)', example: 1 })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.menus.week_number_int' })
  @Min(1, { message: 'validation.menus.week_no_min' })
  @Max(52, { message: 'validation.menus.week_no_max' })
  weekNo: number;

  @ApiProperty({
    description: 'Danh sách các ngày trong tuần',
    type: [MenuDayDto],
  })
  @IsArray({ message: 'validation.menus.days_is_array' })
  @ArrayMaxSize(7, { message: 'validation.menus.days_per_week_max_7' })
  @ValidateNested({ each: true })
  @Type(() => MenuDayDto)
  days: MenuDayDto[];
}

export class CreateMenuDto {
  @ApiProperty({
    description: 'Tên thực đơn',
    example: 'Thực đơn mẫu tuần 1 cho bệnh nhân đái tháo đường',
  })
  @IsNotEmpty({ message: 'validation.menus.name_required' })
  @IsString({ message: 'validation.menus.name_string' })
  @MaxLength(255, { message: 'validation.menus.name_max' })
  menuName: string;

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

  @ApiProperty({
    description: 'Loại thực đơn: NGAY | TUAN | THANG',
    enum: MenuType,
    example: MenuType.NGAY,
  })
  @IsNotEmpty({ message: 'validation.menus.menu_type_required' })
  @IsEnum(MenuType, { message: 'validation.menus.menu_type_enum' })
  menuType: MenuType;

  @ApiProperty({
    description: 'Đối tượng thực đơn: BENH_NHAN | NHOM_BENH',
    enum: TargetType,
    example: TargetType.BENH_NHAN,
  })
  @IsNotEmpty({ message: 'validation.menus.target_type_required' })
  @IsEnum(TargetType, { message: 'validation.menus.target_type_enum' })
  targetType: TargetType;

  @ApiPropertyOptional({ description: 'ID bệnh nhân (nếu là thực đơn cá nhân)' })
  @IsOptional()
  patientId?: string | number;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh mở rộng (nếu là thực đơn nhóm bệnh)' })
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
