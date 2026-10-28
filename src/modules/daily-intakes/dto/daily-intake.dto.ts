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
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntakeInputType } from '../../../config/enums/domain.enum';

export class DailyIntakeIngredientInputDto {
  @ApiProperty({ description: 'ID nguyên liệu' })
  @IsNotEmpty({ message: 'ID nguyên liệu không được để trống' })
  ingredientId: string | number;

  @ApiProperty({ description: 'Khối lượng sống sạch / thô thực tế (g)', example: 150 })
  @IsNumber({}, { message: 'Khối lượng phải là số' })
  @Min(0, { message: 'Khối lượng không được âm' })
  @Max(10000, { message: 'Khối lượng không được vượt quá 10000 gam' })
  rawWeight: number;
}

export class DailyIntakeMealInputDto {
  @ApiProperty({
    description: 'Thứ tự bữa ăn trong ngày (1: Sáng, 2: Trưa, 3: Chiều, ...)',
    example: 1,
  })
  @IsInt({ message: 'Thứ tự bữa ăn phải là số nguyên' })
  @Min(1, { message: 'Thứ tự bữa ăn tối thiểu là 1' })
  @Max(20, { message: 'Thứ tự bữa ăn tối đa là 20' })
  mealOrder: number;

  @ApiPropertyOptional({ description: 'Tên bữa ăn', example: 'Bữa Sáng' })
  @IsOptional()
  @IsString({ message: 'Tên bữa ăn phải là chuỗi' })
  @MaxLength(255, { message: 'Tên bữa ăn tối đa 255 ký tự' })
  mealName?: string;

  @ApiPropertyOptional({ description: 'Giờ ăn định dạng HH:mm', example: '07:30' })
  @IsOptional()
  @IsString({ message: 'Giờ ăn phải là chuỗi' })
  @MaxLength(20, { message: 'Giờ ăn không được vượt quá 20 ký tự' })
  mealTime?: string;

  @ApiProperty({
    description: 'Danh sách nguyên liệu trong bữa',
    type: [DailyIntakeIngredientInputDto],
  })
  @IsArray({ message: 'Danh sách nguyên liệu phải là mảng' })
  @ArrayMaxSize(100, { message: 'Danh sách nguyên liệu tối đa 100 mục' })
  @ValidateNested({ each: true })
  @Type(() => DailyIntakeIngredientInputDto)
  ingredients: DailyIntakeIngredientInputDto[];
}

export class CreateDailyIntakeDto {
  @ApiProperty({ description: 'ID bệnh nhân', example: '1' })
  @IsNotEmpty({ message: 'ID bệnh nhân không được để trống' })
  patientId: string | number;

  @ApiProperty({ description: 'Ngày ăn định dạng YYYY-MM-DD', example: '2026-02-01' })
  @IsNotEmpty({ message: 'Ngày ăn không được để trống' })
  @IsDateString({}, { message: 'Ngày ăn phải có định dạng YYYY-MM-DD' })
  intakeDate: string;

  @ApiProperty({
    description: 'Kiểu nhập: BY_MEAL (theo bữa) | INGREDIENT_ONLY (theo ngày)',
    enum: IntakeInputType,
    example: IntakeInputType.BY_MEAL,
  })
  @IsNotEmpty({ message: 'Kiểu nhập không được để trống' })
  @IsEnum(IntakeInputType, { message: 'Kiểu nhập khẩu phần không hợp lệ' })
  inputType: IntakeInputType;

  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng của bác sĩ' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(255, { message: 'Ghi chú tối đa 255 ký tự' })
  note?: string;

  @ApiProperty({
    description: 'Danh sách bữa ăn và nguyên liệu ghi nhận',
    type: [DailyIntakeMealInputDto],
  })
  @IsArray({ message: 'Danh sách bữa ăn phải là mảng' })
  @ArrayMinSize(1, { message: 'Danh sách bữa ăn phải có ít nhất 1 bữa' })
  @ArrayMaxSize(50, { message: 'Danh sách bữa ăn tối đa 50 bữa' })
  @ValidateNested({ each: true })
  @Type(() => DailyIntakeMealInputDto)
  meals: DailyIntakeMealInputDto[];
}

export class UpdateDailyIntakeDto {
  @ApiPropertyOptional({ description: 'Ghi chú lâm sàng' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(255, { message: 'Ghi chú tối đa 255 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Kiểu nhập khẩu phần',
    enum: IntakeInputType,
  })
  @IsOptional()
  @IsEnum(IntakeInputType, { message: 'Kiểu nhập khẩu phần không hợp lệ' })
  inputType?: IntakeInputType;

  @ApiPropertyOptional({
    description: 'Danh sách bữa ăn cập nhật',
    type: [DailyIntakeMealInputDto],
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách bữa ăn phải là mảng' })
  @ArrayMaxSize(50, { message: 'Danh sách bữa ăn tối đa 50 bữa' })
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
