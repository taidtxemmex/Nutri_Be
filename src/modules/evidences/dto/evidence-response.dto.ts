import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvidenceUrlResponseDto {
  @ApiProperty({
    description: 'Đường dẫn xem trước hoặc tải về tài liệu minh chứng (Presigned URL)',
    example: 'http://localhost:8080/uploads/evidence/sample.pdf?token=abc123xyz&expires=1772450000',
  })
  url!: string;
}

export class EvidenceDetailDto {
  @ApiProperty({ description: 'ID minh chứng', example: '1' })
  id!: string;

  @ApiPropertyOptional({ description: 'Tên file gốc', example: 'chung_chi_y_khoa.pdf' })
  originalFileName?: string | null;

  @ApiPropertyOptional({ description: 'MIME type', example: 'application/pdf' })
  mimeType?: string | null;

  @ApiPropertyOptional({ description: 'Dung lượng file (bytes)', example: 1048576 })
  fileSize?: number | null;

  @ApiPropertyOptional({
    description: 'Link ngoài (nếu là đường dẫn URL)',
    example: 'https://example.com/doc.pdf',
  })
  externalLink?: string | null;

  @ApiPropertyOptional({ description: 'Thời điểm tải lên' })
  uploadedAt?: Date | null;

  @ApiPropertyOptional({ description: 'ID người tải lên' })
  uploaderId?: string | null;

  @ApiPropertyOptional({ description: 'Tiêu đề minh chứng', example: 'Chứng chỉ hành nghề' })
  title?: string | null;

  @ApiPropertyOptional({ description: 'Tiêu đề minh chứng (Tiếng Việt)' })
  tieuDe?: string | null;

  @ApiPropertyOptional({ description: 'Loại minh chứng', example: 'CHUNG_CHI' })
  evidenceType?: string | null;

  @ApiPropertyOptional({ description: 'Loại minh chứng (Tiếng Việt)' })
  loaiMinhChung?: string | null;

  @ApiPropertyOptional({ description: 'Ghi chú tài liệu minh chứng' })
  note?: string | null;

  @ApiPropertyOptional({ description: 'Ghi chú (Tiếng Việt)' })
  ghiChu?: string | null;
}
