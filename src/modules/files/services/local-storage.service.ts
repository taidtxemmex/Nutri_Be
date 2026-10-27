import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  FILE_SECURITY_CONFIG,
} from '../../../config/constants/file.constants';
import { FileUploadResponseDto } from '../dto/file-upload-response.dto';

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseDir: string;
  private readonly secretKey: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    // 1. Khởi tạo thư mục gốc upload
    const customUploadDir = this.configService.get<string>('UPLOAD_DIR');
    const defaultDir = FILE_SECURITY_CONFIG.DEFAULT_VPS_BASE_DIR;
    const fallbackDir = FILE_SECURITY_CONFIG.DEFAULT_FALLBACK_BASE_DIR;

    let selectedDir = customUploadDir || defaultDir;

    try {
      if (!fs.existsSync(selectedDir)) {
        fs.mkdirSync(selectedDir, { recursive: true });
      }
      // Kiểm tra quyền ghi
      fs.accessSync(selectedDir, fs.constants.W_OK);
      this.baseDir = path.resolve(selectedDir);
      this.logger.log(`📁 LocalStorageService initialized at primary directory: ${this.baseDir}`);
    } catch (err: any) {
      this.logger.warn(
        `Thư mục ${selectedDir} không ghi được (${err.message}). Tự động fallback về: ${fallbackDir}`,
      );
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      this.baseDir = path.resolve(fallbackDir);
      this.logger.log(`📁 LocalStorageService initialized at fallback directory: ${this.baseDir}`);
    }

    // 2. Secret key cho HMAC signature (Tài liệu nhạy cảm / Evidence)
    const hmacSecret = this.configService.get<string>('STORAGE_HMAC_SECRET') || this.configService.get<string>('JWT_SECRET');
    if (!hmacSecret && process.env.NODE_ENV === 'production') {
      throw new Error('Fatal Security Exception: STORAGE_HMAC_SECRET or JWT_SECRET must be configured.');
    }
    this.secretKey = hmacSecret || 'nutri_secure_storage_hmac_secret_key_default_32chars';

    const port = this.configService.get<string>('PORT', '8080');
    this.appUrl = this.configService.get<string>('APP_URL', `http://localhost:${port}`);
  }

  /**
   * Lấy đường dẫn thư mục gốc hiện tại
   */
  public getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Lưu trữ tệp an toàn lên đĩa cứng VPS
   * - Phân cấp thư mục theo năm/tháng: {baseDir}/{year}/{month}/
   * - Sinh tên ngẫu nhiên UUID để chống Path Traversal (CWE-22) và xung đột tên
   */
  public async upload(
    file: Express.Multer.File,
    subDirectory?: string,
  ): Promise<FileUploadResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'FILE_INVALID',
        message: 'Tệp tải lên không hợp lệ hoặc thiếu dữ liệu nhị phân',
      });
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Tạo thư mục phân cấp an toàn
    const relativeSubDir = subDirectory
      ? path.join(subDirectory, year, month)
      : path.join(year, month);
    const targetDir = path.join(this.baseDir, relativeSubDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Lấy phần mở rộng chuẩn hóa
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const safeExt = originalExt || '.bin';

    // Sinh tên file duy nhất bằng UUIDv4
    const fileUuid = crypto.randomUUID();
    const generatedFileName = `${fileUuid}${safeExt}`;
    const fullFilePath = path.join(targetDir, generatedFileName);

    // Ghi buffer trực tiếp vào đĩa cứng
    fs.writeFileSync(fullFilePath, file.buffer);

    // Object key lưu trữ dạng posix (slash /) chuẩn hóa
    const objectKey = path.posix.join(
      relativeSubDir.replace(/\\/g, '/'),
      generatedFileName,
    );

    const detectedMime =
      (file as any).detectedMimeType || file.mimetype || 'application/octet-stream';
    const fileSize = file.buffer.length;

    return {
      objectKey,
      originalFileName: file.originalname || generatedFileName,
      mimeType: detectedMime,
      fileSize,
      url: `/uploads/${objectKey}`,
    };
  }

  /**
   * Tải tệp tin hoặc đọc buffer từ đĩa
   * Phòng thủ chống Path Traversal (CWE-22): Chặn đứng .. và đường dẫn ngoài baseDir
   */
  public async getFile(objectKey: string): Promise<{
    buffer: Buffer;
    filePath: string;
    size: number;
    mimeType?: string;
  }> {
    this.assertSafePath(objectKey);

    const fullPath = path.resolve(this.baseDir, objectKey);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: `Không tìm thấy tập tin yêu cầu: ${objectKey}`,
      });
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      throw new BadRequestException({
        code: 'FILE_INVALID_TARGET',
        message: 'Đường dẫn yêu cầu không phải là một tập tin thông thường',
      });
    }

    const buffer = fs.readFileSync(fullPath);

    return {
      buffer,
      filePath: fullPath,
      size: stat.size,
    };
  }

  /**
   * Tạo stream đọc tệp tin theo nhu cầu
   */
  public createReadStream(objectKey: string): fs.ReadStream {
    this.assertSafePath(objectKey);
    const fullPath = path.resolve(this.baseDir, objectKey);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: `Không tìm thấy tập tin yêu cầu: ${objectKey}`,
      });
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * Xóa tệp an toàn khỏi đĩa cứng
   * Áp dụng phòng thủ Path Traversal nghiêm ngặt
   */
  public async delete(objectKey: string): Promise<boolean> {
    this.assertSafePath(objectKey);

    const fullPath = path.resolve(this.baseDir, objectKey);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }

    return false;
  }

  /**
   * Sinh URL có chữ ký bảo mật HMAC-SHA256 hết hạn trong 10 phút
   * Chống IDOR và truy cập trái phép vào tài liệu nhạy cảm
   */
  public generateSignedUrl(
    objectKey: string,
    action: 'preview' | 'download' = 'preview',
    expiresInSeconds = FILE_SECURITY_CONFIG.HMAC_TOKEN_EXPIRATION_SECONDS,
    originalFileName?: string,
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = this.createHmacSignature(objectKey, expiresAt, action);

    const queryParams = new URLSearchParams({
      objectKey,
      token,
      expires: expiresAt.toString(),
      action,
    });

    if (originalFileName) {
      queryParams.set('filename', originalFileName);
    }

    return `${this.appUrl}/api/v1/files/${action}?${queryParams.toString()}`;
  }

  /**
   * Xác thực tính toàn vẹn và thời hạn của token chữ ký HMAC
   * Phòng thủ chống Timing Attack bằng crypto.timingSafeEqual
   */
  public verifySignedUrl(
    objectKey: string,
    token: string,
    expires: number,
    action: string,
  ): boolean {
    if (!objectKey || !token || !expires || !action) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > expires) {
      return false; // Hết hạn
    }

    const expectedToken = this.createHmacSignature(objectKey, expires, action);

    const tokenBuf = Buffer.from(token, 'utf-8');
    const expectedBuf = Buffer.from(expectedToken, 'utf-8');

    if (tokenBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  /**
   * Tạo HMAC Signature SHA-256
   */
  public createHmacSignature(
    objectKey: string,
    expiresAt: number,
    action: string,
  ): string {
    const data = `${objectKey}:${expiresAt}:${action}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(data)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Kiểm tra nghiêm ngặt phòng thủ Path Traversal (CWE-22)
   */
  public assertSafePath(objectKey: string): void {
    if (!objectKey || typeof objectKey !== 'string') {
      throw new BadRequestException({
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Đường dẫn tệp tin không hợp lệ hoặc bị để trống',
      });
    }

    // 1. Chặn đứng Null Byte Injection (%00, \0)
    if (objectKey.includes('\0') || objectKey.includes('%00')) {
      throw new BadRequestException({
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Phát hiện tấn công Null Byte Injection trong đường dẫn tệp!',
      });
    }

    // 2. Chặn đứng các chuỗi điều hướng thư mục .. (cả URL-encoded)
    const decodedKey = decodeURIComponent(objectKey);
    if (
      objectKey.includes('..') ||
      decodedKey.includes('..') ||
      objectKey.includes('\\..') ||
      objectKey.includes('/..')
    ) {
      throw new BadRequestException({
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Phát hiện tấn công Path Traversal! Nghiêm cấm ký tự điều hướng thư mục (..)',
      });
    }

    // 3. Phân giải đường dẫn chính tắc và kiểm tra xem có vượt ra ngoài baseDir không
    const normalizedBase = path.resolve(this.baseDir);
    const resolvedPath = path.resolve(this.baseDir, objectKey);

    if (
      !resolvedPath.startsWith(normalizedBase + path.sep) &&
      resolvedPath !== normalizedBase
    ) {
      throw new BadRequestException({
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Phát hiện tấn công Path Traversal! Đường dẫn vượt khỏi phạm vi thư mục lưu trữ cho phép.',
      });
    }
  }
}
