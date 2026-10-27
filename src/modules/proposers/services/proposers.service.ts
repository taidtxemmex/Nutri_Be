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
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../../config/constants/pagination.constants';
import { normalizePagination } from '../../../common/dto/base-pagination-query.dto';
import {
  CreateProposerDto,
  UpdateProposerDto,
  ProposerQueryDto,
  ProposerResponseDto,
} from '../dto';

export interface PaginatedProposersResult {
  items: ProposerResponseDto[];
  total: number;
  page: number;
  limit: number;
}

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
  async findAll(query?: ProposerQueryDto): Promise<PaginatedProposersResult> {
    const { page, limit, skip } = normalizePagination(query);

    const cacheKey = this.cacheService?.generateKey('proposers:list', {
      page,
      limit,
      search: query?.search,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder,
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
  async getMe(userId: string): Promise<ProposerResponseDto> {
    const cacheKey = buildProposerCacheTag(userId);

    if (this.cacheService) {
      const cached = await this.cacheService.get<ProposerResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const record = await this.prisma.nguoi_de_xuat.findUnique({
      where: { nguoi_dung_id: userId },
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
  async findById(id: number): Promise<ProposerResponseDto> {
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

  /**
   * Thêm mới hoặc cập nhật hồ sơ người đề xuất cho user hiện tại (Upsert)
   */
  async insert(userId: string, dto: CreateProposerDto): Promise<ProposerResponseDto> {
    const created = await this.prisma.nguoi_de_xuat.upsert({
      where: { nguoi_dung_id: userId },
      create: {
        nguoi_dung_id: userId,
        trinh_do_hoc_van: dto.education?.trim() || null,
        nghe_nghiep: dto.major?.trim() || null,
        don_vi_cong_tac: dto.unit?.trim() || null,
        vi_tri_cong_tac: dto.position?.trim() || null,
        linh_vuc_cong_tac: dto.field?.trim() || null,
      },
      update: {
        ...(dto.education !== undefined && { trinh_do_hoc_van: dto.education.trim() }),
        ...(dto.major !== undefined && { nghe_nghiep: dto.major.trim() }),
        ...(dto.unit !== undefined && { don_vi_cong_tac: dto.unit.trim() }),
        ...(dto.position !== undefined && { vi_tri_cong_tac: dto.position.trim() }),
        ...(dto.field !== undefined && { linh_vuc_cong_tac: dto.field.trim() }),
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

    await this.invalidateCache(userId);

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
  async update(
    id: number,
    userId: string,
    isAdmin: boolean,
    dto: UpdateProposerDto,
  ): Promise<ProposerResponseDto> {
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

    // IDOR Check: Chỉ người sở hữu hoặc Quản trị viên mới được phép sửa
    if (existing.nguoi_dung_id !== userId && !isAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESOURCE',
        message: 'Bạn không có quyền chỉnh sửa hồ sơ người đề xuất này',
      });
    }

    const updated = await this.prisma.nguoi_de_xuat.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.education !== undefined && { trinh_do_hoc_van: dto.education.trim() }),
        ...(dto.major !== undefined && { nghe_nghiep: dto.major.trim() }),
        ...(dto.unit !== undefined && { don_vi_cong_tac: dto.unit.trim() }),
        ...(dto.position !== undefined && { vi_tri_cong_tac: dto.position.trim() }),
        ...(dto.field !== undefined && { linh_vuc_cong_tac: dto.field.trim() }),
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

    await this.invalidateCache(existing.nguoi_dung_id);

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

  private async invalidateCache(userId?: string): Promise<void> {
    if (this.cacheService) {
      const tags = [CACHE_TAG_PROPOSERS];
      if (userId) {
        tags.push(buildProposerCacheTag(userId));
      }
      await this.cacheService.debouncedInvalidateTags(tags);
    }
  }
}
