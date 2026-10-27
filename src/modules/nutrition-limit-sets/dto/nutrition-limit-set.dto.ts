import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { NutritionLimitWarning } from '../../../config/enums/domain.enum';

export class CreateNutritionLimitSetDto {
  @ApiPropertyOptional({
    description: 'Tên bộ giới hạn dinh dưỡng',
    example: 'Giới hạn tiểu đường Type 2',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Quy tắc cảnh báo dung sai',
    enum: NutritionLimitWarning,
    default: NutritionLimitWarning.OFF,
  })
  @IsOptional()
  @IsEnum(NutritionLimitWarning)
  warningRule?: NutritionLimitWarning;

  @ApiPropertyOptional({ description: 'Có cho phép tái sử dụng làm mẫu không', default: false })
  @IsOptional()
  @IsBoolean()
  reusable?: boolean;

  @ApiProperty({
    description: 'Bản đồ giới hạn vi chất (chỉ tiêu -> ngưỡng tối đa/tối thiểu)',
    example: { energy: 2000, protein: 75, fat: 50, carbohydrate: 280, sodium: 2000 },
  })
  @IsObject()
  limits: Record<string, any>;
}

export class UpdateNutritionLimitSetDto {
  @ApiPropertyOptional({
    description: 'Tên bộ giới hạn dinh dưỡng',
    example: 'Giới hạn tiểu đường Type 2 (Cập nhật)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Quy tắc cảnh báo dung sai',
    enum: NutritionLimitWarning,
  })
  @IsOptional()
  @IsEnum(NutritionLimitWarning)
  warningRule?: NutritionLimitWarning;

  @ApiPropertyOptional({ description: 'Có cho phép tái sử dụng làm mẫu không' })
  @IsOptional()
  @IsBoolean()
  reusable?: boolean;

  @ApiPropertyOptional({
    description: 'Bản đồ giới hạn vi chất',
  })
  @IsOptional()
  @IsObject()
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
