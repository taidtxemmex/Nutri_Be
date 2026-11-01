import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_PROPOSERS,
  CACHE_TTL_LIST_SECONDS,
  CACHE_TTL_DETAIL_SECONDS,
  buildProposerCacheTag,
} from '../../../config/constants/cache.constants';
import { normalizePagination } from '../../../common/dto/base-pagination-query.dto';
import {
  ProposerResponseDto,
  FindProposersParamsDto,
  GetMeProposerParamsDto,
  FindProposerByIdParamsDto,
  InsertProposerParamsDto,
  UpdateProposerParamsDto,
} from '../dto';

import { PaginatedResult } from '../../../common/interfaces/pagination.interface';

export type PaginatedProposersResult = PaginatedResult<ProposerResponseDto>;

@Injectable()
export class ProposersService {
  private readonly logger = new Logger(ProposersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Danh sách hồ sơ người đề xuất có phân trang (Anti-OOM, Lean Projections)
   */
  async findAll({ query }: FindProposersParamsDto = {}): Promise<PaginatedProposersResult> {
    const { page, limit, skip } = normalizePagination(query);

    const cacheKey = this.cacheService?.generateKey({
      prefix: 'proposers:list',
      params: {
        page,
        limit,
        search: query?.search,
        sortBy: query?.sortBy,
        sortOrder: query?.sortOrder,
      },
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedProposersResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {};
    if (query?.search) {
      const keyword = query.search.trim();
      where.OR = [
        { trinh_do_hoc_van: { contains: keyword } },
        { nghe_nghiep: { contains: keyword } },
        { don_vi_cong_tac: { contains: keyword } },
        { vi_tri_cong_tac: { contains: keyword } },
        { linh_vuc_cong_tac: { contains: keyword } },
      ];
    }

    const orderBy: any = {};
    const sortField = query?.sortBy || 'id';
    orderBy[sortField] = query?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, records] = await Promise.all([
      this.prisma.nguoi_de_xuat.count({ where }),
      this.prisma.nguoi_de_xuat.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          nguoi_dung_id: true,
          trinh_do_hoc_van: true,
          nghe_nghiep: true,
          don_vi_cong_tac: true,
          vi_tri_cong_tac: true,
          linh_vuc_cong_tac: true,
        },
      }),
    ]);

    const items: ProposerResponseDto[] = records.map((r) => ({
      id: Number(r.id),
      userId: r.nguoi_dung_id,
      education: r.trinh_do_hoc_van || '',
      major: r.nghe_nghiep || '',
      unit: r.don_vi_cong_tac || '',
      position: r.vi_tri_cong_tac || '',
      field: r.linh_vuc_cong_tac || '',
    }));

    const result: PaginatedProposersResult = {
      items,
      total,
      page,
      limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_LIST_SECONDS, CACHE_TAG_PROPOSERS);
    }

    return result;
  }

  /**
   * Lấy hồ sơ người đề xuất của user hiện tại (IDOR Safe: GET /me)
   */
  async getMe({ userId }: GetMeProposerParamsDto): Promise<ProposerResponseDto> {
    const actualUserId = await this.resolveActualUserId(userId);
    const cacheKey = buildProposerCacheTag(actualUserId);

    if (this.cacheService) {
      const cached = await this.cacheService.get<ProposerResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const record = await this.prisma.nguoi_de_xuat.findUnique({
      where: { nguoi_dung_id: actualUserId },
      select: {
        id: true,
        nguoi_dung_id: true,
        trinh_do_hoc_van: true,
        nghe_nghiep: true,
        don_vi_cong_tac: true,
        vi_tri_cong_tac: true,
        linh_vuc_cong_tac: true,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'PROPOSER_001',
        message: 'error.proposer.not_found',
      });
    }

    const result: ProposerResponseDto = {
      id: Number(record.id),
      userId: record.nguoi_dung_id,
      education: record.trinh_do_hoc_van || '',
      major: record.nghe_nghiep || '',
      unit: record.don_vi_cong_tac || '',
      position: record.vi_tri_cong_tac || '',
      field: record.linh_vuc_cong_tac || '',
    };

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_DETAIL_SECONDS, CACHE_TAG_PROPOSERS);
    }

    return result;
  }

  /**
   * Lấy chi tiết hồ sơ người đề xuất theo ID
   */
  async findById({ id }: FindProposerByIdParamsDto): Promise<ProposerResponseDto> {
    const record = await this.prisma.nguoi_de_xuat.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        nguoi_dung_id: true,
        trinh_do_hoc_van: true,
        nghe_nghiep: true,
        don_vi_cong_tac: true,
        vi_tri_cong_tac: true,
        linh_vuc_cong_tac: true,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'PROPOSER_001',
        message: 'error.proposer.not_found',
      });
    }

    return {
      id: Number(record.id),
      userId: record.nguoi_dung_id,
      education: record.trinh_do_hoc_van || '',
      major: record.nghe_nghiep || '',
      unit: record.don_vi_cong_tac || '',
      position: record.vi_tri_cong_tac || '',
      field: record.linh_vuc_cong_tac || '',
    };
  }

  private isNonEmptyString(val: unknown): boolean {
    return typeof val === 'string' && val.trim().length > 0;
  }

  private isProfileComplete(profile?: any, proposer?: any): boolean {
    if (!profile || !proposer) return false;
    const hasHoTen = this.isNonEmptyString(profile.ho_ten ?? profile.fullName);
    const hasNgaySinh = profile.ngay_sinh != null && profile.ngay_sinh !== '';
    const hasGioiTinh = this.isNonEmptyString(profile.gioi_tinh ?? profile.gender);
    const hasPhone = this.isNonEmptyString(
      profile.phone ?? profile.so_dien_thoai ?? profile.phoneNumber,
    );
    const hasEmail = this.isNonEmptyString(profile.email);
    const hasUnit = this.isNonEmptyString(
      proposer.don_vi_cong_tac ?? proposer.unit ?? proposer.workUnit,
    );
    const hasPosition = this.isNonEmptyString(
      proposer.vi_tri_cong_tac ?? proposer.chuc_vu ?? proposer.position,
    );

    return hasHoTen && hasNgaySinh && hasGioiTinh && hasPhone && hasEmail && hasUnit && hasPosition;
  }

  private async resolveActualUserId(userId: string): Promise<string> {
    if (typeof (this.prisma as any).nguoi_dung?.findFirst === 'function') {
      const found = await this.prisma.nguoi_dung.findFirst({
        where: { OR: [{ id: userId }, { keycloak_user_id: userId }] },
        select: { id: true },
      });
      if (found?.id) {
        return found.id;
      }
    }
    return userId;
  }

  private async syncProfileCompleted(userId: string, proposerRecord: any): Promise<void> {
    if (
      typeof (this.prisma as any).ho_so_ca_nhan?.findUnique === 'function' &&
      typeof (this.prisma as any).nguoi_dung?.update === 'function'
    ) {
      const profile = await this.prisma.ho_so_ca_nhan.findUnique({
        where: { nguoi_dung_id: userId },
        select: {
          ho_ten: true,
          ngay_sinh: true,
          gioi_tinh: true,
          phone: true,
          email: true,
        },
      });
      const isComplete = this.isProfileComplete(profile, proposerRecord);
      await this.prisma.nguoi_dung.update({
        where: { id: userId },
        data: { profile_completed: isComplete },
      });
    }
  }

  private normalizeOptionalString(val: unknown): string {
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) {
      return val
        .map((v) => String(v).trim())
        .filter(Boolean)
        .join(', ');
    }
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  /**
   * Thêm mới hoặc cập nhật hồ sơ người đề xuất cho user hiện tại (Upsert)
   */
  async insert({ userId, dto }: InsertProposerParamsDto): Promise<ProposerResponseDto> {
    const actualUserId = await this.resolveActualUserId(userId);
    const created = await this.prisma.nguoi_de_xuat.upsert({
      where: { nguoi_dung_id: actualUserId },
      create: {
        nguoi_dung_id: actualUserId,
        trinh_do_hoc_van: this.normalizeOptionalString(dto.education) || null,
        nghe_nghiep: this.normalizeOptionalString(dto.major) || null,
        don_vi_cong_tac: this.normalizeOptionalString(dto.unit) || null,
        vi_tri_cong_tac: this.normalizeOptionalString(dto.position) || null,
        linh_vuc_cong_tac: this.normalizeOptionalString(dto.field) || null,
      },
      update: {
        ...(dto.education !== undefined && {
          trinh_do_hoc_van: this.normalizeOptionalString(dto.education),
        }),
        ...(dto.major !== undefined && { nghe_nghiep: this.normalizeOptionalString(dto.major) }),
        ...(dto.unit !== undefined && { don_vi_cong_tac: this.normalizeOptionalString(dto.unit) }),
        ...(dto.position !== undefined && {
          vi_tri_cong_tac: this.normalizeOptionalString(dto.position),
        }),
        ...(dto.field !== undefined && {
          linh_vuc_cong_tac: this.normalizeOptionalString(dto.field),
        }),
      },
      select: {
        id: true,
        nguoi_dung_id: true,
        trinh_do_hoc_van: true,
        nghe_nghiep: true,
        don_vi_cong_tac: true,
        vi_tri_cong_tac: true,
        linh_vuc_cong_tac: true,
      },
    });

    await this.syncProfileCompleted(actualUserId, created);
    await this.invalidateCache({ userId: actualUserId });

    return {
      id: Number(created.id),
      userId: created.nguoi_dung_id,
      education: created.trinh_do_hoc_van || '',
      major: created.nghe_nghiep || '',
      unit: created.don_vi_cong_tac || '',
      position: created.vi_tri_cong_tac || '',
      field: created.linh_vuc_cong_tac || '',
    };
  }

  /**
   * Cập nhật hồ sơ người đề xuất (Vá lỗi IDOR của Java: kiểm tra quyền sở hữu)
   */
  async update({
    id,
    userId,
    isAdmin,
    dto,
  }: UpdateProposerParamsDto): Promise<ProposerResponseDto> {
    const existing = await this.prisma.nguoi_de_xuat.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, nguoi_dung_id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PROPOSER_001',
        message: 'error.proposer.not_found',
      });
    }

    const actualCallerUserId = await this.resolveActualUserId(userId);

    // IDOR Check: Chỉ người sở hữu hoặc Quản trị viên mới được phép sửa
    if (
      existing.nguoi_dung_id !== userId &&
      existing.nguoi_dung_id !== actualCallerUserId &&
      !isAdmin
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESOURCE',
        message: 'Bạn không có quyền chỉnh sửa hồ sơ người đề xuất này',
      });
    }

    const updated = await this.prisma.nguoi_de_xuat.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.education !== undefined && {
          trinh_do_hoc_van: this.normalizeOptionalString(dto.education),
        }),
        ...(dto.major !== undefined && { nghe_nghiep: this.normalizeOptionalString(dto.major) }),
        ...(dto.unit !== undefined && { don_vi_cong_tac: this.normalizeOptionalString(dto.unit) }),
        ...(dto.position !== undefined && {
          vi_tri_cong_tac: this.normalizeOptionalString(dto.position),
        }),
        ...(dto.field !== undefined && {
          linh_vuc_cong_tac: this.normalizeOptionalString(dto.field),
        }),
      },
      select: {
        id: true,
        nguoi_dung_id: true,
        trinh_do_hoc_van: true,
        nghe_nghiep: true,
        don_vi_cong_tac: true,
        vi_tri_cong_tac: true,
        linh_vuc_cong_tac: true,
      },
    });

    await this.syncProfileCompleted(existing.nguoi_dung_id, updated);
    await this.invalidateCache({ userId: existing.nguoi_dung_id });

    return {
      id: Number(updated.id),
      userId: updated.nguoi_dung_id,
      education: updated.trinh_do_hoc_van || '',
      major: updated.nghe_nghiep || '',
      unit: updated.don_vi_cong_tac || '',
      position: updated.vi_tri_cong_tac || '',
      field: updated.linh_vuc_cong_tac || '',
    };
  }

  private async invalidateCache({ userId }: { userId?: string } = {}): Promise<void> {
    if (this.cacheService) {
      const tags = [CACHE_TAG_PROPOSERS];
      if (userId) {
        tags.push(buildProposerCacheTag(userId));
      }
      await this.cacheService.debouncedInvalidateTags(tags);
    }
  }
}
