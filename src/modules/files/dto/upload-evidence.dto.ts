import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadEvidenceDto {
  @ApiPropertyOptional({
    description: 'ID đề xuất nguyên liệu liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  proposalId?: string;

  @ApiPropertyOptional({
    description: 'ID yêu cầu thanh toán gói PRO liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  paymentRequestId?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm về minh chứng y tế hoặc chứng từ',
    example: 'Ảnh chụp kết quả xét nghiệm máu',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
