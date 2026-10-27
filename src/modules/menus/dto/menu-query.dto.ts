import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { MenuType, TargetType } from '../../../config/enums/domain.enum';

export class MenuQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mục trên mỗi trang (tối đa 100)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên thực đơn' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm phụ (tương thích FE)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: MenuType,
    description: 'Lọc theo loại thực đơn: NGAY | TUAN | THANG',
  })
  @IsOptional()
  @IsEnum(MenuType)
  menuType?: MenuType;

  @ApiPropertyOptional({
    enum: TargetType,
    description: 'Lọc theo đối tượng: BENH_NHAN | NHOM_BENH',
  })
  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @ApiPropertyOptional({ description: 'Lọc theo ID bệnh nhân' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhóm bệnh mở rộng' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diseaseGroupId?: number;

  @ApiPropertyOptional({ description: 'Lọc thực đơn công khai' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublic?: boolean;
}
