import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from '../../files/services/local-storage.service';
import { GeneratePreviewObjectParamsDto, GenerateDownloadObjectParamsDto } from '../dto';

@Injectable()
export class EvidenceStorageService {
  private readonly logger = new Logger(EvidenceStorageService.name);

  constructor(
    private readonly localStorageService: LocalStorageService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Tạo Mock/Presigned URL xem trước (preview) tài liệu minh chứng
   * Hết hạn sau 10 phút, chống giả mạo bằng chữ ký HMAC
   */
  async generatePreviewUrl({ objectKey }: GeneratePreviewObjectParamsDto): Promise<string> {
    return this.localStorageService.generateSignedUrl({
      objectKey,
      action: 'preview',
      expiresInSeconds: 10 * 60,
    });
  }

  /**
   * Tạo Mock/Presigned URL tải về (download) tài liệu minh chứng
   */
  async generateDownloadUrl({
    objectKey,
    originalFileName,
  }: GenerateDownloadObjectParamsDto): Promise<string> {
    return this.localStorageService.generateSignedUrl({
      objectKey,
      action: 'download',
      expiresInSeconds: 10 * 60,
      originalFileName,
    });
  }
}
