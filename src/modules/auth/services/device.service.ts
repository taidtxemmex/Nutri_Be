import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

export interface UserAgentParsedInfo {
  browser: string;
  os: string;
  deviceType: 'MOBILE' | 'TABLET' | 'WEB';
  deviceName: string;
}

export interface RecordDeviceParam {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface DeviceRecordSummary {
  id: bigint;
  deviceName?: string | null;
  deviceType?: string | null;
  isActive: boolean;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Phân tích User-Agent thành trình duyệt, hệ điều hành và phân loại thiết bị
   */
  parseUserAgent(userAgent?: string): UserAgentParsedInfo {
    if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
      return {
        browser: 'Không xác định',
        os: 'Không xác định',
        deviceType: 'WEB',
        deviceName: 'Thiết bị không xác định',
      };
    }

    const ua = userAgent.trim();

    // 1. Nhận diện hệ điều hành (OS)
    let os = 'Không xác định';
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6.2/i.test(ua)) os = 'Windows 8';
    else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua)) os = 'iPadOS';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/CrOS/i.test(ua)) os = 'Chrome OS';

    // 2. Nhận diện trình duyệt (Browser)
    let browser = 'Trình duyệt Web';
    if (/Edg(?:e|ios|a)?\/([0-9.]+)/i.test(ua)) browser = 'Microsoft Edge';
    else if (/SamsungBrowser\/([0-9.]+)/i.test(ua)) browser = 'Samsung Internet';
    else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera';
    else if (/(?:Chrome|CriOS)\/([0-9.]+)/i.test(ua)) browser = 'Google Chrome';
    else if (/(?:Firefox|FxiOS)\/([0-9.]+)/i.test(ua)) browser = 'Mozilla Firefox';
    else if (/Version\/([0-9.]+).*Safari/i.test(ua)) browser = 'Apple Safari';
    else if (/PostmanRuntime/i.test(ua)) browser = 'Postman';
    else if (/curl/i.test(ua)) browser = 'cURL';

    // 3. Phân loại loại thiết bị (Mobile / Tablet / Web)
    let deviceType: 'MOBILE' | 'TABLET' | 'WEB' = 'WEB';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
      deviceType = 'TABLET';
    } else if (
      /Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      (/Android/i.test(ua) && /Mobile/i.test(ua))
    ) {
      deviceType = 'MOBILE';
    } else {
      deviceType = 'WEB';
    }

    const deviceName = `${browser} trên ${os}`;

    return {
      browser,
      os,
      deviceType,
      deviceName,
    };
  }

  /**
   * Tạo chuỗi hash SHA-256 duy nhất cho thiết bị dựa trên User-Agent (64 hex characters)
   */
  generateDeviceHash(userAgent?: string): string {
    const raw = (userAgent || 'unknown-device').trim();
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Tạo hoặc cập nhật bản ghi thiết bị đăng nhập (`thiet_bi_dang_nhap`)
   */
  async recordDevice(param: RecordDeviceParam): Promise<DeviceRecordSummary | null> {
    if (!this.prisma || !param.userId) return null;

    try {
      const parsed = this.parseUserAgent(param.userAgent);
      const deviceHash = this.generateDeviceHash(param.userAgent);
      const truncatedUa = param.userAgent ? param.userAgent.substring(0, 500) : null;

      const device = await this.prisma.thiet_bi_dang_nhap.upsert({
        where: {
          nguoi_dung_id_device_hash: {
            nguoi_dung_id: param.userId,
            device_hash: deviceHash,
          },
        },
        create: {
          nguoi_dung_id: param.userId,
          device_hash: deviceHash,
          device_name: parsed.deviceName,
          device_type: parsed.deviceType,
          user_agent: truncatedUa,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        update: {
          device_name: parsed.deviceName,
          device_type: parsed.deviceType,
          user_agent: truncatedUa,
          is_active: true,
          updated_at: new Date(),
        },
        select: {
          id: true,
          device_name: true,
          device_type: true,
          is_active: true,
        },
      });

      return {
        id: device.id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        isActive: device.is_active,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to record login device: ${msg}`);
      return null;
    }
  }

  /**
   * Lấy danh sách thiết bị của một người dùng
   */
  async getUserDevices(userId: string) {
    if (!this.prisma || !userId) return [];
    try {
      return await this.prisma.thiet_bi_dang_nhap.findMany({
        where: { nguoi_dung_id: userId },
        orderBy: { updated_at: 'desc' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to query device list: ${msg}`);
      return [];
    }
  }
}
