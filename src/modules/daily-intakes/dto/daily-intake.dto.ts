import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsInt,
  MaxLength,
  IsDateString,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IntakeInputType } from '../../../config/enums/domain.enum';

export class DailyIntakeIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu' })
  @IsNotEmpty({ message: 'validation.daily_intakes.ingredient_id_required' })
  @Type(() => Number)
  ingredientId: string | number;

  @ApiProperty({ description: 'Khối lượng sống sạch / thô thực tế (g)', example: 150 })
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.daily_intakes.weight_number' })
  @Min(0, { message: 'validation.daily_intakes.weight_min_0' })
  @Max(1000000, { message: 'validation.daily_intakes.weight_max_1m' })
  rawWeight: number;
}

export class DailyIntakeMealInputDto {
  @ApiProperty({
    description: 'Thứ tự bữa ăn trong ngày (1: Sáng, 2: Trưa, 3: Chiều, ...)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'validation.daily_intakes.meal_order_int' })
  @Min(1, { message: 'validation.daily_intakes.meal_order_min' })
  @Max(1000, { message: 'validation.daily_intakes.meal_order_max_1000' })
  mealOrder: number;

  @ApiPropertyOptional({ description: 'Tên bữa ăn', example: 'Bữa Sáng' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.meal_name_string' })
  @MaxLength(255, { message: 'validation.daily_intakes.meal_name_max' })
  mealName?: string;

  @ApiPropertyOptional({ description: 'Giờ ăn định dạng HH:mm', example: '07:30' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.meal_time_string' })
  @MaxLength(50, { message: 'validation.daily_intakes.meal_time_max' })
  mealTime?: string;

  @ApiProperty({
    description: 'Danh sách nguyên liệu trong bữa',
    type: [DailyIntakeIngredientInputDto],
  })
  @IsArray({ message: 'validation.daily_intakes.ingredients_is_array' })
  @ArrayMaxSize(100, { message: 'validation.daily_intakes.ingredients_max_100' })
  @ValidateNested({ each: true })
  @Type(() => DailyIntakeIngredientInputDto)
  ingredients: DailyIntakeIngredientInputDto[];
}

export class CreateDailyIntakeDto {
  @ApiProperty({ description: 'ID bệnh nhân', example: '1' })
  @IsNotEmpty({ message: 'validation.daily_intakes.patient_id_required' })
  @Type(() => Number)
  patientId: string | number;

  @ApiProperty({ description: 'Ngày ăn định dạng YYYY-MM-DD', example: '2026-02-01' })
  @IsNotEmpty({ message: 'validation.daily_intakes.intake_date_required' })
  @IsDateString({}, { message: 'validation.daily_intakes.intake_date_format' })
  intakeDate: string;

  @ApiProperty({
    description: 'Kiểu nhập: BY_MEAL (theo bữa) | INGREDIENT_ONLY (theo ngày)',
    enum: IntakeInputType,
    example: IntakeInputType.BY_MEAL,
  })
  @IsNotEmpty({ message: 'validation.daily_intakes.input_type_required' })
  @IsEnum(IntakeInputType, { message: 'validation.daily_intakes.input_type_enum' })
  inputType: IntakeInputType;

  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng của bác sĩ' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.note_string' })
  @MaxLength(2000, { message: 'validation.daily_intakes.note_max_2000' })
  note?: string;

  @ApiProperty({
    description: 'Danh sách bữa ăn và nguyên liệu ghi nhận',
    type: [DailyIntakeMealInputDto],
  })
  @IsArray({ message: 'validation.daily_intakes.meals_is_array' })
  @ArrayMinSize(1, { message: 'validation.daily_intakes.meals_min_1' })
  @ArrayMaxSize(50, { message: 'validation.daily_intakes.meals_max_50' })
  @ValidateNested({ each: true })
  @Type(() => DailyIntakeMealInputDto)
  meals: DailyIntakeMealInputDto[];
}

export class UpdateDailyIntakeDto {
  @ApiPropertyOptional({ description: 'Ngày ăn định dạng YYYY-MM-DD', example: '2026-02-01' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.intake_date_string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.daily_intakes.intake_date_format' })
  intakeDate?: string;

  @ApiPropertyOptional({ description: 'ID bệnh nhân', example: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @Type(() => Number)
  @IsInt({ message: 'validation.daily_intakes.patient_id_int' })
  @Min(1, { message: 'validation.daily_intakes.patient_id_min' })
  patientId?: number;

  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng' })
  @IsOptional()
  @IsString({ message: 'validation.daily_intakes.note_string' })
  @MaxLength(2000, { message: 'validation.daily_intakes.note_max_2000' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Kiểu nhập khẩu phần',
    enum: IntakeInputType,
  })
  @IsOptional()
  @IsEnum(IntakeInputType, { message: 'validation.daily_intakes.input_type_enum' })
  inputType?: IntakeInputType;

  @ApiPropertyOptional({
    description: 'Danh sách bữa ăn cập nhật',
    type: [DailyIntakeMealInputDto],
  })
  @IsOptional()
  @IsArray({ message: 'validation.daily_intakes.meals_is_array' })
  @ArrayMaxSize(50, { message: 'validation.daily_intakes.meals_max_50' })
  @ValidateNested({ each: true })
  @Type(() => DailyIntakeMealInputDto)
  meals?: DailyIntakeMealInputDto[];
}

export class DailyIntakeIngredientResponseDto {
  @ApiProperty({ description: 'ID chi tiết nguyên liệu khẩu phần' })
  id: string;

  @ApiProperty({ description: 'ID nguyên liệu master' })
  ingredientId: string;

  @ApiProperty({ description: 'Tên nguyên liệu' })
  ingredientName: string;

  @ApiProperty({ description: 'Khối lượng ghi nhận (g)' })
  rawWeight: number;

  @ApiPropertyOptional({ description: 'Tỷ lệ ăn được (%)' })
  edible?: number | null;

  @ApiProperty({ description: 'Vi chất dinh dưỡng của nguyên liệu' })
  nutrients: Record<string, number>;
}

export class DailyIntakeMealResponseDto {
  @ApiProperty({ description: 'ID bữa ăn khẩu phần' })
  id: string;

  @ApiProperty({ description: 'Thứ tự bữa' })
  mealOrder: number;

  @ApiPropertyOptional({ description: 'Tên bữa' })
  mealName?: string | null;

  @ApiPropertyOptional({ description: 'Giờ ăn' })
  mealTime?: string | null;

  @ApiProperty({ description: 'Danh sách nguyên liệu', type: [DailyIntakeIngredientResponseDto] })
  ingredients: DailyIntakeIngredientResponseDto[];

  @ApiProperty({ description: 'Tổng dinh dưỡng của bữa' })
  totalMealNutrients: Record<string, number>;
}

export class DailyIntakeResponseDto {
  @ApiProperty({ description: 'ID bản ghi khẩu phần 24h' })
  id: string;

  @ApiProperty({ description: 'ID bệnh nhân' })
  patientId: string;

  @ApiPropertyOptional({ description: 'Tên bệnh nhân' })
  patientName?: string | null;

  @ApiProperty({ description: 'Ngày ăn (YYYY-MM-DD)' })
  intakeDate: string;

  @ApiProperty({ description: 'Kiểu nhập khẩu phần' })
  inputType: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  note?: string | null;

  @ApiProperty({ description: 'Danh sách các bữa ăn', type: [DailyIntakeMealResponseDto] })
  meals: DailyIntakeMealResponseDto[];

  @ApiProperty({ description: 'Tổng hợp 86 chỉ tiêu dinh dưỡng thực tế cả ngày' })
  totalDayNutrients: Record<string, number>;
}

export class DailyIntakeListDto {
  @ApiProperty({ description: 'ID bản ghi khẩu phần' })
  id: string;

  @ApiProperty({ description: 'ID bệnh nhân' })
  patientId: string;

  @ApiPropertyOptional({ description: 'Tên bệnh nhân' })
  patientName?: string | null;

  @ApiProperty({ description: 'Ngày ăn (YYYY-MM-DD)' })
  intakeDate: string;

  @ApiProperty({ description: 'Kiểu nhập' })
  inputType: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  note?: string | null;

  @ApiPropertyOptional({ description: 'Tổng năng lượng tính toán (kcal)' })
  totalEnergyKcal?: number | null;

  @ApiPropertyOptional({ description: 'Thời điểm tạo' })
  createdAt?: Date | string | null;
}
