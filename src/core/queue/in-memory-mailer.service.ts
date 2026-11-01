import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  template?: string;
  payload?: any;
  sentAt: Date;
  from?: string;
}

export interface MailOptions {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  template?: string;
  payload?: any;
  from?: string;
}

export interface MailerService {
  sendMail(mailOptions: MailOptions): Promise<void>;
}

export const MAILER_SERVICE_TOKEN = 'MailerService';

@Injectable()
export class InMemoryMailerService implements MailerService {
  private readonly logger = new Logger(InMemoryMailerService.name);
  private readonly sentEmails: EmailMessage[] = [];

  async sendMail(mailOptions: MailOptions): Promise<void> {
    const email: EmailMessage = {
      to: mailOptions.to,
      subject: mailOptions.subject,
      body: mailOptions.body,
      html: mailOptions.html,
      template: mailOptions.template,
      payload: mailOptions.payload,
      sentAt: new Date(),
    };

    this.sentEmails.push(email);
    this.logger.log(`[InMemoryMailer] Đã gửi email tới: ${email.to} - Tiêu đề: ${email.subject}`);
  }

  getSentEmails(): EmailMessage[] {
    return [...this.sentEmails];
  }

  getEmailCount(): number {
    return this.sentEmails.length;
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
