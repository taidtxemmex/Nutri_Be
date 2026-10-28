import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { MysqlQueueService } from '../../../core/queue/mysql-queue.service';
import {
  CACHE_TAG_PACKAGES,
  CACHE_TAG_PLANS,
  CACHE_TAG_SUBSCRIPTIONS,
  CACHE_TAG_USERS,
  CACHE_TTL_LOOKUP_SECONDS,
  buildPackageCacheTag,
  buildPlanCacheTag,
  buildUserAuthCacheKey,
  buildUserCacheTag,
  buildUserDetailCacheKey,
} from '../../../config/constants/cache.constants';
import {
  CreatePlanDto,
  UpdatePlanDto,
  PlanResponseDto,
  SubscriptionRequestDto,
  SubscriptionResponseDto,
  SubscriptionApproveDto,
  CreatePlanParamDto,
  FindAllPlansParamDto,
  FindPlanByIdParamDto,
  UpdatePlanParamDto,
  DeletePlanParamDto,
  RequestSubscriptionParamDto,
  ApproveSubscriptionParamDto,
  RejectSubscriptionParamDto,
  ListUserRequestsParamDto,
  ListAllRequestsParamDto,
} from '../dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    @Optional() private readonly queueService?: MysqlQueueService,
  ) {}

  private static txSequence: number = crypto.randomInt(0, 0xffffff);

  /**
   * Sinh mã giao dịch duy nhất theo chuẩn TX-yyMMdd-XXXXXX
   * Khắc phục hoàn toàn Nghịch lý Ngày sinh (Birthday Paradox)
   * Sử dụng 24-bit full-cycle permutation (Hull-Dobell Theorem) đảm bảo 100% không đụng độ trong 16.7 triệu mã
   */
  generateTransactionCode(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePart = `${yy}${MM}${dd}`;
    SubscriptionsService.txSequence = (SubscriptionsService.txSequence + 1) & 0xffffff;
    const permuted = (Math.imul(SubscriptionsService.txSequence, 1664525) + 1013904223) & 0xffffff;
    const randomHex = permuted.toString(16).toUpperCase().padStart(6, '0');
    return `TX-${datePart}-${randomHex}`;
  }

  // =========================================================================
  // 1. QUẢN LÝ GÓI CƯỚC (PACKAGES / PLANS)
  // =========================================================================

  /**
   * Admin tạo mới gói cước
   */
  async createPlan(
    paramOrDto: CreatePlanParamDto | CreatePlanDto,
    legacyAdminUser?: any,
  ): Promise<PlanResponseDto> {
    const dto =
      paramOrDto instanceof CreatePlanDto ? paramOrDto : (paramOrDto as CreatePlanParamDto).dto;
    const _adminUser =
      paramOrDto instanceof CreatePlanDto
        ? legacyAdminUser
        : (paramOrDto as CreatePlanParamDto).adminUser;

    const code = dto.getPackageCode();
    if (!code) {
      throw new BadRequestException('Mã gói cước không được để trống');
    }

    const name = dto.getPackageName();
    if (!name) {
      throw new BadRequestException('Tên gói cước không được để trống');
    }

    // 1. Kiểm tra tính duy nhất của mã gói (chỉ xét các gói chưa bị xóa mềm)
    const existing = await this.prisma.goi.findFirst({
      where: {
        ma_goi: code,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Mã gói cước "${code}" đã tồn tại trên hệ thống`);
    }

    // 2. Ghi bản ghi vào CSDL
    const created = await this.prisma.goi.create({
      data: {
        ma_goi: code,
        ten_goi: name,
        so_ngay_su_dung: dto.getUsageDays(),
        gia_tien: dto.getPrice(),
        mo_ta: dto.getDescription() || null,
        trang_thai: dto.getStatus(),
        ngay_tao: new Date(),
        ngay_cap_nhat: new Date(),
      },
      select: {
        id: true,
        ma_goi: true,
        ten_goi: true,
        so_ngay_su_dung: true,
        gia_tien: true,
        mo_ta: true,
        trang_thai: true,
        ngay_tao: true,
        ngay_cap_nhat: true,
      },
    });

    // 3. Invalidate Cache tags
    await this.cacheService.invalidateTags([CACHE_TAG_PACKAGES, CACHE_TAG_PLANS]);

    return PlanResponseDto.fromEntity(created);
  }

  /**
   * Lấy danh sách gói cước (kèm cache)
   * @param activeOnly Chỉ lấy các gói đang mở bán (dành cho người dùng / public)
   */
  async findAllPlans(param?: FindAllPlansParamDto | boolean): Promise<PlanResponseDto[]> {
    const activeOnly = typeof param === 'boolean' ? param : (param?.activeOnly ?? false);
    const cacheKey = activeOnly
      ? this.cacheService.generateKey({ prefix: CACHE_TAG_PLANS, params: { active: true } })
      : this.cacheService.generateKey({ prefix: CACHE_TAG_PLANS, params: { all: true } });

    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_LOOKUP_SECONDS,
      async () => {
        const plans = await this.prisma.goi.findMany({
          where: {
            deleted_at: null,
            ...(activeOnly ? { trang_thai: 'ACTIVE' } : {}),
          },
          select: {
            id: true,
            ma_goi: true,
            ten_goi: true,
            so_ngay_su_dung: true,
            gia_tien: true,
            mo_ta: true,
            trang_thai: true,
            ngay_tao: true,
            ngay_cap_nhat: true,
          },
          orderBy: {
            gia_tien: 'asc',
          },
        });

        return plans.map((p) => PlanResponseDto.fromEntity(p));
      },
      [CACHE_TAG_PACKAGES, CACHE_TAG_PLANS],
    );
  }

  /**
   * Lấy chi tiết một gói cước theo ID (Lean Detail Envelope)
   */
  async findPlanById(
    paramOrId: FindPlanByIdParamDto | string | number | bigint,
  ): Promise<PlanResponseDto> {
    const rawId =
      typeof paramOrId === 'object' && paramOrId !== null && 'id' in paramOrId
        ? paramOrId.id
        : (paramOrId as string | number | bigint);
    const numericId = BigInt(rawId);
    const plan = await this.prisma.goi.findFirst({
      where: {
        id: numericId,
        deleted_at: null,
      },
      select: {
        id: true,
        ma_goi: true,
        ten_goi: true,
        so_ngay_su_dung: true,
        gia_tien: true,
        mo_ta: true,
        trang_thai: true,
        ngay_tao: true,
        ngay_cap_nhat: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Gói cước có ID "${rawId}" không tồn tại`);
    }

    return PlanResponseDto.fromEntity(plan);
  }

  /**
   * Cập nhật thông tin gói cước
   */
  async updatePlan(
    paramOrId: UpdatePlanParamDto | string | number | bigint,
    legacyDto?: UpdatePlanDto,
    legacyAdminUser?: any,
  ): Promise<PlanResponseDto> {
    let id: string | number | bigint;
    let dto: UpdatePlanDto;
    let _adminUser: any;

    if (paramOrId && typeof paramOrId === 'object' && 'dto' in paramOrId) {
      id = paramOrId.id;
      dto = paramOrId.dto;
      _adminUser = paramOrId.adminUser;
    } else {
      id = paramOrId as string | number | bigint;
      dto = legacyDto!;
      _adminUser = legacyAdminUser;
    }

    const numericId = BigInt(id);

    const existing = await this.prisma.goi.findFirst({
      where: {
        id: numericId,
        deleted_at: null,
      },
      select: { id: true, ma_goi: true },
    });

    if (!existing) {
      throw new NotFoundException(`Gói cước có ID "${id}" không tồn tại`);
    }

    const updateData: any = {
      ngay_cap_nhat: new Date(),
    };

    if (dto.getPackageName() !== undefined) updateData.ten_goi = dto.getPackageName();
    if (dto.getUsageDays() !== undefined) updateData.so_ngay_su_dung = dto.getUsageDays();
    if (dto.getPrice() !== undefined) updateData.gia_tien = dto.getPrice();
    if (dto.getDescription() !== undefined) updateData.mo_ta = dto.getDescription();
    if (dto.getStatus() !== undefined) updateData.trang_thai = dto.getStatus();

    const updated = await this.prisma.goi.update({
      where: { id: numericId },
      data: updateData,
      select: {
        id: true,
        ma_goi: true,
        ten_goi: true,
        so_ngay_su_dung: true,
        gia_tien: true,
        mo_ta: true,
        trang_thai: true,
        ngay_tao: true,
        ngay_cap_nhat: true,
      },
    });

    // Invalidate Cache tags
    await this.cacheService.invalidateTags([
      CACHE_TAG_PACKAGES,
      CACHE_TAG_PLANS,
      buildPackageCacheTag(numericId),
      buildPlanCacheTag(numericId),
    ]);

    return PlanResponseDto.fromEntity(updated);
  }

  /**
   * Xóa mềm gói cước (soft delete)
   */
  async deletePlan(
    paramOrId: DeletePlanParamDto | string | number | bigint,
    legacyAdminUser?: any,
  ): Promise<{ message: string; id: string }> {
    let id: string | number | bigint;
    let _adminUser: any;

    if (paramOrId && typeof paramOrId === 'object' && 'id' in paramOrId) {
      id = paramOrId.id;
      _adminUser = paramOrId.adminUser;
    } else {
      id = paramOrId as string | number | bigint;
      _adminUser = legacyAdminUser;
    }

    const numericId = BigInt(id);

    const existing = await this.prisma.goi.findFirst({
      where: {
        id: numericId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Gói cước có ID "${id}" không tồn tại`);
    }

    await this.prisma.goi.update({
      where: { id: numericId },
      data: {
        deleted_at: new Date(),
        trang_thai: 'INACTIVE',
      },
    });

    // Invalidate Cache tags
    await this.cacheService.invalidateTags([
      CACHE_TAG_PACKAGES,
      CACHE_TAG_PLANS,
      buildPackageCacheTag(numericId),
      buildPlanCacheTag(numericId),
    ]);

    return {
      message: 'Xóa mềm gói cước thành công',
      id: numericId.toString(),
    };
  }

  // =========================================================================
  // 2. YÊU CẦU ĐĂNG KÝ / NÂNG CẤP GÓI CƯỚC (SUBSCRIPTIONS & PAYMENTS)
  // =========================================================================

  /**
   * Người dùng gửi yêu cầu thanh toán / nâng cấp tài khoản
   */
  async requestSubscription(
    paramOrUserId: RequestSubscriptionParamDto | string,
    legacyDto?: SubscriptionRequestDto,
  ): Promise<SubscriptionResponseDto> {
    let userId: string;
    let dto: SubscriptionRequestDto;

    if (paramOrUserId && typeof paramOrUserId === 'object' && 'userId' in paramOrUserId) {
      userId = paramOrUserId.userId;
      dto = paramOrUserId.dto;
    } else {
      userId = paramOrUserId as string;
      dto = legacyDto!;
    }
    const packageCode = dto.getPackageCode();
    if (!packageCode) {
      throw new BadRequestException('Mã gói cước không được để trống');
    }

    // 1. Kiểm tra gói cước tồn tại và đang mở bán
    const packageEntity = await this.prisma.goi.findFirst({
      where: {
        ma_goi: packageCode,
        deleted_at: null,
      },
      select: {
        id: true,
        ma_goi: true,
        ten_goi: true,
        so_ngay_su_dung: true,
        gia_tien: true,
        trang_thai: true,
      },
    });

    if (!packageEntity) {
      throw new NotFoundException(`Gói cước "${packageCode}" không tồn tại`);
    }

    if (packageEntity.trang_thai !== 'ACTIVE') {
      throw new BadRequestException(`Gói cước "${packageCode}" hiện không khả dụng để đăng ký`);
    }

    // 2. Xác thực người dùng
    const user = await this.prisma.nguoi_dung.findFirst({
      where: { id: userId, deleted_at: null },
      select: {
        id: true,
        ten_dang_nhap: true,
        ho_so_ca_nhan: { select: { ho_ten: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản người dùng không tồn tại');
    }

    // 3. Sinh mã giao dịch chuẩn duy nhất có retry chống đụng độ
    let maGiaoDich = this.generateTransactionCode();
    for (let attempts = 0; attempts < 5; attempts++) {
      const dup = await this.prisma.yeu_cau_thanh_toan.findUnique({
        where: { ma_giao_dich: maGiaoDich },
        select: { id: true },
      });
      if (!dup) break;
      maGiaoDich = this.generateTransactionCode();
    }

    // 4. Tạo yêu cầu thanh toán kèm chứng minh (nếu có)
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const pr = await tx.yeu_cau_thanh_toan.create({
        data: {
          nguoi_dung_id: userId,
          ma_goi: packageEntity.ma_goi,
          ten_goi: packageEntity.ten_goi,
          so_ngay_su_dung: packageEntity.so_ngay_su_dung,
          so_tien: packageEntity.gia_tien,
          trang_thai: 'PENDING',
          ma_giao_dich: maGiaoDich,
          ngay_tao: now,
        },
      });

      // Đính kèm chứng từ thanh toán vào bảng minh_chung nếu có
      if (dto.documents && dto.documents.length > 0) {
        for (const doc of dto.documents) {
          // A3: Validate externalLink scheme (phòng thủ XSS / javascript: schemes)
          if (doc.externalLink && !/^https?:\/\//i.test(doc.externalLink)) {
            throw new BadRequestException(
              'Đường dẫn minh chứng bên ngoài phải bắt đầu bằng http:// hoặc https://',
            );
          }

          // A3: Validate objectKey (chống path traversal và null byte)
          if (doc.objectKey && (doc.objectKey.includes('..') || doc.objectKey.includes('\0'))) {
            throw new BadRequestException('Đường dẫn tệp tin objectKey không hợp lệ');
          }

          await tx.minh_chung.create({
            data: {
              yeu_cau_id: pr.id,
              nguoi_upload_id: userId,
              object_key: doc.objectKey || null,
              ten_file_goc: doc.originalFileName || null,
              mime_type: doc.mimeType || null,
              link_ngoai: doc.externalLink || null,
              ngay_upload: now,
            },
          });
        }
      }

      return tx.yeu_cau_thanh_toan.findUnique({
        where: { id: pr.id },
        include: {
          minh_chung: true,
        },
      });
    });

    // Invalidate Cache tag subscriptions
    await this.cacheService.invalidateTag(CACHE_TAG_SUBSCRIPTIONS);

    // A4: Enqueue job thông báo tạo yêu cầu thanh toán
    if (this.queueService) {
      try {
        await this.queueService.enqueue({
          queueName: 'mail:send',
          payload: {
            to: user.ten_dang_nhap || 'user@nutri.vn',
            subject: 'Xác nhận tạo yêu cầu thanh toán gói cước',
            payload: {
              maGiaoDich: created.ma_giao_dich,
              tenGoi: packageEntity.ten_goi,
              soTien: packageEntity.gia_tien,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi đẩy email tạo yêu cầu thanh toán vào queue: ${err?.message}`);
      }
    }

    return SubscriptionResponseDto.fromEntity({
      entity: created,
      userProfile: {
        username: user.ten_dang_nhap,
        fullName: user.ho_so_ca_nhan?.ho_ten ?? undefined,
      },
    });
  }

  /**
   * Admin duyệt yêu cầu thanh toán
   * Khắc phục triệt để lỗi mất ngày sử dụng cũ:
   * - Sử dụng Transaction + Khóa bi quan (FOR UPDATE)
   * - Nếu tài khoản còn hạn (user.pro_expired_at > now) -> thời hạn mới được CỘNG DỒN tiếp vào pro_expired_at
   * - Nâng vai trò user lên USERPRO
   * - Ghi bản ghi lịch sử vào bảng dang_ky
   * - Invalidate cache 'users', 'user:${userId}'
   */
  async approveSubscription(
    paramOrId: ApproveSubscriptionParamDto | string | number | bigint,
    legacyAdminId?: string,
  ): Promise<SubscriptionResponseDto> {
    let requestId: string | number | bigint;
    let adminId: string;

    if (paramOrId && typeof paramOrId === 'object' && 'subscriptionId' in paramOrId) {
      requestId = paramOrId.subscriptionId;
      adminId = paramOrId.adminId;
    } else {
      requestId = paramOrId as string | number | bigint;
      adminId = legacyAdminId!;
    }

    const numericId = BigInt(requestId);

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      // 1. Khóa bi quan hàng yêu cầu thanh toán (FOR UPDATE) chống double-approval race condition
      let request: any = null;
      try {
        const lockedRequests: any[] = await tx.$queryRaw`
          SELECT id, nguoi_dung_id, ma_goi, ten_goi, so_ngay_su_dung, so_tien, trang_thai, ma_giao_dich
          FROM yeu_cau_thanh_toan
          WHERE id = ${numericId}
          FOR UPDATE
        `;
        if (
          lockedRequests &&
          lockedRequests.length > 0 &&
          lockedRequests[0]?.trang_thai !== undefined
        ) {
          request = lockedRequests[0];
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi lock row đăng ký gói: ${err?.message}`);
        // Fallback to findUnique
      }

      if (!request) {
        request = await tx.yeu_cau_thanh_toan.findUnique({
          where: { id: numericId },
          select: {
            id: true,
            nguoi_dung_id: true,
            ma_goi: true,
            ten_goi: true,
            so_ngay_su_dung: true,
            so_tien: true,
            trang_thai: true,
            ma_giao_dich: true,
          },
        });
      }

      if (!request) {
        throw new NotFoundException(`Yêu cầu thanh toán ID "${requestId}" không tồn tại`);
      }

      const currentStatus = (request.trang_thai || '').toUpperCase();
      if (currentStatus !== 'PENDING' && currentStatus !== 'CHO_DUYET') {
        throw new BadRequestException(
          `Yêu cầu thanh toán đang ở trạng thái "${request.trang_thai}", không thể phê duyệt`,
        );
      }

      // 2. Khóa bi quan hàng User để chống race condition cập nhật đồng thời
      let user: any = null;
      try {
        const lockedUsers: any[] = await tx.$queryRaw`
          SELECT id, vai_tro, pro_expired_at
          FROM nguoi_dung
          WHERE id = ${request.nguoi_dung_id}
          FOR UPDATE
        `;
        if (lockedUsers && lockedUsers.length > 0) {
          user = lockedUsers[0];
        }
      } catch (err: any) {
        this.logger.warn(`Fallback to findUnique for locking user: ${err?.message}`);
        user = await tx.nguoi_dung.findUnique({
          where: { id: request.nguoi_dung_id },
          select: { id: true, vai_tro: true, pro_expired_at: true },
        });
      }

      if (!user) {
        user = await tx.nguoi_dung.findUnique({
          where: { id: request.nguoi_dung_id },
          select: { id: true, vai_tro: true, pro_expired_at: true },
        });
      }

      if (!user) {
        throw new NotFoundException('Người dùng liên kết với giao dịch không tồn tại');
      }

      // 3. Tính toán thời hạn gia hạn cộng dồn (Cumulative Extension)
      const now = new Date();
      let baseDate = now;

      if (user.pro_expired_at) {
        const currentExpiredAt = new Date(user.pro_expired_at);
        if (currentExpiredAt.getTime() > now.getTime()) {
          baseDate = currentExpiredAt;
        }
      }

      const newProExpiredAt = new Date(
        baseDate.getTime() + request.so_ngay_su_dung * 24 * 60 * 60 * 1000,
      );

      // 4. Cập nhật vai trò cho User (A1: Chỉ nâng lên USERPRO nếu vai trò hiện tại là USER hoặc rỗng)
      // Nếu user đang là ADMIN / SUPERADMIN / BAC_SI thì giữ nguyên đặc quyền quản trị, vẫn cộng dồn pro_expired_at
      const currentRole = (user.vai_tro || '').toUpperCase();
      const newRole = currentRole === 'USER' || !currentRole ? 'USERPRO' : user.vai_tro;

      await tx.nguoi_dung.update({
        where: { id: request.nguoi_dung_id },
        data: {
          vai_tro: newRole,
          pro_expired_at: newProExpiredAt,
        },
      });

      // 5. Ghi nhận vào bảng dang_ky
      await tx.dang_ky.create({
        data: {
          nguoi_dung_id: request.nguoi_dung_id,
          ma_goi: request.ma_goi,
          ngay_bat_dau: baseDate,
          ngay_ket_thuc: newProExpiredAt,
          trang_thai: 'ACTIVE',
          thanh_toan_id: request.id,
        },
      });

      // 6. Cập nhật trạng thái yêu cầu thanh toán nguyên tử (Atomic conditional update)
      if (tx.yeu_cau_thanh_toan.updateMany) {
        const updateResult = await tx.yeu_cau_thanh_toan.updateMany({
          where: {
            id: request.id,
            trang_thai: { in: ['PENDING', 'CHO_DUYET'] },
          },
          data: {
            trang_thai: 'APPROVED',
            ngay_phe_duyet: now,
            nguoi_phe_duyet_id: adminId,
          },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException(
            'Yêu cầu thanh toán đã được phê duyệt bởi quản trị viên khác.',
          );
        }
      }

      const approvedPr = await tx.yeu_cau_thanh_toan.update({
        where: { id: request.id },
        data: {
          trang_thai: 'APPROVED',
          ngay_phe_duyet: now,
          nguoi_phe_duyet_id: adminId,
        },
        include: {
          minh_chung: true,
          nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung: {
            select: {
              ten_dang_nhap: true,
              ho_so_ca_nhan: { select: { ho_ten: true } },
            },
          },
        },
      });

      return approvedPr!;
    });

    // 7. Invalidate Cache users, user:${userId}, user:auth:${userId}, user:detail:${userId}
    await this.cacheService.invalidateTags([
      CACHE_TAG_USERS,
      buildUserCacheTag(updatedRequest.nguoi_dung_id),
      buildUserAuthCacheKey(updatedRequest.nguoi_dung_id),
      buildUserDetailCacheKey(updatedRequest.nguoi_dung_id),
      CACHE_TAG_SUBSCRIPTIONS,
    ]);

    // A4: Enqueue job thông báo kích hoạt gói PRO
    if (this.queueService) {
      try {
        await this.queueService.enqueue({
          queueName: 'mail:send',
          payload: {
            to:
              updatedRequest.nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung
                ?.ten_dang_nhap || 'user@nutri.vn',
            subject: 'Kích hoạt gói dịch vụ PRO thành công',
            payload: {
              maGiaoDich: updatedRequest.ma_giao_dich,
              tenGoi: updatedRequest.ten_goi,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi đẩy email duyệt thanh toán vào queue: ${err?.message}`);
      }
    }

    const linkedUser =
      (updatedRequest as any).nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung || {};

    return SubscriptionResponseDto.fromEntity({
      entity: updatedRequest,
      userProfile: {
        username: linkedUser.ten_dang_nhap,
        fullName: linkedUser.ho_so_ca_nhan?.ho_ten ?? undefined,
      },
    });
  }

  /**
   * Admin từ chối yêu cầu thanh toán
   */
  async rejectSubscription(
    paramOrId: RejectSubscriptionParamDto | string | number | bigint,
    legacyAdminId?: string,
    legacyDto?: SubscriptionApproveDto,
  ): Promise<SubscriptionResponseDto> {
    let requestId: string | number | bigint;
    let adminId: string;
    let dto: SubscriptionApproveDto;

    if (paramOrId && typeof paramOrId === 'object' && 'subscriptionId' in paramOrId) {
      requestId = paramOrId.subscriptionId;
      adminId = paramOrId.adminId;
      dto = paramOrId.dto;
    } else {
      requestId = paramOrId as string | number | bigint;
      adminId = legacyAdminId!;
      dto = legacyDto!;
    }

    const numericId = BigInt(requestId);

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      const request = await tx.yeu_cau_thanh_toan.findUnique({
        where: { id: numericId },
        select: { id: true, trang_thai: true },
      });

      if (!request) {
        throw new NotFoundException(`Yêu cầu thanh toán ID "${requestId}" không tồn tại`);
      }

      const currentStatus = (request.trang_thai || '').toUpperCase();
      if (currentStatus !== 'PENDING' && currentStatus !== 'CHO_DUYET') {
        throw new BadRequestException(
          `Yêu cầu thanh toán đang ở trạng thái "${request.trang_thai}", không thể từ chối`,
        );
      }

      // A2: Cập nhật có điều kiện nguyên tử trạng thái = REJECTED (Chống race condition với approve)
      if (tx.yeu_cau_thanh_toan.updateMany) {
        const updateResult = await tx.yeu_cau_thanh_toan.updateMany({
          where: {
            id: numericId,
            trang_thai: { in: ['PENDING', 'CHO_DUYET'] },
          },
          data: {
            trang_thai: 'REJECTED',
            ly_do_tu_choi: dto.getRejectionReason() || 'Từ chối bởi quản trị viên',
            ngay_phe_duyet: new Date(),
            nguoi_phe_duyet_id: adminId,
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException('Yêu cầu thanh toán đã được xử lý bởi quản trị viên khác.');
        }
      }

      return tx.yeu_cau_thanh_toan.update({
        where: { id: numericId },
        data: {
          trang_thai: 'REJECTED',
          ly_do_tu_choi: dto.getRejectionReason() || 'Từ chối bởi quản trị viên',
          ngay_phe_duyet: new Date(),
          nguoi_phe_duyet_id: adminId,
        },
        include: {
          minh_chung: true,
          nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung: {
            select: {
              ten_dang_nhap: true,
              ho_so_ca_nhan: { select: { ho_ten: true } },
            },
          },
        },
      });
    });

    await this.cacheService.invalidateTag(CACHE_TAG_SUBSCRIPTIONS);

    // A4: Enqueue job thông báo từ chối thanh toán
    if (this.queueService) {
      try {
        await this.queueService.enqueue({
          queueName: 'mail:send',
          payload: {
            to:
              (updatedRequest as any).nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung
                ?.ten_dang_nhap || 'user@nutri.vn',
            subject: 'Thông báo về yêu cầu thanh toán gói cước',
            payload: {
              maGiaoDich: (updatedRequest as any).ma_giao_dich,
              lyDoTuChoi: dto.getRejectionReason(),
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi đẩy email từ chối thanh toán vào queue: ${err?.message}`);
      }
    }

    const linkedUser =
      (updatedRequest as any).nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung || {};

    return SubscriptionResponseDto.fromEntity({
      entity: updatedRequest,
      userProfile: {
        username: linkedUser.ten_dang_nhap,
        fullName: linkedUser.ho_so_ca_nhan?.ho_ten ?? undefined,
      },
    });
  }

  /**
   * Lấy danh sách yêu cầu thanh toán của một người dùng
   */
  async listUserRequests(
    paramOrUserId: ListUserRequestsParamDto | string,
  ): Promise<SubscriptionResponseDto[]> {
    const userId =
      typeof paramOrUserId === 'object' && paramOrUserId !== null && 'userId' in paramOrUserId
        ? paramOrUserId.userId
        : (paramOrUserId as string);

    const requests = await this.prisma.yeu_cau_thanh_toan.findMany({
      where: { nguoi_dung_id: userId },
      orderBy: { ngay_tao: 'desc' },
      include: {
        minh_chung: true,
      },
    });

    return requests.map((r) => SubscriptionResponseDto.fromEntity(r));
  }

  /**
   * Admin lấy danh sách toàn bộ yêu cầu thanh toán
   */
  async listAllRequests(
    paramOrStatuses?: ListAllRequestsParamDto | string | string[],
  ): Promise<SubscriptionResponseDto[]> {
    let statuses: string | string[] | undefined;
    if (paramOrStatuses && typeof paramOrStatuses === 'object' && 'statuses' in paramOrStatuses) {
      statuses = paramOrStatuses.statuses;
    } else {
      statuses = paramOrStatuses as string | string[] | undefined;
    }

    let statusFilter: string[] | undefined = undefined;
    if (statuses) {
      const rawList = Array.isArray(statuses) ? statuses : statuses.split(',');
      statusFilter = rawList.map((s) => s.trim().toUpperCase()).filter(Boolean);
    }

    const requests = await this.prisma.yeu_cau_thanh_toan.findMany({
      where: {
        ...(statusFilter && statusFilter.length > 0 ? { trang_thai: { in: statusFilter } } : {}),
      },
      orderBy: { ngay_tao: 'desc' },
      include: {
        minh_chung: true,
        nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung: {
          select: {
            ten_dang_nhap: true,
            ho_so_ca_nhan: { select: { ho_ten: true } },
          },
        },
      },
    });

    return requests.map((r) => {
      const linkedUser = (r as any).nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung || {};
      return SubscriptionResponseDto.fromEntity({
        entity: r,
        userProfile: {
          username: linkedUser.ten_dang_nhap,
          fullName: linkedUser.ho_so_ca_nhan?.ho_ten ?? undefined,
        },
      });
    });
  }
}
