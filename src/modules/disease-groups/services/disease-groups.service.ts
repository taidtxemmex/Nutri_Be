import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_DISEASE_GROUPS,
  CACHE_TTL_PERPETUAL,
  buildDiseaseGroupCacheTag,
  buildDiseaseGroupDetailCacheKey,
} from '../../../config/constants/cache.constants';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../../config/constants/pagination.constants';
import { normalizePagination } from '../../../common/dto/base-pagination-query.dto';
import {
  CreateDiseaseGroupDto,
  UpdateDiseaseGroupDto,
  DiseaseGroupQueryDto,
  DiseaseGroupResponseDto,
} from '../dto';

export interface PaginatedDiseaseGroupsResult {
  items: DiseaseGroupResponseDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DiseaseGroupsService {
  private readonly logger = new Logger(DiseaseGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Danh sách nhóm bệnh có phân trang (Anti-OOM, Lean Projection)
   * Tích hợp Perpetual Cache (Rule 23)
   */
  async findAll(query?: DiseaseGroupQueryDto): Promise<PaginatedDiseaseGroupsResult> {
    const { page, limit, skip } = normalizePagination(query);

    const cacheKey = this.cacheService?.generateKey('disease-groups:list', {
      page,
      limit,
      search: query?.search,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder,
    });

    const fetchDiseaseGroups = async (): Promise<PaginatedDiseaseGroupsResult> => {
      const where: any = {};
      if (query?.search) {
        const keyword = query.search.trim();
        where.OR = [{ ma_nhom: { contains: keyword } }, { ten_nhom: { contains: keyword } }];
      }

      const orderBy: any = {};
      const sortField =
        query?.sortBy === 'code' ? 'ma_nhom' : query?.sortBy === 'name' ? 'ten_nhom' : 'id';
      orderBy[sortField] = query?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const [total, records] = await Promise.all([
        this.prisma.nhom_benh.count({ where }),
        this.prisma.nhom_benh.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            ma_nhom: true,
            ten_nhom: true,
          },
        }),
      ]);

      const items: DiseaseGroupResponseDto[] = records.map((r) => ({
        id: r.id,
        code: r.ma_nhom || '',
        name: r.ten_nhom || '',
        maNhom: r.ma_nhom || '',
        tenNhom: r.ten_nhom || '',
      }));

      return {
        items,
        total,
        page,
        limit,
      };
    };

    if (this.cacheService && cacheKey) {
      if (typeof this.cacheService.getOrSet === 'function') {
        return this.cacheService.getOrSet(
          cacheKey,
          CACHE_TTL_PERPETUAL,
          fetchDiseaseGroups,
          CACHE_TAG_DISEASE_GROUPS,
        );
      }
      const cached = await this.cacheService.get<PaginatedDiseaseGroupsResult>(cacheKey);
      if (cached) return cached;
      const result = await fetchDiseaseGroups();
      await this.cacheService.set(cacheKey, result, CACHE_TTL_PERPETUAL, CACHE_TAG_DISEASE_GROUPS);
      return result;
    }

    return fetchDiseaseGroups();
  }

  /**
   * Lấy chi tiết nhóm bệnh theo ID (Shared Entity Cache / Identity Map)
   */
  async findById(id: number): Promise<DiseaseGroupResponseDto> {
    const fetchDiseaseGroup = async () => {
      const record = await this.prisma.nhom_benh.findUnique({
        where: { id },
        select: {
          id: true,
          ma_nhom: true,
          ten_nhom: true,
        },
      });

      if (!record) {
        throw new NotFoundException({
          code: 'DG_001',
          message: 'error.disease_group.not_found',
        });
      }

      return {
        id: record.id,
        code: record.ma_nhom || '',
        name: record.ten_nhom || '',
        maNhom: record.ma_nhom || '',
        tenNhom: record.ten_nhom || '',
      };
    };

    if (this.cacheService) {
      if (typeof this.cacheService.getOrSet === 'function') {
        return this.cacheService.getOrSet(
          buildDiseaseGroupDetailCacheKey(id),
          CACHE_TTL_PERPETUAL,
          fetchDiseaseGroup,
          [CACHE_TAG_DISEASE_GROUPS, buildDiseaseGroupCacheTag(id)],
        );
      }
      const cached = await this.cacheService.get<DiseaseGroupResponseDto>(
        buildDiseaseGroupDetailCacheKey(id),
      );
      if (cached) return cached;
      const result = await fetchDiseaseGroup();
      await this.cacheService.set(
        buildDiseaseGroupDetailCacheKey(id),
        result,
        CACHE_TTL_PERPETUAL,
        [CACHE_TAG_DISEASE_GROUPS, buildDiseaseGroupCacheTag(id)],
      );
      return result;
    }

    return fetchDiseaseGroup();
  }

  /**
   * Tạo mới nhóm bệnh
   */
  async create(dto: CreateDiseaseGroupDto): Promise<DiseaseGroupResponseDto> {
    const code = (
      typeof dto.getCode === 'function' ? dto.getCode() : dto.code || dto.maNhom || ''
    ).trim();
    const name = (
      typeof dto.getName === 'function' ? dto.getName() : dto.name || dto.tenNhom || ''
    ).trim();

    if (!code || !name) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Mã nhóm và tên nhóm bệnh không được để trống',
      });
    }

    const existing = await this.prisma.nhom_benh.findFirst({
      where: { ma_nhom: code },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'DG_003',
        message: 'Mã nhóm bệnh đã tồn tại trong hệ thống',
      });
    }

    const created = await this.prisma.nhom_benh.create({
      data: {
        ma_nhom: code,
        ten_nhom: name,
      },
      select: {
        id: true,
        ma_nhom: true,
        ten_nhom: true,
      },
    });

    await this.invalidateCache(created.id);

    return {
      id: created.id,
      code: created.ma_nhom || '',
      name: created.ten_nhom || '',
      maNhom: created.ma_nhom || '',
      tenNhom: created.ten_nhom || '',
    };
  }

  /**
   * Cập nhật nhóm bệnh
   */
  async update(id: number, dto: UpdateDiseaseGroupDto): Promise<DiseaseGroupResponseDto> {
    const existing = await this.prisma.nhom_benh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DG_001',
        message: 'error.disease_group.not_found',
      });
    }

    const code = (
      typeof dto.getCode === 'function' ? dto.getCode() : dto.code || dto.maNhom || ''
    ).trim();
    const name = (
      typeof dto.getName === 'function' ? dto.getName() : dto.name || dto.tenNhom || ''
    ).trim();

    if (code) {
      const duplicate = await this.prisma.nhom_benh.findFirst({
        where: {
          ma_nhom: code,
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException({
          code: 'DG_003',
          message: 'Mã nhóm bệnh đã tồn tại trong hệ thống',
        });
      }
    }

    const updated = await this.prisma.nhom_benh.update({
      where: { id },
      data: {
        ...(code && { ma_nhom: code }),
        ...(name && { ten_nhom: name }),
      },
      select: {
        id: true,
        ma_nhom: true,
        ten_nhom: true,
      },
    });

    await this.invalidateCache(id);

    return {
      id: updated.id,
      code: updated.ma_nhom || '',
      name: updated.ten_nhom || '',
      maNhom: updated.ma_nhom || '',
      tenNhom: updated.ten_nhom || '',
    };
  }

  /**
   * Xóa nhóm bệnh
   * - Proactive check _count trên nhom_benh_mo_rong (DG_002, 409)
   */
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.nhom_benh.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { nhom_benh_mo_rong: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DG_001',
        message: 'error.disease_group.not_found',
      });
    }

    const inUseCount = existing._count?.nhom_benh_mo_rong ?? 0;
    if (inUseCount > 0) {
      throw new ConflictException({
        code: 'DG_002',
        message: 'error.disease_group.in_use',
      });
    }

    await this.prisma.nhom_benh.delete({
      where: { id },
    });

    await this.invalidateCache(id);

    return {
      success: true,
      message: `Deleted DiseaseGroup with id ${id}`,
    };
  }

  private async invalidateCache(id?: number): Promise<void> {
    if (this.cacheService) {
      const tags = [CACHE_TAG_DISEASE_GROUPS];
      if (id !== undefined) {
        tags.push(buildDiseaseGroupCacheTag(id));
      }
      await this.cacheService.debouncedInvalidateTags(tags);
    }
  }
}
