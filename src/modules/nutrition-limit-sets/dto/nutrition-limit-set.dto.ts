import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { NutritionLimitWarning } from '../../../config/enums/domain.enum';

export class CreateNutritionLimitSetDto {
  @ApiPropertyOptional({ description: 'ID bộ giới hạn (nếu có)' })
  @IsOptional()
  id?: number | string;

  @ApiPropertyOptional({
    description: 'Tên bộ giới hạn dinh dưỡng',
    example: 'Giới hạn tiểu đường Type 2',
  })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_limits.name_string' })
  @MaxLength(255, { message: 'validation.nutrition_limits.name_max' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Quy tắc cảnh báo dung sai',
    enum: NutritionLimitWarning,
    default: NutritionLimitWarning.OFF,
  })
  @IsOptional()
  @IsEnum(NutritionLimitWarning, { message: 'validation.nutrition_limits.warning_rule_enum' })
  warningRule?: NutritionLimitWarning;

  @ApiPropertyOptional({ description: 'Có cho phép tái sử dụng làm mẫu không', default: false })
  @IsOptional()
  @IsBoolean({ message: 'validation.nutrition_limits.reusable_boolean' })
  reusable?: boolean;

  @ApiProperty({
    description: 'Bản đồ giới hạn vi chất (chỉ tiêu -> ngưỡng tối đa/tối thiểu)',
    example: { energy: 2000, protein: 75, fat: 50, carbohydrate: 280, sodium: 2000 },
  })
  @IsNotEmpty({ message: 'validation.nutrition_limits.limits_required' })
  @IsObject({ message: 'validation.nutrition_limits.limits_object' })
  limits: Record<string, any>;
}

export class UpdateNutritionLimitSetDto {
  @ApiPropertyOptional({ description: 'ID bộ giới hạn (nếu có)' })
  @IsOptional()
  id?: number | string;

  @ApiPropertyOptional({
    description: 'Tên bộ giới hạn dinh dưỡng',
    example: 'Giới hạn tiểu đường Type 2 (Cập nhật)',
  })
  @IsOptional()
  @IsString({ message: 'validation.nutrition_limits.name_string' })
  @MaxLength(255, { message: 'validation.nutrition_limits.name_max' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Quy tắc cảnh báo dung sai',
    enum: NutritionLimitWarning,
  })
  @IsOptional()
  @IsEnum(NutritionLimitWarning, { message: 'validation.nutrition_limits.warning_rule_enum' })
  warningRule?: NutritionLimitWarning;

  @ApiPropertyOptional({ description: 'Có cho phép tái sử dụng làm mẫu không' })
  @IsOptional()
  @IsBoolean({ message: 'validation.nutrition_limits.reusable_boolean' })
  reusable?: boolean;

  @ApiPropertyOptional({
    description: 'Bản đồ giới hạn vi chất',
  })
  @IsOptional()
  @IsObject({ message: 'validation.nutrition_limits.limits_object' })
  limits?: Record<string, any>;
}

export class NutritionLimitSetResponseDto {
  @ApiProperty({ description: 'ID bộ giới hạn dinh dưỡng' })
  id: string;

  @ApiProperty({ description: 'Tên bộ giới hạn dinh dưỡng' })
  name: string;

  @ApiProperty({ description: 'Quy tắc cảnh báo', enum: NutritionLimitWarning })
  warningRule: string;

  @ApiProperty({ description: 'Có tái sử dụng không' })
  reusable: boolean;

  @ApiProperty({ description: 'Bản đồ giới hạn vi chất' })
  limits: Record<string, any>;

  @ApiPropertyOptional({ description: 'Ngày tạo' })
  createdAt?: Date | string | null;

  @ApiPropertyOptional({ description: 'Ngày cập nhật' })
  updatedAt?: Date | string | null;
}
