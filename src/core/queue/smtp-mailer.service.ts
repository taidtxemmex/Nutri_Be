import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { InMemoryMailerService, MailOptions, MailerService } from './in-memory-mailer.service';

/**
 * SmtpMailerService: Cấu hình Nodemailer SMTP Transporter thực tế với connection pool.
 * Tự động đọc các biến môi trường: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, MAIL_SECURE.
 * Nếu cấu hình SMTP đầy đủ, gửi email thật qua SMTP server (Gmail, SES, SendGrid, custom SMTP).
 * Nếu biến môi trường chưa cấu hình hoặc trống, tự động fallback mượt mà sang InMemoryMailerService
 * để không làm gián đoạn môi trường local dev hoặc test suite Jest.
 */
@Injectable()
export class SmtpMailerService extends InMemoryMailerService implements MailerService {
  private readonly smtpLogger = new Logger(SmtpMailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly defaultFrom: string;
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    super();

    // 1. Đọc các biến cấu hình từ ConfigService hoặc process.env
    this.host = this.getEnv('MAIL_HOST') || 'smtp.gmail.com';

    const rawPort = this.getEnv('MAIL_PORT');
    this.port = rawPort ? Number(rawPort) : 587;

    const rawSecure = this.getEnv('MAIL_SECURE');
    this.secure =
      rawSecure !== undefined && rawSecure !== ''
        ? String(rawSecure).toLowerCase() === 'true'
        : this.port === 465;

    this.user = this.getEnv('MAIL_USER') || '';
    const pass = this.getEnv('MAIL_PASS') || '';

    // Cấu hình MAIL_FROM: ưu tiên MAIL_FROM, sau đó đến kết hợp MAIL_FROM_NAME + MAIL_FROM_ADDRESS
    const rawFrom = this.getEnv('MAIL_FROM');
    const fromName = this.getEnv('MAIL_FROM_NAME') || 'TrueNutri CSKH';
    const fromAddress = this.getEnv('MAIL_FROM_ADDRESS') || this.user || 'no-reply@nutri.vn';

    if (rawFrom && rawFrom.trim() !== '') {
      this.defaultFrom = rawFrom.trim();
    } else {
      this.defaultFrom = `"${fromName}" <${fromAddress}>`;
    }

    // 2. Kiểm tra nếu có thông tin đăng nhập SMTP hợp lệ
    const isPlaceholderPass =
      pass === 'replace_with_google_app_password_16_chars' || pass.startsWith('replace_with_');

    if (this.user && pass && !isPlaceholderPass) {
      try {
        const rejectUnauthorized = this.getEnv('MAIL_REJECT_UNAUTHORIZED') !== 'false';

        this.transporter = nodemailer.createTransport({
          host: this.host,
          port: this.port,
          secure: this.secure,
          auth: {
            user: this.user,
            pass: pass,
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateLimit: 10, // 10 emails/giây chống tràn SMTP
          connectionTimeout: 10_000, // 10s kết nối TCP fail-fast
          greetingTimeout: 10_000, // 10s chờ chào SMTP (220)
          socketTimeout: 15_000, // 15s ngắt socket nếu không có dữ liệu để chống treo worker
          tls: {
            rejectUnauthorized,
          },
        });

        this.smtpLogger.log(
          `[SmtpMailerService] ✅ Nodemailer SMTP Transporter đã được khởi tạo thành công (${this.host}:${this.port}, secure: ${this.secure}, user: ${this.user}).`,
        );
      } catch (error: unknown) {
        this.smtpLogger.error(
          `[SmtpMailerService] ❌ Lỗi khi khởi tạo Nodemailer Transporter: ${(error as Error)?.message}. Fallback sang InMemoryMailerService.`,
        );
        this.transporter = null;
      }
    } else {
      this.smtpLogger.warn(
        `[SmtpMailerService] ⚠️ Cấu hình SMTP (MAIL_USER, MAIL_PASS) chưa được thiết lập hoặc còn ở dạng mẫu. Tự động fallback sang InMemoryMailerService (không gửi mail thật).`,
      );
      this.transporter = null;
    }
  }

  /**
   * Helper đọc biến môi trường từ ConfigService (nếu có) hoặc process.env
   */
  private getEnv(key: string): string | undefined {
    if (this.configService) {
      const val = this.configService.get<string | number>(key);
      if (val !== undefined && val !== null) {
        return String(val);
      }
    }
    return process.env[key];
  }

  /**
   * Kiểm tra xem SMTP Transporter thực tế có đang hoạt động hay không
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Kiểm tra kết nối tới SMTP server thực tế (verify socket connection & auth)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.smtpLogger.warn(
        '[SmtpMailerService] Không thể verify connection vì SMTP Transporter chưa được cấu hình.',
      );
      return false;
    }

    try {
      await this.transporter.verify();
      this.smtpLogger.log(
        `[SmtpMailerService] ✅ Kiểm tra kết nối SMTP Server (${this.host}:${this.port}) thành công!`,
      );
      return true;
    } catch (error: unknown) {
      this.smtpLogger.error(
        `[SmtpMailerService] ❌ Kiểm tra kết nối SMTP Server (${this.host}:${this.port}) thất bại: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      return false;
    }
  }

  /**
   * Gửi email: Nếu có cấu hình SMTP thật thì gửi qua nodemailer.
   * Nếu không, fallback mượt mà sang InMemoryMailerService (lưu vào mảng bộ nhớ cho test / auditing).
   */
  async sendMail(mailOptions: MailOptions): Promise<void> {
    // 1. Luôn ghi nhận vào in-memory buffer của lớp cha để phục vụ assertion test suite / audit
    await super.sendMail(mailOptions);

    // 2. Nếu không có SMTP Transporter, dừng tại đây (đã lưu in-memory an toàn)
    if (!this.transporter) {
      this.smtpLogger.debug(
        `[SmtpMailerService] [In-Memory Fallback] Đã ghi nhận email gửi tới: ${mailOptions.to} (Tiêu đề: ${mailOptions.subject})`,
      );
      return;
    }

    // 3. Chuẩn hóa dữ liệu email gửi đi
    const from = mailOptions.from || this.defaultFrom;
    const to = mailOptions.to;
    const subject = mailOptions.subject;

    let html = mailOptions.html;
    let text = mailOptions.body;

    if (!html && text) {
      // Tự động bọc HTML cơ bản từ body plain text
      html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${text.replace(/\n/g, '<br/>')}</div>`;
    }

    if (!text && html) {
      // Tự động trích xuất plain text từ HTML
      text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      this.smtpLogger.log(
        `[SmtpMailerService] ✉️ Đã gửi email SMTP thật thành công tới: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`,
      );
    } catch (error: unknown) {
      this.smtpLogger.error(
        `[SmtpMailerService] ❌ Lỗi khi gửi email SMTP thật tới ${to}: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw error;
    }
  }
}
