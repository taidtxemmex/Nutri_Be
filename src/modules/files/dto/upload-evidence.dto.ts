import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadEvidenceDto {
  @ApiPropertyOptional({
    description: 'ID đề xuất nguyên liệu liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString({ message: 'validation.files.proposal_id_string' })
  @MaxLength(50, { message: 'validation.files.proposal_id_max' })
  proposalId?: string;

  @ApiPropertyOptional({
    description: 'ID yêu cầu thanh toán gói PRO liên kết (nếu có)',
    example: '1',
  })
  @IsOptional()
  @IsString({ message: 'validation.files.payment_request_id_string' })
  @MaxLength(50, { message: 'validation.files.payment_request_id_max' })
  paymentRequestId?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm về minh chứng y tế hoặc chứng từ',
    example: 'Ảnh chụp kết quả xét nghiệm máu',
  })
  @IsOptional()
  @IsString({ message: 'validation.files.note_string' })
  @MaxLength(500, { message: 'validation.files.note_max' })
  note?: string;
}
