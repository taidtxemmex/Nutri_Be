import { PipeTransform, Injectable, Optional, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { FILE_SECURITY_CONFIG, AllowedMimeType } from '../../../config/constants/file.constants';

export interface FileMagicBytePipeOptions {
  allowImages?: boolean;
  allowDocuments?: boolean;
}

export interface DetectedFileType {
  mime: AllowedMimeType;
  ext: string;
}

@Injectable()
export class FileMagicBytePipe implements PipeTransform<
  Express.Multer.File | Express.Multer.File[],
  Promise<Express.Multer.File | Express.Multer.File[]>
> {
  private readonly options: Required<FileMagicBytePipeOptions>;

  constructor(@Optional() options?: FileMagicBytePipeOptions) {
    this.options = {
      allowImages: options?.allowImages ?? true,
      allowDocuments: options?.allowDocuments ?? true,
    };
  }

  async transform(
    value: Express.Multer.File | Express.Multer.File[],
  ): Promise<Express.Multer.File | Express.Multer.File[]> {
    if (!value) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn tệp tin để tải lên',
      });
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new BadRequestException({
          code: 'FILE_REQUIRED',
          message: 'Danh sách tệp tải lên trống',
        });
      }
      return Promise.all(value.map((file) => this.validateFile(file)));
    }

    return this.validateFile(value);
  }

  /**
   * Xác thực độc lập từng tệp tin
   */
  public async validateFile(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException({
        code: 'FILE_INVALID',
        message: 'Dữ liệu tệp không hợp lệ hoặc thiếu nội dung nhị phân (Buffer)',
      });
    }

    const buffer = file.buffer;

    // 1. Kiểm tra kích thước tối thiểu
    if (buffer.length < 4) {
      throw new BadRequestException({
        code: 'FILE_CORRUPTED',
        message: 'Tệp tải lên bị hỏng hoặc kích thước quá nhỏ (< 4 bytes)',
      });
    }

    // 2. Nhận diện định dạng tệp qua Magic Bytes thực sự
    const detected = this.detectMagicBytes(buffer);
    if (!detected) {
      throw new BadRequestException({
        code: 'FILE_INVALID_MAGIC_BYTES',
        message:
          'Mã nhận dạng tệp (Magic Bytes) không hợp lệ hoặc định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, GIF hoặc PDF.',
      });
    }

    // 3. Kiểm tra phạm vi cho phép theo cấu hình
    const isImage = detected.mime.startsWith('image/');
    const isDoc = detected.mime === 'application/pdf';

    if (isImage && !this.options.allowImages) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'Định dạng hình ảnh không được phép trong ngữ cảnh này.',
      });
    }

    if (isDoc && !this.options.allowDocuments) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'Định dạng tài liệu không được phép trong ngữ cảnh này.',
      });
    }

    // 4. Phòng thủ chiều sâu: Chặn Polyglot / Web Shell Injection
    this.assertNoMaliciousPayload(buffer);

    // 5. Kiểm tra tính tương thích giữa phần mở rộng và Magic Bytes (Chống MIME Spoofing)
    const originalName = file.originalname || '';
    const rawExt = path.extname(originalName).toLowerCase();
    const allowedExts = FILE_SECURITY_CONFIG.ALLOWED_EXTENSIONS[detected.mime];

    if (!rawExt || !allowedExts || !allowedExts.includes(rawExt)) {
      throw new BadRequestException({
        code: 'FILE_EXTENSION_MISMATCH',
        message: `Phát hiện giả mạo phần mở rộng (MIME Spoofing)! Đuôi tệp "${rawExt}" không khớp với định dạng tệp thực tế (${detected.mime}).`,
      });
    }

    // 6. Kiểm tra giới hạn dung lượng nghiêm ngặt theo loại tệp
    if (isImage && buffer.length > FILE_SECURITY_CONFIG.MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Dung lượng hình ảnh vượt quá giới hạn tối đa cho phép (5MB)',
      });
    }

    if (isDoc && buffer.length > FILE_SECURITY_CONFIG.MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Dung lượng tài liệu PDF vượt quá giới hạn tối đa cho phép (10MB)',
      });
    }

    // 7. Chuẩn hóa và ghi đè MIME Type thực sự (Không tin tưởng header client)
    file.mimetype = detected.mime;
    (file as any).detectedMimeType = detected.mime;
    (file as any).detectedExtension = rawExt;

    return file;
  }

  /**
   * Quét và nhận dạng chữ ký nhị phân Magic Bytes
   */
  public detectMagicBytes(buffer: Buffer): DetectedFileType | null {
    const mb = FILE_SECURITY_CONFIG.MAGIC_BYTES;

    // JPEG: FF D8 FF
    if (buffer[0] === mb.JPEG[0] && buffer[1] === mb.JPEG[1] && buffer[2] === mb.JPEG[2]) {
      return { mime: 'image/jpeg', ext: '.jpg' };
    }

    // PNG: 89 50 4E 47
    if (
      buffer[0] === mb.PNG[0] &&
      buffer[1] === mb.PNG[1] &&
      buffer[2] === mb.PNG[2] &&
      buffer[3] === mb.PNG[3]
    ) {
      return { mime: 'image/png', ext: '.png' };
    }

    // PDF: 25 50 44 46 (%PDF)
    if (
      buffer[0] === mb.PDF[0] &&
      buffer[1] === mb.PDF[1] &&
      buffer[2] === mb.PDF[2] &&
      buffer[3] === mb.PDF[3]
    ) {
      return { mime: 'application/pdf', ext: '.pdf' };
    }

    // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
    if (
      buffer.length >= 12 &&
      buffer[0] === mb.WEBP_RIFF[0] &&
      buffer[1] === mb.WEBP_RIFF[1] &&
      buffer[2] === mb.WEBP_RIFF[2] &&
      buffer[3] === mb.WEBP_RIFF[3] &&
      buffer[8] === mb.WEBP_TYPE[0] &&
      buffer[9] === mb.WEBP_TYPE[1] &&
      buffer[10] === mb.WEBP_TYPE[2] &&
      buffer[11] === mb.WEBP_TYPE[3]
    ) {
      return { mime: 'image/webp', ext: '.webp' };
    }

    // GIF: 47 49 46 38 (GIF8)
    if (
      buffer[0] === mb.GIF[0] &&
      buffer[1] === mb.GIF[1] &&
      buffer[2] === mb.GIF[2] &&
      buffer[3] === mb.GIF[3]
    ) {
      return { mime: 'image/gif', ext: '.gif' };
    }

    return null;
  }

  /**
   * Phát hiện chuỗi mã thực thi / shell script / XSS nhúng trong buffer
   */
  private assertNoMaliciousPayload(buffer: Buffer): void {
    // Quét 4096 bytes đầu và 4096 bytes cuối của buffer
    const headLength = Math.min(buffer.length, 4096);
    const headText = buffer.subarray(0, headLength).toString('binary').toLowerCase();

    const dangerousPatterns = [
      '<?php',
      '<?=',
      'eval(',
      '<script',
      'javascript:',
      'cmd.exe',
      '/bin/sh',
      '/bin/bash',
      '__halt_compiler()',
    ];

    for (const pattern of dangerousPatterns) {
      if (headText.includes(pattern)) {
        throw new BadRequestException({
          code: 'FILE_MALICIOUS_PAYLOAD',
          message: `Phát hiện payload mã thực thi độc hại "${pattern}" nhúng trong tệp tin!`,
        });
      }
    }

    if (buffer.length > 4096) {
      const tailLength = Math.min(buffer.length - 4096, 4096);
      const tailText = buffer
        .subarray(buffer.length - tailLength)
        .toString('binary')
        .toLowerCase();
      for (const pattern of dangerousPatterns) {
        if (tailText.includes(pattern)) {
          throw new BadRequestException({
            code: 'FILE_MALICIOUS_PAYLOAD',
            message: `Phát hiện payload mã thực thi độc hại "${pattern}" nhúng ở phần đuôi tệp tin!`,
          });
        }
      }
    }
  }
}
