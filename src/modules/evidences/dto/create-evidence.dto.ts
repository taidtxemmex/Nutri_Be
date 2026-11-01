import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEvidenceDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề tài liệu minh chứng',
    example: 'Chứng chỉ hành nghề y tế',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.title_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.evidences.title_max_255' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề minh chứng (tieuDe alias)',
    example: 'Chứng chỉ hành nghề y tế',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.title_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.evidences.title_max_255' })
  tieuDe?: string;

  @ApiPropertyOptional({ description: 'Loại minh chứng', example: 'CHUNG_CHI_Y_KHOA' })
  @IsOptional()
  @IsString({ message: 'validation.evidences.type_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.evidences.type_max_100' })
  evidenceType?: string;

  @ApiPropertyOptional({
    description: 'Loại minh chứng (loaiMinhChung alias)',
    example: 'CHUNG_CHI_Y_KHOA',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.type_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'validation.evidences.type_max_100' })
  loaiMinhChung?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú tài liệu minh chứng',
    example: 'Tài liệu cấp bởi Sở Y tế',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.note_string' })
  @MaxLength(5000, { message: 'validation.evidences.note_max_5000' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú tài liệu minh chứng (ghiChu alias)',
    example: 'Tài liệu cấp bởi Sở Y tế',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.note_string' })
  @MaxLength(5000, { message: 'validation.evidences.note_max_5000' })
  ghiChu?: string;

  @ApiPropertyOptional({ description: 'Tên file gốc', example: 'chung_chi.pdf' })
  @IsOptional()
  @IsString({ message: 'validation.evidences.original_filename_string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'validation.evidences.original_filename_max_255' })
  originalFileName?: string;

  @ApiPropertyOptional({ description: 'MIME type của file', example: 'application/pdf' })
  @IsOptional()
  @IsString({ message: 'validation.evidences.mime_type_string' })
  @MaxLength(255, { message: 'validation.evidences.mime_type_max_255' })
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn liên kết ngoài (nếu có)',
    example: 'https://example.com/chungchi.pdf',
  })
  @IsOptional()
  @IsString({ message: 'validation.evidences.external_link_string' })
  @MaxLength(2048, { message: 'validation.evidences.external_link_max_2048' })
  externalLink?: string;

  getTitle(): string {
    const raw = this.title || this.tieuDe || '';
    return raw.trim();
  }

  getEvidenceType(): string {
    const raw = this.evidenceType || this.loaiMinhChung || '';
    return raw.trim();
  }

  getNote(): string {
    const raw = this.note || this.ghiChu || '';
    return raw.trim();
  }
}
