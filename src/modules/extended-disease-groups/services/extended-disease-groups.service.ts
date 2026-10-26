import { Injectable, NotFoundException, ConflictException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_EXTENDED_DISEASE_GROUPS,
  CACHE_TTL_LIST_SECONDS,
} from '../../../config/constants/cache.constants';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../../config/constants/pagination.constants';
import {
  CreateExtendedDiseaseGroupDto,
  UpdateExtendedDiseaseGroupDto,
  ExtendedDiseaseGroupQueryDto,
  ExtendedDiseaseGroupResponseDto,
} from '../dto';

export interface PaginatedExtendedDiseaseGroupsResult {
  items: ExtendedDiseaseGroupResponseDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ExtendedDiseaseGroupsService {
  private readonly logger = new Logger(ExtendedDiseaseGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Lấy danh sách nhóm bệnh mở rộng của user hiện tại (IDOR Defense: where nguoi_dung_id)
   */
  async findAll(
    userId: string,
    query?: ExtendedDiseaseGroupQueryDto,
  ): Promise<PaginatedExtendedDiseaseGroupsResult> {
    const page = Math.max(1, Number(query?.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query?.limit) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const cacheKey = this.cacheService?.generateKey(`extended-disease-groups:${userId}`, {
      page,
      limit,
      parentId: query?.parentId,
      search: query?.search,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder,
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedExtendedDiseaseGroupsResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {
      nguoi_dung_id: userId,
    };

    if (query?.parentId) {
      where.ma_nhom_cha = Number(query.parentId);
    }

    if (query?.search) {
      const keyword = query.search.trim();
      where.OR = [
        { ma_nhom_mo_rong: { contains: keyword } },
        { ten_hien_thi: { contains: keyword } },
      ];
    }

    const orderBy: any = {};
    const sortField =
      query?.sortBy === 'code' || query?.sortBy === 'extendedCode'
        ? 'ma_nhom_mo_rong'
        : query?.sortBy === 'name' || query?.sortBy === 'displayName'
          ? 'ten_hien_thi'
          : 'id';
    orderBy[sortField] = query?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, records] = await Promise.all([
      this.prisma.nhom_benh_mo_rong.count({ where }),
      this.prisma.nhom_benh_mo_rong.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          ma_nhom_mo_rong: true,
          ten_hien_thi: true,
          nguoi_dung_id: true,
          ma_nhom_cha: true,
          nhom_benh: {
            select: {
              id: true,
              ma_nhom: true,
              ten_nhom: true,
            },
          },
        },
      }),
    ]);

    const items: ExtendedDiseaseGroupResponseDto[] = records.map((r) => {
      const parentCode = r.nhom_benh?.ma_nhom ? `${r.nhom_benh.ma_nhom} - ` : '';
      return {
        id: r.id,
        extendedCode: r.ma_nhom_mo_rong || '',
        displayName: r.ten_hien_thi || '',
        userId: r.nguoi_dung_id || '',
        parentId: r.ma_nhom_cha || undefined,
        parentName: r.nhom_benh?.ten_nhom || '',
        fullCode: parentCode + (r.ma_nhom_mo_rong || ''),
      };
    });

    const result: PaginatedExtendedDiseaseGroupsResult = {
      items,
      total,
      page,
      limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(
        cacheKey,
        result,
        CACHE_TTL_LIST_SECONDS,
        CACHE_TAG_EXTENDED_DISEASE_GROUPS,
      );
    }

    return result;
  }

  /**
   * Lấy chi tiết nhóm bệnh mở rộng theo ID (chỉ của chính user)
   */
  async findById(id: number, userId: string): Promise<ExtendedDiseaseGroupResponseDto> {
    const record = await this.prisma.nhom_benh_mo_rong.findFirst({
      where: {
        id,
        nguoi_dung_id: userId,
      },
      select: {
        id: true,
        ma_nhom_mo_rong: true,
        ten_hien_thi: true,
        nguoi_dung_id: true,
        ma_nhom_cha: true,
        nhom_benh: {
          select: {
            id: true,
            ma_nhom: true,
            ten_nhom: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'DATA_001',
        message: 'error.data.not_found',
      });
    }

    const parentCode = record.nhom_benh?.ma_nhom ? `${record.nhom_benh.ma_nhom} - ` : '';
    return {
      id: record.id,
      extendedCode: record.ma_nhom_mo_rong || '',
      displayName: record.ten_hien_thi || '',
      userId: record.nguoi_dung_id || '',
      parentId: record.ma_nhom_cha || undefined,
      parentName: record.nhom_benh?.ten_nhom || '',
      fullCode: parentCode + (record.ma_nhom_mo_rong || ''),
    };
  }

  /**
   * Tạo mới nhóm bệnh mở rộng cho user hiện tại
   */
  async create(
    userId: string,
    dto: CreateExtendedDiseaseGroupDto,
  ): Promise<ExtendedDiseaseGroupResponseDto> {
    const parent = await this.prisma.nhom_benh.findUnique({
      where: { id: dto.parentId },
      select: { id: true, ma_nhom: true, ten_nhom: true },
    });

    if (!parent) {
      throw new NotFoundException({
        code: 'DATA_001',
        message: 'error.data.not_found',
      });
    }

    const extendedCode = dto.extendedCode.trim();
    const displayName = dto.displayName.trim();

    const created = await this.prisma.nhom_benh_mo_rong.create({
      data: {
        ma_nhom_mo_rong: extendedCode,
        ten_hien_thi: displayName,
        ma_nhom_cha: parent.id,
        nguoi_dung_id: userId,
      },
      select: {
        id: true,
        ma_nhom_mo_rong: true,
        ten_hien_thi: true,
        nguoi_dung_id: true,
        ma_nhom_cha: true,
      },
    });

    await this.invalidateCache();

    const parentCode = parent.ma_nhom ? `${parent.ma_nhom} - ` : '';
    return {
      id: created.id,
      extendedCode: created.ma_nhom_mo_rong || '',
      displayName: created.ten_hien_thi || '',
      userId: created.nguoi_dung_id || '',
      parentId: created.ma_nhom_cha || undefined,
      parentName: parent.ten_nhom || '',
      fullCode: parentCode + (created.ma_nhom_mo_rong || ''),
    };
  }

  /**
   * Cập nhật nhóm bệnh mở rộng của user
   */
  async update(
    id: number,
    userId: string,
    dto: UpdateExtendedDiseaseGroupDto,
  ): Promise<ExtendedDiseaseGroupResponseDto> {
    const existing = await this.prisma.nhom_benh_mo_rong.findFirst({
      where: {
        id,
        nguoi_dung_id: userId,
      },
      select: { id: true, ma_nhom_cha: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DATA_001',
        message: 'error.data.not_found',
      });
    }

    let parentId = existing.ma_nhom_cha;
    if (dto.parentId !== undefined) {
      const parent = await this.prisma.nhom_benh.findUnique({
        where: { id: dto.parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException({
          code: 'DATA_001',
          message: 'error.data.not_found',
        });
      }
      parentId = parent.id;
    }

    const updated = await this.prisma.nhom_benh_mo_rong.update({
      where: { id },
      data: {
        ...(dto.extendedCode && { ma_nhom_mo_rong: dto.extendedCode.trim() }),
        ...(dto.displayName && { ten_hien_thi: dto.displayName.trim() }),
        ...(dto.parentId !== undefined && { ma_nhom_cha: parentId }),
      },
      select: {
        id: true,
        ma_nhom_mo_rong: true,
        ten_hien_thi: true,
        nguoi_dung_id: true,
        ma_nhom_cha: true,
        nhom_benh: {
          select: {
            id: true,
            ma_nhom: true,
            ten_nhom: true,
          },
        },
      },
    });

    await this.invalidateCache();

    const parentCode = updated.nhom_benh?.ma_nhom ? `${updated.nhom_benh.ma_nhom} - ` : '';
    return {
      id: updated.id,
      extendedCode: updated.ma_nhom_mo_rong || '',
      displayName: updated.ten_hien_thi || '',
      userId: updated.nguoi_dung_id || '',
      parentId: updated.ma_nhom_cha || undefined,
      parentName: updated.nhom_benh?.ten_nhom || '',
      fullCode: parentCode + (updated.ma_nhom_mo_rong || ''),
    };
  }

  /**
   * Xóa nhóm bệnh mở rộng của user
   * - Proactive check _count trên thuc_don & de_xuat_thuc_don (EDG_001, 409)
   */
  async delete(id: number, userId: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.nhom_benh_mo_rong.findFirst({
      where: {
        id,
        nguoi_dung_id: userId,
      },
      select: {
        id: true,
        _count: {
          select: {
            thuc_don: true,
            de_xuat_thuc_don: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DATA_001',
        message: 'error.data.not_found',
      });
    }

    const menuCount = existing._count?.thuc_don ?? 0;
    const menuProposalCount = existing._count?.de_xuat_thuc_don ?? 0;

    if (menuCount > 0 || menuProposalCount > 0) {
      throw new ConflictException({
        code: 'EDG_001',
        message: 'error.extended_disease_group.in_use',
      });
    }

    await this.prisma.nhom_benh_mo_rong.delete({
      where: { id },
    });

    await this.invalidateCache();

    return {
      success: true,
      message: `Deleted ExtendedDiseaseGroup with id ${id}`,
    };
  }

  private async invalidateCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([CACHE_TAG_EXTENDED_DISEASE_GROUPS]);
    }
  }
}
