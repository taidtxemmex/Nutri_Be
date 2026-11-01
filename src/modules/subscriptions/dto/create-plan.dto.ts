import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước duy nhất' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  ma_goi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias code)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  code?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  packageCode?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  ten_goi?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (alias name)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng',
    description: 'Tên gói cước (alias packageName)',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_name_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.plan_name_max_255' })
  packageName?: string;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.subscriptions.duration_int' })
  @Min(1, { message: 'validation.subscriptions.duration_positive' })
  @Max(3650, { message: 'validation.subscriptions.duration_max' })
  so_ngay_su_dung?: number;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng (alias usageDays)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'validation.subscriptions.duration_int' })
  @Min(1, { message: 'validation.subscriptions.duration_positive' })
  @Max(3650, { message: 'validation.subscriptions.duration_max' })
  usageDays?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.subscriptions.price_number' })
  @Min(0, { message: 'validation.subscriptions.price_min_0' })
  @Max(1000000000, { message: 'validation.subscriptions.price_max' })
  gia_tien?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (alias price)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'validation.subscriptions.price_number' })
  @Min(0, { message: 'validation.subscriptions.price_min_0' })
  @Max(1000000000, { message: 'validation.subscriptions.price_max' })
  price?: number;

  @ApiPropertyOptional({
    example: 'Toàn quyền sử dụng các tính năng nâng cao',
    description: 'Mô tả gói',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.desc_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'validation.subscriptions.desc_max' })
  mo_ta?: string;

  @ApiPropertyOptional({
    example: 'Toàn quyền sử dụng các tính năng nâng cao',
    description: 'Mô tả (alias description)',
  })
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

  getPackageCode(): string {
    const raw = this.ma_goi || this.code || this.packageCode || '';
    return raw.trim();
  }

  getPackageName(): string {
    const raw = this.ten_goi || this.name || this.packageName || '';
    return raw.trim();
  }

  getUsageDays(): number {
    return Number(this.so_ngay_su_dung ?? this.usageDays ?? 30);
  }

  getPrice(): number {
    return Number(this.gia_tien ?? this.price ?? 0);
  }

  getDescription(): string {
    return (this.mo_ta || this.description || '').trim();
  }

  getStatus(): string {
    return (this.trang_thai || this.status || 'ACTIVE').toUpperCase();
  }
}
