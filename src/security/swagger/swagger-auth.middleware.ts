import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const logger = new Logger('SwaggerSecurity');

/**
 * Middleware bảo vệ Swagger OpenAPI Documentation
 * - Cấm tuyệt đối mở public Swagger UI trên môi trường Production
 * - Yêu cầu xác thực HTTP Basic Authentication (RFC 7617)
 * - Sử dụng crypto.timingSafeEqual chống tấn công dò mật khẩu theo độ trễ thời gian (Timing Attack)
 * - Tự động chặn khi NODE_ENV === 'production' trừ khi biến ENABLE_SWAGGER=true được bật chủ đích
 */
export function createSwaggerAuthMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSwaggerEnabled = process.env.ENABLE_SWAGGER === 'true';

  // Thông tin xác thực Basic Auth lấy từ biến môi trường
  const requiredUser = process.env.SWAGGER_USER || 'nutri_admin';
  const requiredPass = process.env.SWAGGER_PASSWORD || 'NutriDoc@Secured2026';

  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Nếu ở Production và không có cờ ENABLE_SWAGGER=true -> Chặn hoàn toàn (404 Not Found)
    if (isProduction && !isSwaggerEnabled) {
      logger.warn(
        `[Swagger Blocked] Public access to Swagger docs blocked in production from IP: ${req.ip} | URL: ${req.originalUrl}`,
      );
      res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Tài liệu API không được công khai trên môi trường Production.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          traceId: (req.headers['x-trace-id'] as string) || 'trace-unknown',
        },
      });
      return;
    }

    // 2. Kiểm tra header Authorization
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Nutri Clinical Nutrition API Documentation"');
      res.status(401).json({
        error: {
          code: 'SWAGGER_AUTH_REQUIRED',
          message: 'Yêu cầu xác thực Basic Authentication để truy cập tài liệu Swagger.',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 3. Giải mã và so khớp thông tin đăng nhập
    try {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const colonIndex = credentials.indexOf(':');

      if (colonIndex === -1) {
        throw new Error('Invalid credentials format');
      }

      const user = credentials.substring(0, colonIndex);
      const pass = credentials.substring(colonIndex + 1);

      // So sánh an toàn chống timing attack (Crypto Timing Safe Equal)
      const userBuffer = Buffer.from(user);
      const expectedUserBuffer = Buffer.from(requiredUser);
      const passBuffer = Buffer.from(pass);
      const expectedPassBuffer = Buffer.from(requiredPass);

      const isUserMatch =
        userBuffer.length === expectedUserBuffer.length &&
        crypto.timingSafeEqual(userBuffer, expectedUserBuffer);

      const isPassMatch =
        passBuffer.length === expectedPassBuffer.length &&
        crypto.timingSafeEqual(passBuffer, expectedPassBuffer);

      if (isUserMatch && isPassMatch) {
        return next();
      }
    } catch {
      // Bắt các lỗi định dạng Base64
    }

    // Xác thực thất bại
    logger.warn(`[Swagger Auth Failed] Invalid Basic Auth credentials from IP: ${req.ip}`);
    res.setHeader('WWW-Authenticate', 'Basic realm="Nutri Clinical Nutrition API Documentation"');
    res.status(401).json({
      error: {
        code: 'SWAGGER_INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu tài liệu API không chính xác.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  };
}
