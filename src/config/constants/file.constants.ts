import * as path from 'path';

/**
 * File & Storage Security Configuration Constants (SSOT)
 * Centralizes all magic bytes, size limits, allowed extensions, and storage directories.
 */
export const FILE_SECURITY_CONFIG = {
  // Dung lượng tối đa
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_DOCUMENT_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_TOTAL_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB

  // Thư mục lưu trữ mặc định
  DEFAULT_VPS_BASE_DIR: '/var/www/uploads',
  DEFAULT_FALLBACK_BASE_DIR: path.resolve(process.cwd(), 'uploads'),

  // Magic Bytes chuẩn bảo mật (Hex signatures)
  MAGIC_BYTES: {
    JPEG: [0xff, 0xd8, 0xff],
    PNG: [0x89, 0x50, 0x4e, 0x47],
    PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
    WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // RIFF
    WEBP_TYPE: [0x57, 0x45, 0x42, 0x50], // WEBP at offset 8
    GIF: [0x47, 0x49, 0x46, 0x38], // GIF8
  },

  // Danh mục định dạng cho phép
  ALLOWED_IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,

  ALLOWED_DOCUMENT_MIME_TYPES: ['application/pdf'] as const,

  ALLOWED_EXTENSIONS: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
  } as Record<string, string[]>,

  // Token HMAC hết hạn mặc định (giây)
  HMAC_TOKEN_EXPIRATION_SECONDS: 10 * 60, // 10 phút
} as const;

export type AllowedMimeType =
  | (typeof FILE_SECURITY_CONFIG.ALLOWED_IMAGE_MIME_TYPES)[number]
  | (typeof FILE_SECURITY_CONFIG.ALLOWED_DOCUMENT_MIME_TYPES)[number];
