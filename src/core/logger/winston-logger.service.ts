import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as fs from 'fs';
import {
  LOG_DIR,
  LOG_RETENTION_DAYS,
  LOG_MAX_FILE_SIZE,
  LOG_DATE_PATTERN,
  LOG_FILENAMES,
} from '../../config/constants/logger.constants';

/**
 * WinstonLoggerService: Triển khai NestJS LoggerService với Winston Daily Rotate File.
 * - Ghi log xoay vòng theo ngày (Date Pattern: YYYY-MM-DD)
 * - Tự động giới hạn kích thước mỗi file (tối đa 20MB) để chống phình ổ đĩa
 * - Tự động xóa các file log cũ hơn 10 ngày (Max Files: 10d)
 * - Tách riêng file log thông tin (app-YYYY-MM-DD.log) và log lỗi (error-YYYY-MM-DD.log)
 */
@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    // Đảm bảo thư mục logs tồn tại
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    // Format console đẹp mắt với màu sắc và timestamp
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.colorize({ all: false }),
      winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
        const ctx = context ? `[${context}] ` : '';
        const metaStr =
          Object.keys(meta).length > 0 && !meta.isAxiosError
            ? ` ${JSON.stringify(meta)}`
            : '';
        const traceStr = trace ? `\n${trace}` : '';
        return `[Nest] ${process.pid}  - ${timestamp}     ${level.toUpperCase().padEnd(7)} ${ctx}${message}${metaStr}${traceStr}`;
      }),
    );

    // Format file dạng JSON có timestamp chuẩn ISO để dễ dàng parse bằng ELK / Grafana Loki
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    // 1. Transport xoay vòng cho toàn bộ app logs (info, warn, error)
    const combinedRotateTransport = new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: LOG_FILENAMES.COMBINED,
      datePattern: LOG_DATE_PATTERN,
      zippedArchive: false,
      maxSize: LOG_MAX_FILE_SIZE, // 20MB mỗi file
      maxFiles: LOG_RETENTION_DAYS, // Lưu tối đa 10 ngày
      level: 'info',
      format: fileFormat,
    });

    // 2. Transport xoay vòng riêng cho error logs
    const errorRotateTransport = new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: LOG_FILENAMES.ERROR,
      datePattern: LOG_DATE_PATTERN,
      zippedArchive: false,
      maxSize: LOG_MAX_FILE_SIZE, // 20MB mỗi file
      maxFiles: LOG_RETENTION_DAYS, // Lưu tối đa 10 ngày
      level: 'error',
      format: fileFormat,
    });

    // 3. Khởi tạo Winston Logger
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        combinedRotateTransport,
        errorRotateTransport,
      ],
      exceptionHandlers: [
        new winston.transports.DailyRotateFile({
          dirname: LOG_DIR,
          filename: LOG_FILENAMES.EXCEPTIONS,
          datePattern: LOG_DATE_PATTERN,
          maxSize: LOG_MAX_FILE_SIZE,
          maxFiles: LOG_RETENTION_DAYS,
          format: fileFormat,
        }),
      ],
    });
  }

  log(message: any, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  warn(message: any, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: any, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: any, context?: string): void {
    this.logger.verbose(message, { context });
  }

  /**
   * Truy xuất trực tiếp instance winston cho các trường hợp cấu hình mở rộng
   */
  getWinstonInstance(): winston.Logger {
    return this.logger;
  }
}
