import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 1, description: 'ID gói cước' })
  @IsOptional()
  id?: number | string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng Cập Nhật', description: 'Tên gói cước' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  ten_goi?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng Cập Nhật',
    description: 'Tên gói cước (alias name)',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng Cập Nhật',
    description: 'Tên gói cước (alias packageName)',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  packageName?: string;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.subscriptions.duration_int' })
  @Min(1, { message: 'validation.subscriptions.duration_positive' })
  @Max(3650, { message: 'validation.subscriptions.duration_max' })
  so_ngay_su_dung?: number;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng (alias usageDays)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsInt({ message: 'validation.subscriptions.duration_int' })
  @Min(1, { message: 'validation.subscriptions.duration_positive' })
  @Max(3650, { message: 'validation.subscriptions.duration_max' })
  usageDays?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (VND)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.subscriptions.price_number' })
  @Min(0, { message: 'validation.subscriptions.price_min_0' })
  @Max(1000000000, { message: 'validation.subscriptions.price_max' })
  gia_tien?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (alias price)' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsNumber({}, { message: 'validation.subscriptions.price_number' })
  @Min(0, { message: 'validation.subscriptions.price_min_0' })
  @Max(1000000000, { message: 'validation.subscriptions.price_max' })
  price?: number;

  @ApiPropertyOptional({ example: 'Mô tả cập nhật', description: 'Mô tả gói' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.subscriptions.desc_max' })
  mo_ta?: string;

  @ApiPropertyOptional({ example: 'Mô tả cập nhật', description: 'Mô tả (alias description)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.subscriptions.desc_max' })
  description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói: ACTIVE | INACTIVE' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.status_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @MaxLength(50, { message: 'validation.subscriptions.status_max_50' })
  trang_thai?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói (alias status)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.status_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @MaxLength(50, { message: 'validation.subscriptions.status_max_50' })
  status?: string;

  getPackageName(): string | undefined {
    const raw = this.ten_goi ?? this.name ?? this.packageName;
    return typeof raw === 'string' ? raw.trim() : undefined;
  }

  getUsageDays(): number | undefined {
    const val = this.so_ngay_su_dung ?? this.usageDays;
    return val !== undefined && val !== null ? Number(val) : undefined;
  }

  getPrice(): number | undefined {
    const val = this.gia_tien ?? this.price;
    return val !== undefined && val !== null ? Number(val) : undefined;
  }

  getDescription(): string | undefined {
    const raw = this.mo_ta ?? this.description;
    return typeof raw === 'string' ? raw.trim() : undefined;
  }

  getStatus(): string | undefined {
    const raw = this.trang_thai ?? this.status;
    return typeof raw === 'string' ? raw.trim().toUpperCase() : undefined;
  }
}
