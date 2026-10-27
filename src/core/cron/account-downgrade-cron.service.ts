import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CACHE_TAG_USERS, buildUserCacheTag } from '../../config/constants/cache.constants';
import { UserRole } from '../../config/enums/role.enum';

@Injectable()
export class AccountDowngradeCronService {
  private readonly logger = new Logger(AccountDowngradeCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Cron chạy định kỳ mỗi đêm lúc 00:00 (hoặc mỗi giờ)
   * Quét và tự động hạ cấp tài khoản PRO hết hạn, đồng thời dọn dẹp các token hết hạn
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAccountDowngradeCron(): Promise<void> {
    this.logger.log('Bắt đầu cron job quét hạ cấp tài khoản PRO hết hạn...');
    try {
      await this.downgradeExpiredAccounts();
    } catch (err: any) {
      this.logger.error(`Lỗi khi quét hạ cấp tài khoản: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Cron chạy lúc 02:00 hàng ngày: Dọn dẹp token xác thực và đăng ký chờ quá hạn
   */
  @Cron('0 2 * * *')
  async handleCleanupTokensCron(): Promise<void> {
    this.logger.log('Bắt đầu cron job dọn dẹp token hết hạn lúc 02:00...');
    try {
      await this.cleanupExpiredTokens();
    } catch (err: any) {
      this.logger.error(`Lỗi khi dọn dẹp token hết hạn: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Quét và tự động hạ cấp các tài khoản USERPRO có pro_expired_at < NOW()
   * 1. UPDATE nguoi_dung SET vai_tro = 'USER' WHERE vai_tro = 'USERPRO' AND pro_expired_at < NOW()
   * 2. Cập nhật trạng thái trong dang_ky thành 'HET_HAN'
   * 3. Invalidate cache 'users' và các tag 'user:${id}' tương ứng
   */
  async downgradeExpiredAccounts(referenceDate: Date = new Date()): Promise<{
    downgradedCount: number;
    updatedRegistrations: number;
    downgradedUserIds: string[];
  }> {
    const now = referenceDate;

    // 1. Tìm các tài khoản USERPRO đã hết hạn
    const expiredUsers = await this.prisma.nguoi_dung.findMany({
      where: {
        vai_tro: UserRole.USERPRO,
        pro_expired_at: {
          lt: now,
        },
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (expiredUsers.length === 0) {
      this.logger.log('Không có tài khoản USERPRO nào hết hạn cần hạ cấp.');
      return {
        downgradedCount: 0,
        updatedRegistrations: 0,
        downgradedUserIds: [],
      };
    }

    const userIds = expiredUsers.map((u) => u.id);

    // 2. Cập nhật bảng nguoi_dung: vai_tro = 'USER'
    const updateResult = await this.prisma.nguoi_dung.updateMany({
      where: {
        id: { in: userIds },
        vai_tro: UserRole.USERPRO,
        pro_expired_at: { lt: now },
      },
      data: {
        vai_tro: UserRole.USER,
      },
    });

    // 3. Cập nhật trạng thái trong dang_ky thành 'HET_HAN'
    const updateDangKyResult = await this.prisma.dang_ky.updateMany({
      where: {
        OR: [
          { nguoi_dung_id: { in: userIds }, trang_thai: { not: 'HET_HAN' } },
          { ngay_ket_thuc: { lt: now }, trang_thai: { not: 'HET_HAN' } },
        ],
      },
      data: {
        trang_thai: 'HET_HAN',
      },
    });

    // 4. Invalidate cache
    if (this.cacheService) {
      const tagsToInvalidate = [
        CACHE_TAG_USERS,
        ...userIds.map((id) => buildUserCacheTag(id)),
      ];
      await this.cacheService.invalidateTags(tagsToInvalidate);
    }

    this.logger.log(
      `Đã hạ cấp thành công ${updateResult.count} tài khoản USERPRO về USER, cập nhật ${updateDangKyResult.count} bản ghi dang_ky sang HET_HAN.`,
    );

    return {
      downgradedCount: updateResult.count,
      updatedRegistrations: updateDangKyResult.count,
      downgradedUserIds: userIds,
    };
  }

  /**
   * Quét và dọn dẹp các token hết hạn:
   * 1. ma_xac_thuc có ngay_het_han < NOW()
   * 2. dang_ky_cho_xac_thuc có expires_at < NOW()
   */
  async cleanupExpiredTokens(referenceDate: Date = new Date()): Promise<{
    deletedAuthTokens: number;
    deletedPendingRegistrations: number;
  }> {
    const now = referenceDate;

    // 1. Xóa ma_xac_thuc hết hạn
    const deleteAuthTokensResult = await this.prisma.ma_xac_thuc.deleteMany({
      where: {
        ngay_het_han: { lt: now },
      },
    });

    // 2. Xóa dang_ky_cho_xac_thuc hết hạn
    const deletePendingResult = await this.prisma.dang_ky_cho_xac_thuc.deleteMany({
      where: {
        expires_at: { lt: now },
      },
    });

    this.logger.log(
      `Đã dọn dẹp ${deleteAuthTokensResult.count} mã xác thực hết hạn và ${deletePendingResult.count} đăng ký chờ xác thực quá hạn.`,
    );

    return {
      deletedAuthTokens: deleteAuthTokensResult.count,
      deletedPendingRegistrations: deletePendingResult.count,
    };
  }
}
