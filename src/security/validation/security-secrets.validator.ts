import { Logger } from '@nestjs/common';

const logger = new Logger('SecuritySecretsValidator');

const INSECURE_JWT_FALLBACKS = [
  'replace_with_strong_secret_key',
  'truenutri_super_secret_jwt_key_2026_clinical_nutrition_protect_token',
  'secret',
  'jwt_secret',
  '12345678',
  'evidence-secret-key-12345',
];

/**
 * Validate Secrets và Biến môi trường quan trọng ngay khi khởi động ứng dụng (Fail-Fast)
 * Ngăn chặn tuyệt đối việc chạy Production với secret mặc định hoặc bị rò rỉ
 */
export function validateProductionSecrets(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  const dbUrl = process.env.DATABASE_URL;

  // 1. Kiểm tra JWT_SECRET
  if (!jwtSecret) {
    if (isProduction) {
      logger.error('CRITICAL SECURITY VIOLATION: JWT_SECRET environment variable is missing in PRODUCTION!');
      throw new Error('Fatal Security Exception: JWT_SECRET must be explicitly configured in production.');
    } else {
      logger.warn('WARNING: JWT_SECRET is not configured. Development fallback will be used.');
    }
  } else {
    if (jwtSecret.length < 32) {
      if (isProduction) {
        logger.error('CRITICAL SECURITY VIOLATION: JWT_SECRET entropy is too low (< 32 characters)!');
        throw new Error('Fatal Security Exception: JWT_SECRET must be at least 32 characters for adequate entropy.');
      } else {
        logger.warn('WARNING: JWT_SECRET should be at least 32 characters long for cryptographic safety.');
      }
    }

    if (INSECURE_JWT_FALLBACKS.includes(jwtSecret)) {
      if (isProduction) {
        logger.error('CRITICAL SECURITY VIOLATION: Insecure default or known JWT_SECRET detected in PRODUCTION!');
        throw new Error('Fatal Security Exception: Do not use default or placeholder JWT secrets in production.');
      } else {
        logger.warn('WARNING: Known development default JWT_SECRET is currently active.');
      }
    }
  }

  // 2. Kiểm tra DATABASE_URL
  if (!dbUrl) {
    logger.error('CRITICAL ERROR: DATABASE_URL is not set!');
    throw new Error('Fatal Configuration Error: DATABASE_URL environment variable is required.');
  }

  // 3. Thông báo hoàn tất kiểm tra an ninh khởi động
  logger.log(`[Security Audit] Secrets validation completed successfully. Mode: ${isProduction ? 'PRODUCTION (STRICT)' : 'NON-PRODUCTION'}`);
}
