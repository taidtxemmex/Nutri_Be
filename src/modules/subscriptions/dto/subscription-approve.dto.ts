import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SubscriptionApproveDto {
  @ApiPropertyOptional({
    example: 'Đã nhận đủ tiền qua ngân hàng',
    description: 'Ghi chú phê duyệt',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.note_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500, { message: 'validation.subscriptions.note_max_500' })
  note?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.reject_reason_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.reject_reason_max_255' })
  lyDoTuChoi?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối (alias reason)',
  })
  @IsOptional()
  @IsString({ message: 'validation.subscriptions.reject_reason_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.subscriptions.reject_reason_max_255' })
  reason?: string;

  getRejectionReason(): string {
    const raw = this.lyDoTuChoi || this.reason || this.note || '';
    return raw.trim();
  }
}
