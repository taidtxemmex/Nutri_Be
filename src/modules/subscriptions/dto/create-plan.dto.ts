import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  packageCode?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước' })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  ten_goi?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (alias name)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (alias packageName)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  packageName?: string;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số ngày sử dụng phải là số nguyên' })
  @Min(1, { message: 'Số ngày sử dụng phải lớn hơn 0' })
  so_ngay_su_dung?: number;

  @ApiPropertyOptional({ example: 30, description: 'Số ngày sử dụng (alias usageDays)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số ngày sử dụng phải là số nguyên' })
  @Min(1, { message: 'Số ngày sử dụng phải lớn hơn 0' })
  usageDays?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (VND)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tiền phải là số' })
  @Min(0, { message: 'Giá tiền không được âm' })
  gia_tien?: number;

  @ApiPropertyOptional({ example: 199000, description: 'Giá tiền (alias price)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tiền phải là số' })
  @Min(0, { message: 'Giá tiền không được âm' })
  price?: number;

  @ApiPropertyOptional({ example: 'Toàn quyền sử dụng các tính năng nâng cao', description: 'Mô tả gói' })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  mo_ta?: string;

  @ApiPropertyOptional({ example: 'Toàn quyền sử dụng các tính năng nâng cao', description: 'Mô tả (alias description)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói: ACTIVE | INACTIVE' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  trang_thai?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', description: 'Trạng thái gói (alias status)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
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
