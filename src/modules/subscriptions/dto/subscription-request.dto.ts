import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class PaymentDocRequestDto {
  @ApiPropertyOptional({ example: 'payment/receipt_123.jpg', description: 'Object key từ file upload' })
  @IsOptional()
  @IsString()
  objectKey?: string;

  @ApiPropertyOptional({ example: 'bien_lai_chuyen_khoan.jpg', description: 'Tên file gốc' })
  @IsOptional()
  @IsString()
  originalFileName?: string;

  @ApiPropertyOptional({ example: 'image/jpeg', description: 'MIME type của file' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.jpg', description: 'Link ngoài nếu có' })
  @IsOptional()
  @IsString()
  externalLink?: string;
}

export class SubscriptionRequestDto {
  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước đăng ký' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  ma_goi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias maGoi)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  maGoi?: string;

  @ApiPropertyOptional({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(50)
  packageCode?: string;

  @ApiPropertyOptional({ type: [PaymentDocRequestDto], description: 'Danh sách chứng từ / hóa đơn thanh toán đính kèm' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDocRequestDto)
  documents?: PaymentDocRequestDto[];

  getPackageCode(): string {
    const raw = this.ma_goi || this.maGoi || this.packageCode || '';
    return raw.trim();
  }
}
