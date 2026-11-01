import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateEvidenceDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề tài liệu minh chứng',
    example: 'Chứng chỉ hành nghề y tế',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề minh chứng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tiêu đề minh chứng tối đa 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề minh chứng (tieuDe alias)',
    example: 'Chứng chỉ hành nghề y tế',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề minh chứng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tiêu đề minh chứng tối đa 255 ký tự' })
  tieuDe?: string;

  @ApiPropertyOptional({ description: 'Loại minh chứng', example: 'CHUNG_CHI_Y_KHOA' })
  @IsOptional()
  @IsString({ message: 'Loại minh chứng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Loại minh chứng tối đa 100 ký tự' })
  evidenceType?: string;

  @ApiPropertyOptional({
    description: 'Loại minh chứng (loaiMinhChung alias)',
    example: 'CHUNG_CHI_Y_KHOA',
  })
  @IsOptional()
  @IsString({ message: 'Loại minh chứng phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100, { message: 'Loại minh chứng tối đa 100 ký tự' })
  loaiMinhChung?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú tài liệu minh chứng',
    example: 'Tài liệu cấp bởi Sở Y tế',
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(5000, { message: 'Ghi chú tối đa 5000 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú tài liệu minh chứng (ghiChu alias)',
    example: 'Tài liệu cấp bởi Sở Y tế',
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(5000, { message: 'Ghi chú tối đa 5000 ký tự' })
  ghiChu?: string;

  @ApiPropertyOptional({ description: 'Tên file gốc', example: 'chung_chi.pdf' })
  @IsOptional()
  @IsString({ message: 'Tên file gốc phải là chuỗi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(255, { message: 'Tên file gốc tối đa 255 ký tự' })
  originalFileName?: string;

  @ApiPropertyOptional({ description: 'MIME type của file', example: 'application/pdf' })
  @IsOptional()
  @IsString({ message: 'MIME type phải là chuỗi' })
  @MaxLength(255, { message: 'MIME type tối đa 255 ký tự' })
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn liên kết ngoài (nếu có)',
    example: 'https://example.com/chungchi.pdf',
  })
  @IsOptional()
  @IsString({ message: 'Đường dẫn liên kết ngoài phải là chuỗi' })
  @MaxLength(2048, { message: 'Đường dẫn liên kết ngoài tối đa 2048 ký tự' })
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
