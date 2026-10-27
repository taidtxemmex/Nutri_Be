import * as path from 'path';
import * as fs from 'fs';

/**
 * Upload & Storage Configuration Constants (SSOT)
 * Self-contained project directory: public/uploads
 * Zero external path dependency across different VPS or Docker environments.
 */
export const PROJECT_ROOT = process.cwd();
export const DEFAULT_UPLOAD_DIR = path.resolve(PROJECT_ROOT, 'public', 'uploads');

export const UPLOAD_SCOPES = {
  PUBLIC: 'public',
  PROTECTED: 'protected',
  TEMP: 'temp',
} as const;

export const UPLOAD_SUBDIRS = {
  // 1. TÀI NGUYÊN CÔNG KHAI (Static Asset Serving qua /uploads/public/*)
  AVATARS: 'public/avatars',
  TEMPLATES: 'public/templates',

  // 2. TÀI NGUYÊN BẢO MẬT (CHẶN STATIC, chỉ truy xuất qua Auth Guard / Signed HMAC URL)
  CERTIFICATES: 'protected/certificates',
  EVIDENCE: 'protected/evidence',
  MEDICAL_RECORDS: 'protected/medical-records',
  PAYMENTS: 'protected/payments',

  // 3. TẠM THỜI (Streaming, Import/Export, Batch Processing)
  TEMP: 'temp',
} as const;

export const PUBLIC_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SCOPES.PUBLIC);
export const PROTECTED_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SCOPES.PROTECTED);

export const AVATAR_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.AVATARS);
export const TEMPLATE_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.TEMPLATES);
export const CERTIFICATE_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.CERTIFICATES);
export const EVIDENCE_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.EVIDENCE);
export const MEDICAL_RECORD_UPLOAD_DIR = path.join(
  DEFAULT_UPLOAD_DIR,
  UPLOAD_SUBDIRS.MEDICAL_RECORDS,
);
export const PAYMENT_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.PAYMENTS);
export const TEMP_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.TEMP);

export const STATIC_UPLOAD_PREFIX = '/uploads/public';

export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

/**
 * Tự động tạo cây thư mục upload phân cấp đệ quy khi khởi động hệ thống
 */
export function ensureUploadDirsExist(): void {
  const dirs = [
    DEFAULT_UPLOAD_DIR,
    PUBLIC_UPLOAD_DIR,
    PROTECTED_UPLOAD_DIR,
    AVATAR_UPLOAD_DIR,
    TEMPLATE_UPLOAD_DIR,
    CERTIFICATE_UPLOAD_DIR,
    EVIDENCE_UPLOAD_DIR,
    MEDICAL_RECORD_UPLOAD_DIR,
    PAYMENT_UPLOAD_DIR,
    TEMP_UPLOAD_DIR,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
