import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  template?: string;
  payload?: any;
  sentAt: Date;
}

@Injectable()
export class InMemoryMailerService {
  private readonly logger = new Logger(InMemoryMailerService.name);
  private readonly sentEmails: EmailMessage[] = [];

  async sendMail(mailOptions: {
    to: string;
    subject: string;
    body?: string;
    html?: string;
    template?: string;
    payload?: any;
  }): Promise<void> {
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
