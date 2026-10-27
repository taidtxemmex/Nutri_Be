import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EvidenceStorageService {
  private readonly logger = new Logger(EvidenceStorageService.name);
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing for Evidence Storage HMAC!');
    }
    this.secretKey = secret || 'dev_temporary_evidence_secret_hmac_key_12345';
    const port = this.configService.get<string>('PORT', '8080');
    this.baseUrl = this.configService.get<string>('APP_URL', `http://localhost:${port}`);
  }

  /**
   * Tạo Mock/Presigned URL xem trước (preview) tài liệu minh chứng
   * Hết hạn sau 10 phút, chống giả mạo bằng chữ ký HMAC
   */
  async generatePreviewUrl(objectKey: string): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes
    const token = this.createHmacSignature(objectKey, expiresAt, 'preview');

    return `${this.baseUrl}/uploads/evidence/${encodeURIComponent(objectKey)}?token=${token}&expires=${expiresAt}&action=preview`;
  }

  /**
   * Tạo Mock/Presigned URL tải về (download) tài liệu minh chứng
   */
  async generateDownloadUrl(objectKey: string, originalFileName?: string): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes
    const token = this.createHmacSignature(objectKey, expiresAt, 'download');
    const fileNameParam = originalFileName
      ? `&filename=${encodeURIComponent(originalFileName)}`
      : '';

    return `${this.baseUrl}/uploads/evidence/${encodeURIComponent(objectKey)}?token=${token}&expires=${expiresAt}&action=download${fileNameParam}`;
  }

  private createHmacSignature(objectKey: string, expiresAt: number, action: string): string {
    const data = `${objectKey}:${expiresAt}:${action}`;
    return crypto.createHmac('sha256', this.secretKey).update(data).digest('hex').substring(0, 32);
  }
}
