import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước duy nhất' })
  @IsOptional()
  @IsString({ message: 'Mã gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  ma_goi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias code)' })
  @IsOptional()
  @IsString({ message: 'Mã gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  code?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString({ message: 'Mã gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  packageCode?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước' })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  ten_goi?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (alias name)' })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng',
    description: 'Tên gói cước (alias packageName)',
  })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  packageName?: string;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày sử dụng phải là số nguyên' })
  @Min(1, { message: 'Số ngày sử dụng phải lớn hơn 0' })
  @Max(3650, { message: 'Số ngày sử dụng tối đa 3650 ngày (10 năm)' })
  so_ngay_su_dung?: number;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng (alias usageDays)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày sử dụng phải là số nguyên' })
  @Min(1, { message: 'Số ngày sử dụng phải lớn hơn 0' })
  @Max(3650, { message: 'Số ngày sử dụng tối đa 3650 ngày (10 năm)' })
  usageDays?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tiền phải là số' })
  @Min(0, { message: 'Giá tiền không được âm' })
  @Max(1000000000, { message: 'Giá tiền không được vượt quá 1,000,000,000 VND' })
  gia_tien?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (alias price)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tiền phải là số' })
  @Min(0, { message: 'Giá tiền không được âm' })
  @Max(1000000000, { message: 'Giá tiền không được vượt quá 1,000,000,000 VND' })
  price?: number;

  @ApiPropertyOptional({
    example: 'Toàn quyền sử dụng các tính năng nâng cao',
    description: 'Mô tả gói',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả không được vượt quá 5000 ký tự' })
  mo_ta?: string;

  @ApiPropertyOptional({
    example: 'Toàn quyền sử dụng các tính năng nâng cao',
    description: 'Mô tả (alias description)',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả không được vượt quá 5000 ký tự' })
  description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói: ACTIVE | INACTIVE' })
  @IsOptional()
  @IsString({ message: 'Trạng thái phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @MaxLength(50, { message: 'Trạng thái tối đa 50 ký tự' })
  trang_thai?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói (alias status)' })
  @IsOptional()
  @IsString({ message: 'Trạng thái phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @MaxLength(50, { message: 'Trạng thái tối đa 50 ký tự' })
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
