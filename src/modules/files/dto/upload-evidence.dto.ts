import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadEvidenceDto {
  @ApiPropertyOptional({
    description: 'ID đề xuất nguyên liệu liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'proposalId tối đa 50 ký tự' })
  proposalId?: string;

  @ApiPropertyOptional({
    description: 'ID yêu cầu thanh toán gói PRO liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'paymentRequestId tối đa 50 ký tự' })
  paymentRequestId?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm về minh chứng y tế hoặc chứng từ',
    example: 'Ảnh chụp kết quả xét nghiệm máu',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
