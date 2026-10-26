import * as path from 'path';

/**
 * Upload & Storage Configuration Constants (SSOT)
 * Self-contained project directory: public/uploads
 * Zero external path dependency across different VPS or Docker environments.
 */
export const PROJECT_ROOT = process.cwd();
export const DEFAULT_UPLOAD_DIR = path.resolve(PROJECT_ROOT, 'public', 'uploads');

export const UPLOAD_SUBDIRS = {
  EVIDENCE: 'evidence',
  AVATARS: 'avatars',
  TEMP: 'temp',
} as const;

export const EVIDENCE_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.EVIDENCE);
export const AVATAR_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.AVATARS);
export const TEMP_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_DIR, UPLOAD_SUBDIRS.TEMP);

export const STATIC_UPLOAD_PREFIX = '/uploads';

export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;
