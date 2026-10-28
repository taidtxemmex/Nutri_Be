import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CACHE_TAG_USERS, buildUserCacheTag } from '../../config/constants/cache.constants';
import { UserRole } from '../../config/enums/role.enum';

@Injectable()
export class AccountDowngradeCronService {
  private readonly logger = new Logger(AccountDowngradeCronService.name);
  private isJobRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Cron chạy định kỳ mỗi giờ để hạ cấp tài khoản hết hạn kịp thời (Chống trễ tới 24h)
   * Có cờ chống chạy chồng isJobRunning
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAccountDowngradeCron(): Promise<void> {
    if (this.isJobRunning) {
      this.logger.warn('Cron job hạ cấp tài khoản đang chạy từ lượt trước. Bỏ qua tick này.');
      return;
    }
    this.isJobRunning = true;
    this.logger.log('Bắt đầu cron job quét hạ cấp tài khoản PRO hết hạn...');
    try {
      await this.downgradeExpiredAccounts();
    } catch (err: any) {
      this.logger.error(`Lỗi khi quét hạ cấp tài khoản: ${err?.message}`, err?.stack);
    } finally {
      this.isJobRunning = false;
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
   * Tuân thủ chia lô BATCH_SIZE = 100 chống tràn RAM (Anti-OOM)
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
    const BATCH_SIZE = 100;

    let totalDowngraded = 0;
    let totalUpdatedRegistrations = 0;
    const allDowngradedUserIds: string[] = [];

    let hasMore = true;
    while (hasMore) {
      const expiredBatch = await this.prisma.nguoi_dung.findMany({
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
        take: BATCH_SIZE,
      });

      if (expiredBatch.length === 0) {
        break;
      }

      const userIds = expiredBatch.map((u) => u.id);

      // Cập nhật bảng nguoi_dung cho lô này
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

      // Cập nhật bảng dang_ky cho các user trong lô này
      const updateDangKyResult = await this.prisma.dang_ky.updateMany({
        where: {
          OR: [{ nguoi_dung_id: { in: userIds }, trang_thai: { not: 'HET_HAN' } }],
        },
        data: {
          trang_thai: 'HET_HAN',
        },
      });

      // Invalidate cache cho lô này
      if (this.cacheService) {
        const tagsToInvalidate = [CACHE_TAG_USERS, ...userIds.map((id) => buildUserCacheTag(id))];
        await this.cacheService.invalidateTags(tagsToInvalidate);
      }

      totalDowngraded += updateResult.count;
      totalUpdatedRegistrations += updateDangKyResult.count;
      allDowngradedUserIds.push(...userIds);

      if (expiredBatch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    if (totalDowngraded > 0) {
      this.logger.log(
        `Đã hạ cấp thành công ${totalDowngraded} tài khoản USERPRO về USER, cập nhật ${totalUpdatedRegistrations} bản ghi dang_ky sang HET_HAN.`,
      );
    } else {
      this.logger.log('Không có tài khoản USERPRO nào hết hạn cần hạ cấp.');
    }

    return {
      downgradedCount: totalDowngraded,
      updatedRegistrations: totalUpdatedRegistrations,
      downgradedUserIds: allDowngradedUserIds,
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
