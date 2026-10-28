import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 1, description: 'ID gói cước' })
  @IsOptional()
  id?: number | string;

  @ApiPropertyOptional({ example: 'Gói Pro 1 Tháng Cập Nhật', description: 'Tên gói cước' })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  ten_goi?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng Cập Nhật',
    description: 'Tên gói cước (alias name)',
  })
  @IsOptional()
  @IsString({ message: 'Tên gói cước phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên gói cước tối đa 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Gói Pro 1 Tháng Cập Nhật',
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

  @ApiPropertyOptional({ example: 'Mô tả cập nhật', description: 'Mô tả gói' })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(5000, { message: 'Mô tả không được vượt quá 5000 ký tự' })
  mo_ta?: string;

  @ApiPropertyOptional({ example: 'Mô tả cập nhật', description: 'Mô tả (alias description)' })
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

  getPackageName(): string | undefined {
    const raw = this.ten_goi ?? this.name ?? this.packageName;
    return raw !== undefined ? raw.trim() : undefined;
  }

  getUsageDays(): number | undefined {
    const val = this.so_ngay_su_dung ?? this.usageDays;
    return val !== undefined ? Number(val) : undefined;
  }

  getPrice(): number | undefined {
    const val = this.gia_tien ?? this.price;
    return val !== undefined ? Number(val) : undefined;
  }

  getDescription(): string | undefined {
    const raw = this.mo_ta ?? this.description;
    return raw !== undefined ? raw.trim() : undefined;
  }

  getStatus(): string | undefined {
    const raw = this.trang_thai ?? this.status;
    return raw !== undefined ? raw.trim().toUpperCase() : undefined;
  }
}
