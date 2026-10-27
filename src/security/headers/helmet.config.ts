import helmet, { HelmetOptions } from 'helmet';
import { INestApplication } from '@nestjs/common';

/**
 * Cấu hình bảo mật HTTP Security Headers qua Helmet
 * - Bật X-Content-Type-Options: nosniff (Chống MIME-type sniffing)
 * - Bật X-Frame-Options: SAMEORIGIN (Chống Clickjacking)
 * - Bật Strict-Transport-Security: max-age=31536000; includeSubDomains; preload (HSTS)
 * - Loại bỏ hoàn toàn header X-Powered-By: Express/NestJS
 * - Thiết lập Content Security Policy (CSP) và Referrer-Policy an toàn
 */
export function getHelmetOptions(): HelmetOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Hỗ trợ Swagger UI inline scripts nếu tài liệu API được bật
          "'unsafe-inline'",
        ],
        styleSrc: [
          "'self'",
          // Hỗ trợ Swagger UI inline styling
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://nutri.vn', 'https://ilove.truenutri.vn'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    // Chống Clickjacking
    frameguard: {
      action: 'sameorigin',
    },
    // Chống MIME-sniffing
    noSniff: true,
    // HSTS (HTTP Strict Transport Security) - 1 năm, bao gồm subdomains, sẵn sàng cho Preload list
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Xóa header X-Powered-By
    hidePoweredBy: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // Resource isolation
    crossOriginEmbedderPolicy: false, // Để cho phép tải ảnh đại diện / minh chứng
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
  };
}

/**
 * Áp dụng Helmet và cấu hình xóa header nhạy cảm lên NestJS Application
 */
export function applySecurityHeaders(app: INestApplication): void {
  // 1. Áp dụng Helmet middleware với cấu hình phòng thủ chuyên sâu
  app.use(helmet(getHelmetOptions()));

  // 2. Loại bỏ triệt để header nhận dạng framework ở tầng Express adapter
  try {
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance();
    if (instance && typeof instance.disable === 'function') {
      instance.disable('x-powered-by');
    }
  } catch {
    // Adapter fallback nếu không phải Express thông thường
  }
}
