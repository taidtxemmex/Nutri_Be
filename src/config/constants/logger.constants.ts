import * as path from 'path';

/**
 * Single Source of Truth (SSOT) cho cấu hình Logging (Winston Daily Rotate File)
 * - Tự động xoay vòng log theo ngày
 * - Giới hạn kích thước file (20MB) tránh phình đĩa
 * - Tự động xóa các file log cũ hơn 10 ngày
 */
export const PROJECT_ROOT = process.cwd();
export const LOG_DIR = path.resolve(PROJECT_ROOT, 'logs');

export const LOG_RETENTION_DAYS = '10d'; // Lưu log tối đa 10 ngày
export const LOG_MAX_FILE_SIZE = '20m'; // Mỗi file tối đa 20MB
export const LOG_DATE_PATTERN = 'YYYY-MM-DD';

export const LOG_FILENAMES = {
  COMBINED: 'app-%DATE%.log',
  ERROR: 'error-%DATE%.log',
  EXCEPTIONS: 'exceptions-%DATE%.log',
} as const;
