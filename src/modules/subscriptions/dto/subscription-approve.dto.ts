import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SubscriptionApproveDto {
  @ApiPropertyOptional({
    example: 'Đã nhận đủ tiền qua ngân hàng',
    description: 'Ghi chú phê duyệt',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lyDoTuChoi?: string;

  @ApiPropertyOptional({
    example: 'Không nhận được tiền vào tài khoản',
    description: 'Lý do từ chối (alias reason)',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;

  getRejectionReason(): string {
    const raw = this.lyDoTuChoi || this.reason || this.note || '';
    return raw.trim();
  }
}
