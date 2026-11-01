import { WinstonLoggerService } from '../../src/core/logger/winston-logger.service';
import {
  LOG_DIR,
  LOG_RETENTION_DAYS,
  LOG_MAX_FILE_SIZE,
  LOG_DATE_PATTERN,
  LOG_FILENAMES,
} from '../../src/config/constants/logger.constants';
import * as fs from 'fs';
import * as path from 'path';

describe('WinstonLoggerService & Daily Rotate File Policy', () => {
  let loggerService: WinstonLoggerService;

  beforeAll(() => {
    loggerService = new WinstonLoggerService();
  });

  it('TC-LOG-01: Cấu hình lưu trữ và xoay vòng log đạt chuẩn yêu cầu', () => {
    expect(LOG_RETENTION_DAYS).toBe('10d'); // Lưu tối đa 10 ngày
    expect(LOG_MAX_FILE_SIZE).toBe('20m'); // Mỗi file tối đa 20MB
    expect(LOG_DATE_PATTERN).toBe('YYYY-MM-DD');
    expect(LOG_FILENAMES.COMBINED).toBe('app-%DATE%.log');
    expect(LOG_FILENAMES.ERROR).toBe('error-%DATE%.log');
  });

  it('TC-LOG-02: Thư mục logs tồn tại trên hệ thống file', () => {
    expect(fs.existsSync(LOG_DIR)).toBe(true);
  });

  it('TC-LOG-03: Ghi nhận log info, warn, debug, error hoạt động trơn tru không ném ngoại lệ', () => {
    expect(() => {
      loggerService.log('Test info log message', 'TestContext');
      loggerService.warn('Test warn log message', 'TestContext');
      loggerService.debug('Test debug log message', 'TestContext');
      loggerService.error('Test error log message', 'ErrorStackTrack', 'TestContext');
    }).not.toThrow();
  });

  it('TC-LOG-04: getWinstonInstance trả về winston logger hợp lệ với 3 transports', () => {
    const instance = loggerService.getWinstonInstance();
    expect(instance).toBeDefined();
    expect(instance.transports.length).toBeGreaterThanOrEqual(3); // Console, CombinedRotate, ErrorRotate
  });
});
