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
  @IsString({ message: 'objectKey phải là chuỗi' })
  @MaxLength(255, { message: 'objectKey tối đa 255 ký tự' })
  objectKey?: string;

  @ApiPropertyOptional({ example: 'bien_lai_chuyen_khoan.jpg', description: 'Tên file gốc' })
  @IsOptional()
  @IsString({ message: 'originalFileName phải là chuỗi' })
  @MaxLength(255, { message: 'originalFileName tối đa 255 ký tự' })
  originalFileName?: string;

  @ApiPropertyOptional({ example: 'image/jpeg', description: 'MIME type của file' })
  @IsOptional()
  @IsString({ message: 'mimeType phải là chuỗi' })
  @MaxLength(100, { message: 'mimeType tối đa 100 ký tự' })
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/receipt.jpg',
    description: 'Link ngoài nếu có (chỉ chấp nhận http:// hoặc https://, tối đa 1000 ký tự)',
  })
  @IsOptional()
  @IsString({ message: 'externalLink phải là chuỗi' })
  @MaxLength(1000, { message: 'externalLink không được vượt quá 1000 ký tự' })
  @Matches(/^https?:\/\//i, {
    message: 'externalLink chỉ chấp nhận URL an toàn bắt đầu bằng http:// hoặc https://',
  })
  externalLink?: string;
}

export class SubscriptionRequestDto {
  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước đăng ký' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  ma_goi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias maGoi)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  maGoi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50, { message: 'Mã gói cước tối đa 50 ký tự' })
  packageCode?: string;

  @ApiPropertyOptional({
    type: [PaymentDocRequestDto],
    description: 'Danh sách chứng từ / hóa đơn thanh toán đính kèm (tối đa 10 tệp)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Tối đa 10 chứng từ đính kèm' })
  @ValidateNested({ each: true })
  @Type(() => PaymentDocRequestDto)
  documents?: PaymentDocRequestDto[];

  getPackageCode(): string {
    const raw = this.ma_goi || this.maGoi || this.packageCode || '';
    return raw.trim();
  }
}
