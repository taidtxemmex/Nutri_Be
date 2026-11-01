import {
  RequestLoggingInterceptor,
  maskSensitivePayload,
} from '../../src/common/interceptors/request-logging.interceptor';
import { of, throwError } from 'rxjs';
import { BadRequestException } from '@nestjs/common';

describe('RequestLoggingInterceptor & Sensitive Payload Masking', () => {
  let interceptor: RequestLoggingInterceptor;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
  });

  describe('maskSensitivePayload', () => {
    it('TC-MASK-01: Che giấu mật khẩu, token, secret trong object payload', () => {
      const rawPayload = {
        username: 'dangtai79',
        email: 'lytruong070999@gmail.com',
        password: 'MySecretPassword123!',
        confirmPassword: 'MySecretPassword123!',
        token: 'eyJh...token...secret',
        refreshToken: 'refresh_secret_key',
        nested: {
          mat_khau: 'matkhau123',
          authorization: 'Bearer 12345',
        },
      };

      const masked = maskSensitivePayload(rawPayload) as any;

      expect(masked.username).toBe('dangtai79');
      expect(masked.email).toBe('lytruong070999@gmail.com');
      expect(masked.password).toBe('***[REDACTED]***');
      expect(masked.confirmPassword).toBe('***[REDACTED]***');
      expect(masked.token).toBe('***[REDACTED]***');
      expect(masked.refreshToken).toBe('***[REDACTED]***');
      expect(masked.nested.mat_khau).toBe('***[REDACTED]***');
      expect(masked.nested.authorization).toBe('***[REDACTED]***');
    });

    it('TC-MASK-02: Cắt ngắn các chuỗi quá dài (Base64 file, text > 500 ký tự)', () => {
      const longString = 'A'.repeat(600);
      const payload = {
        filename: 'avatar.png',
        contentBase64: longString,
      };

      const masked = maskSensitivePayload(payload) as any;

      expect(masked.filename).toBe('avatar.png');
      expect(masked.contentBase64).toContain('TRUNCATED len:600');
    });

    it('TC-MASK-03: Xử lý an toàn mảng và các giá trị null/undefined', () => {
      expect(maskSensitivePayload(null)).toBeNull();
      expect(maskSensitivePayload(undefined)).toBeUndefined();
      expect(maskSensitivePayload('string')).toBe('string');
      expect(maskSensitivePayload(12345)).toBe(12345);

      const arrayPayload = [
        { password: '123', id: 1 },
        { password: '456', id: 2 },
      ];
      const maskedArray = maskSensitivePayload(arrayPayload);
      expect(maskedArray[0].password).toBe('***[REDACTED]***');
      expect(maskedArray[0].id).toBe(1);
    });
  });

  describe('interceptor execution', () => {
    it('TC-INTERCEPT-01: Ghi nhận log request thành công và đính kèm X-Trace-Id', (done) => {
      const mockReq: any = {
        method: 'POST',
        url: '/api/auth/login',
        headers: {},
        body: { username: 'admin', password: 'secretpassword' },
        query: { ref: 'google' },
        user: { id: 'user-uuid-1' },
      };
      const mockRes: any = {
        statusCode: 200,
        setHeader: jest.fn(),
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      };
      const mockHandler = {
        handle: () => of({ success: true }),
      };

      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({ success: true });
          expect(mockReq.traceId).toBeDefined();
          expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-Id', mockReq.traceId);
          done();
        },
      });
    });

    it('TC-INTERCEPT-02: Bắt và ghi nhận log khi request gặp lỗi ngoại lệ (400 Bad Request)', (done) => {
      const mockReq: any = {
        method: 'POST',
        url: '/api/auth/register',
        headers: {},
        body: { username: 'test', password: 'secretpassword' },
        query: {},
      };
      const mockRes: any = {
        statusCode: 400,
        setHeader: jest.fn(),
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      };
      const mockHandler = {
        handle: () => throwError(() => new BadRequestException('Email không hợp lệ')),
      };

      interceptor.intercept(mockContext, mockHandler).subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(mockReq.traceId).toBeDefined();
          done();
        },
      });
    });
  });
});
