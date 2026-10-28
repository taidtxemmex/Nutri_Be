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
import { Type } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';

export class MenuDishDetailDto {
  @ApiProperty({ description: 'ID nguyên liệu' })
  @IsNotEmpty()
  ingredientId: string | number;

  @ApiProperty({ description: 'Khối lượng sống sạch (g)' })
  @IsNumber()
  @Min(0, { message: 'Khối lượng sống sạch phải lớn hơn hoặc bằng 0' })
  @Max(10000, { message: 'Khối lượng sống sạch không được vượt quá 10000 gam' })
  netWeight: number;
}

export class MenuDishDto {
  @ApiPropertyOptional({ description: 'ID món ăn (nếu dùng món có sẵn)' })
  @IsOptional()
  dishId?: string | number;

  @ApiPropertyOptional({ description: 'Tên món ăn (nếu tạo món mới inline)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tên món ăn không được vượt quá 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({ description: 'Hệ số sống chín / tỉ lệ hao hụt', default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Hệ số sống chín phải lớn hơn hoặc bằng 0' })
  @Max(100, { message: 'Hệ số sống chín không được vượt quá 100' })
  coefficient?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Danh sách nguyên liệu thành phần (nếu chỉnh sửa công thức inline)',
    type: [MenuDishDetailDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu tối đa 100 mục' })
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
  @IsString()
  @MaxLength(255, { message: 'Tên bữa ăn không được vượt quá 255 ký tự' })
  mealName?: string;

  @ApiProperty({ description: 'Giờ ăn định dạng HH:mm', example: '07:00' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Giờ ăn không được vượt quá 50 ký tự' })
  time: string;

  @ApiPropertyOptional({ description: 'Trạng thái bữa ăn', default: 'RIENG_TU' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Trạng thái không được vượt quá 50 ký tự' })
  status?: string;

  @ApiPropertyOptional({ description: 'Có công khai bữa ăn không', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách món ăn trong bữa',
    type: [MenuDishDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Danh sách món ăn tối đa 50 món' })
  @ValidateNested({ each: true })
  @Type(() => MenuDishDto)
  dishes?: MenuDishDto[];
}

export class MenuDayDto {
  @ApiProperty({ description: 'Thứ trong tuần (1..7 hoặc 2..8 cho Thứ 2 -> CN)', example: 2 })
  @IsInt({ message: 'Thứ trong tuần phải là số nguyên' })
  @Min(1)
  @Max(8)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Danh sách bữa ăn trong ngày',
    type: [MenuMealDto],
  })
  @IsArray()
  @ArrayMaxSize(20, { message: 'Danh sách bữa ăn trong ngày tối đa 20 bữa' })
  @ValidateNested({ each: true })
  @Type(() => MenuMealDto)
  meals: MenuMealDto[];
}

export class MenuWeekDto {
  @ApiProperty({ description: 'Số thứ tự tuần (1..4)', example: 1 })
  @IsInt({ message: 'Số thứ tự tuần phải là số nguyên' })
  @Min(1)
  @Max(52)
  weekNo: number;

  @ApiProperty({
    description: 'Danh sách các ngày trong tuần',
    type: [MenuDayDto],
  })
  @IsArray()
  @ArrayMaxSize(7, { message: 'Danh sách ngày trong tuần tối đa 7 ngày' })
  @ValidateNested({ each: true })
  @Type(() => MenuDayDto)
  days: MenuDayDto[];
}

export class CreateMenuDto {
  @ApiProperty({
    description: 'Tên thực đơn',
    example: 'Thực đơn mẫu tuần 1 cho bệnh nhân đái tháo đường',
  })
  @IsNotEmpty({ message: 'Tên thực đơn không được để trống' })
  @IsString({ message: 'Tên thực đơn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên thực đơn không được vượt quá 255 ký tự' })
  menuName: string;

  @ApiProperty({
    description: 'Loại thực đơn: NGAY | TUAN | THANG',
    enum: MenuType,
    example: MenuType.NGAY,
  })
  @IsNotEmpty()
  @IsEnum(MenuType)
  menuType: MenuType;

  @ApiProperty({
    description: 'Đối tượng thực đơn: BENH_NHAN | NHOM_BENH',
    enum: TargetType,
    example: TargetType.BENH_NHAN,
  })
  @IsNotEmpty()
  @IsEnum(TargetType)
  targetType: TargetType;

  @ApiPropertyOptional({ description: 'ID bệnh nhân (nếu là thực đơn cá nhân)' })
  @IsOptional()
  patientId?: string | number;

  @ApiPropertyOptional({ description: 'ID nhóm bệnh mở rộng (nếu là thực đơn nhóm bệnh)' })
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
