import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class PaymentDocRequestDto {
  @ApiPropertyOptional({
    example: 'payment/receipt_123.jpg',
    description: 'Object key từ file upload',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.object_key_string' })
  @MaxLength(255, { message: 'validation.subscriptions.object_key_max_255' })
  objectKey?: string;

  @ApiPropertyOptional({ example: 'bien_lai_chuyen_khoan.jpg', description: 'Tên file gốc' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.original_filename_string' })
  @MaxLength(255, { message: 'validation.subscriptions.original_filename_max_255' })
  originalFileName?: string;

  @ApiPropertyOptional({ example: 'image/jpeg', description: 'MIME type của file' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.mime_type_string' })
  @MaxLength(100, { message: 'validation.subscriptions.mime_type_max_100' })
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/receipt.jpg',
    description: 'Link ngoài nếu có (chỉ chấp nhận http:// hoặc https://, tối đa 1000 ký tự)',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.external_link_string' })
  @MaxLength(1000, { message: 'validation.subscriptions.external_link_max_1000' })
  @Matches(/^https?:\/\//i, {
    message: 'validation.subscriptions.external_link_safe_url',
  })
  externalLink?: string;
}

export class SubscriptionRequestDto {
  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước đăng ký' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  ma_goi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias maGoi)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  maGoi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.plan_code_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'validation.subscriptions.plan_code_max_50' })
  packageCode?: string;

  @ApiPropertyOptional({
    type: [PaymentDocRequestDto],
    description: 'Danh sách chứng từ / hóa đơn thanh toán đính kèm (tối đa 10 tệp)',
  })
  @IsOptional()
  @IsArray({ message: 'validation.subscriptions.documents_array' })
  @ArrayMaxSize(10, { message: 'validation.subscriptions.documents_max_10' })
  @ValidateNested({ each: true })
  @Type(() => PaymentDocRequestDto)
  documents?: PaymentDocRequestDto[];

  getPackageCode(): string {
    const raw = this.ma_goi || this.maGoi || this.packageCode || '';
    return typeof raw === 'string' ? raw.trim() : String(raw).trim();
  }
}
