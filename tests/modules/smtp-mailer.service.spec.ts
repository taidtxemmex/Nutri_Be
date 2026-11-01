import * as nodemailer from 'nodemailer';
import { SmtpMailerService } from '../../src/core/queue/smtp-mailer.service';

jest.mock('nodemailer');

describe('SmtpMailerService Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_PORT;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;
    delete process.env.MAIL_FROM;
    delete process.env.MAIL_SECURE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Unconfigured / Fallback Mode (Local Dev / Jest)', () => {
    it('should fallback smoothly to in-memory mode when MAIL_USER and MAIL_PASS are not provided', async () => {
      const service = new SmtpMailerService();

      expect(service.isConfigured()).toBe(false);
      expect(await service.verifyConnection()).toBe(false);

      await service.sendMail({
        to: 'patient@nutri.vn',
        subject: 'Xác thực tài khoản',
        body: 'Mã xác thực của bạn là 123456',
      });

      expect(service.getEmailCount()).toBe(1);
      const sent = service.getSentEmails();
      expect(sent[0].to).toBe('patient@nutri.vn');
      expect(sent[0].subject).toBe('Xác thực tài khoản');
    });

    it('should fallback to in-memory mode when MAIL_PASS is placeholder string', async () => {
      process.env.MAIL_USER = 'service@nutri.vn';
      process.env.MAIL_PASS = 'replace_with_google_app_password_16_chars';

      const service = new SmtpMailerService();

      expect(service.isConfigured()).toBe(false);
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('Configured Mode (Real SMTP Transporter)', () => {
    let mockTransporter: any;

    beforeEach(() => {
      mockTransporter = {
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn().mockResolvedValue({ messageId: '<mock-msg-123@nutri.vn>' }),
      };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    });

    it('should initialize nodemailer transporter when valid credentials are provided', async () => {
      process.env.MAIL_HOST = 'smtp.gmail.com';
      process.env.MAIL_PORT = '587';
      process.env.MAIL_USER = 'truenutri@gmail.com';
      process.env.MAIL_PASS = 'real-secret-app-password';
      process.env.MAIL_FROM = 'TrueNutri CSKH <truenutri@gmail.com>';

      const service = new SmtpMailerService();

      expect(service.isConfigured()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'truenutri@gmail.com',
            pass: 'real-secret-app-password',
          },
          pool: true,
        }),
      );

      // Verify connection
      const verified = await service.verifyConnection();
      expect(verified).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();

      // Send mail
      await service.sendMail({
        to: 'user@gmail.com',
        subject: 'Kích hoạt gói dịch vụ VIP',
        html: '<h1>Chào mừng bạn</h1><p>Gói dịch vụ đã sẵn sàng.</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'TrueNutri CSKH <truenutri@gmail.com>',
          to: 'user@gmail.com',
          subject: 'Kích hoạt gói dịch vụ VIP',
          html: '<h1>Chào mừng bạn</h1><p>Gói dịch vụ đã sẵn sàng.</p>',
        }),
      );

      // Also saved in in-memory log
      expect(service.getEmailCount()).toBe(1);
    });

    it('should support SSL port 465 and automatic secure detection', async () => {
      process.env.MAIL_HOST = 'smtp.gmail.com';
      process.env.MAIL_PORT = '465';
      process.env.MAIL_USER = 'truenutri@gmail.com';
      process.env.MAIL_PASS = 'real-secret-app-password';

      const service = new SmtpMailerService();

      expect(service.isConfigured()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        }),
      );
    });

    it('should read from ConfigService if provided', async () => {
      const mockConfigService: any = {
        get: jest.fn((key: string) => {
          const map: Record<string, any> = {
            MAIL_HOST: 'smtp.office365.com',
            MAIL_PORT: 587,
            MAIL_USER: 'support@hospital.vn',
            MAIL_PASS: 'office365-pass',
            MAIL_FROM: 'Bệnh viện Nutri <support@hospital.vn>',
          };
          return map[key];
        }),
      };

      const service = new SmtpMailerService(mockConfigService);

      expect(service.isConfigured()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.office365.com',
          port: 587,
          auth: {
            user: 'support@hospital.vn',
            pass: 'office365-pass',
          },
        }),
      );
    });
  });
});
