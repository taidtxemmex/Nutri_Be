import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SubscriptionApproveDto {
  @ApiPropertyOptional({
    example: 'Đã nhận đủ tiền qua ngân hàng',
    description: 'Ghi chú phê duyệt',
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Lý do từ chối tối đa 255 ký tự' })
  lyDoTuChoi?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối (alias reason)',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Lý do từ chối tối đa 255 ký tự' })
  reason?: string;

  getRejectionReason(): string {
    const raw = this.lyDoTuChoi || this.reason || this.note || '';
    return raw.trim();
  }
}
