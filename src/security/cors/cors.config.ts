import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ForbiddenException, Logger } from '@nestjs/common';

const logger = new Logger('CORS_Security');

/**
 * Danh sách Origin mặc định cho môi trường Production
 */
const DEFAULT_PRODUCTION_ORIGINS = [
  'https://nutri.vn',
  'https://ilove.truenutri.vn',
  'http://165.245.185.11',
  'http://165.245.185.11:80',
  'http://165.245.185.11:3000',
];

/**
 * Danh sách Origin bổ sung cho môi trường Development / Testing
 */
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Tạo cấu hình CORS an toàn cấp Production cho NutriBE
 * - Tuyệt đối không dùng `origin: true` hoặc `origin: '*'`
 * - Whitelist chính xác theo domain
 * - Cấu hình đầy đủ credentials, allowedHeaders, và exposedHeaders
 */
export function createCorsOptions(): CorsOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  // Thu thập cấu hình domain từ biến môi trường
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Tạo tập hợp whitelist không trùng lặp
  const allowedOriginsSet = new Set<string>([...DEFAULT_PRODUCTION_ORIGINS, ...envOrigins]);

  if (!isProduction) {
    DEVELOPMENT_ORIGINS.forEach((o) => allowedOriginsSet.add(o));
  }

  const allowedOrigins = Array.from(allowedOriginsSet);
  logger.log(`[CORS Initialized] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`[CORS Whitelist] Total allowed origins: ${allowedOrigins.length}`);

  return {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Cho phép request nội bộ, CLI, cURL hoặc Postman (không mang header Origin)
      if (!requestOrigin) {
        return callback(null, true);
      }

      // Kiểm tra nguồn gốc request có nằm trong danh sách whitelist
      if (allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }

      // Chặn và ghi log mọi nỗ lực truy cập từ domain không được phép
      logger.warn(`[CORS BLOCKED] Rejected unauthorized origin: ${requestOrigin}`);
      return callback(
        new ForbiddenException(
          `CORS Security Violation: Origin '${requestOrigin}' is not allowed by Nutri Security Policy.`,
        ),
        false,
      );
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-trace-id',
      'x-custom-lang',
      'Cache-Control',
      'Pragma',
      'X-Cache-Version',
    ],
    exposedHeaders: [
      'Content-Disposition', // Cần thiết để Frontend đọc tên file tải về (.xlsx, .pdf, .png)
      'X-Total-Count', // Phục vụ phân trang
      'X-Cache-Version', // Phục vụ đồng bộ cache timestamp
      'X-Trace-Id', // Phục vụ truy vết lỗi hệ thống
      'Retry-After', // Phục vụ thông báo Rate Limiting
    ],
    maxAge: 86400, // Cache kết quả Preflight request trong 24 giờ (giảm tải OPTIONS)
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}
