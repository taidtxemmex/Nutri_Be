import { Injectable, NotFoundException, ConflictException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_EXTENDED_DISEASE_GROUPS,
  CACHE_TTL_PERPETUAL,
  buildExtendedDiseaseGroupCacheTag,
  buildExtendedDiseaseGroupDetailCacheKey,
} from '../../../config/constants/cache.constants';
import { normalizePagination } from '../../../common/dto/base-pagination-query.dto';
import {
  ExtendedDiseaseGroupResponseDto,
  FindExtendedDiseaseGroupsParamsDto,
  FindExtendedDiseaseGroupByIdParamsDto,
  CreateExtendedDiseaseGroupParamsDto,
  UpdateExtendedDiseaseGroupParamsDto,
  DeleteExtendedDiseaseGroupParamsDto,
} from '../dto';

import { PaginatedResult } from '../../../common/interfaces/pagination.interface';

export type PaginatedExtendedDiseaseGroupsResult = PaginatedResult<ExtendedDiseaseGroupResponseDto>;

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
  async findAll({
    userId,
    query,
  }: FindExtendedDiseaseGroupsParamsDto): Promise<PaginatedExtendedDiseaseGroupsResult> {
    const { page, limit, skip } = normalizePagination({
      query,
      defaultLimit: 1000,
      maxLimit: 1000,
    });

    const cacheKey = this.cacheService?.generateKey({
      prefix: `extended-disease-groups:${userId}`,
      params: {
        page,
        limit,
        parentId: query?.parentId,
        search: query?.search,
        sortBy: query?.sortBy,
        sortOrder: query?.sortOrder,
      },
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

    const items: ExtendedDiseaseGroupResponseDto[] = records.map((r) => ({
      id: r.id,
      extendedCode: r.ma_nhom_mo_rong || '',
      displayName: r.ten_hien_thi || '',
      userId: r.nguoi_dung_id || '',
      parentId: r.ma_nhom_cha || undefined,
      parentName: r.nhom_benh?.ten_nhom || '',
      fullCode: this.buildFullCode(r.ma_nhom_mo_rong, r.nhom_benh?.ma_nhom),
    }));

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
        CACHE_TTL_PERPETUAL,
        CACHE_TAG_EXTENDED_DISEASE_GROUPS,
      );
    }

    return result;
  }

  /**
   * Lấy chi tiết nhóm bệnh mở rộng theo ID
   */
  async findById({
    id,
    userId,
  }: FindExtendedDiseaseGroupByIdParamsDto): Promise<ExtendedDiseaseGroupResponseDto> {
    const cacheKey = userId
      ? `${buildExtendedDiseaseGroupDetailCacheKey(id)}:user:${userId}`
      : buildExtendedDiseaseGroupDetailCacheKey(id);

    if (this.cacheService) {
      const cached = await this.cacheService.get<ExtendedDiseaseGroupResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = { id };
    if (userId) {
      where.OR = [{ nguoi_dung_id: userId }, { nguoi_dung_id: null }];
    }

    const record = await this.prisma.nhom_benh_mo_rong.findFirst({
      where,
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

    const response: ExtendedDiseaseGroupResponseDto = {
      id: record.id,
      extendedCode: record.ma_nhom_mo_rong || '',
      displayName: record.ten_hien_thi || '',
      userId: record.nguoi_dung_id || '',
      parentId: record.ma_nhom_cha || undefined,
      parentName: record.nhom_benh?.ten_nhom || '',
      fullCode: this.buildFullCode(record.ma_nhom_mo_rong, record.nhom_benh?.ma_nhom),
    };

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, response, CACHE_TTL_PERPETUAL, [
        CACHE_TAG_EXTENDED_DISEASE_GROUPS,
        buildExtendedDiseaseGroupCacheTag(id),
      ]);
    }

    return response;
  }

  private buildFullCode(extendedCode?: string | null, parentCode?: string | null): string {
    const ext = (extendedCode || '').trim();
    const parent = (parentCode || '').trim();
    if (!parent) {
      return ext;
    }
    if (!ext) {
      return parent;
    }
    if (ext.toLowerCase().startsWith(`${parent.toLowerCase()}-`)) {
      return ext;
    }
    return `${parent}-${ext}`;
  }

  private stripParentCodePrefix(extendedCode: string, parentCode?: string | null): string {
    const trimmed = extendedCode.trim();
    const cleanParent = parentCode?.trim();
    if (!trimmed || !cleanParent) {
      return trimmed;
    }
    if (trimmed.toLowerCase().startsWith(`${cleanParent.toLowerCase()}-`)) {
      return trimmed.slice(`${cleanParent}-`.length).trim();
    }
    return trimmed;
  }

  /**
   * Tạo mới nhóm bệnh mở rộng cho user hiện tại
   */
  async create({
    userId,
    dto,
  }: CreateExtendedDiseaseGroupParamsDto): Promise<ExtendedDiseaseGroupResponseDto> {
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

    const rawExtendedCode = (
      typeof dto.getExtendedCode === 'function'
        ? dto.getExtendedCode()
        : dto.extendedCode || dto.maNhomBenh || dto.maNhomMoRong || ''
    ).trim();
    const extendedCode = this.stripParentCodePrefix(rawExtendedCode, parent.ma_nhom);
    const displayName = (
      typeof dto.getDisplayName === 'function'
        ? dto.getDisplayName()
        : dto.displayName || dto.tenNhomBenh || dto.tenHienThi || ''
    ).trim();

    const duplicate = await this.prisma.nhom_benh_mo_rong.findFirst({
      where: {
        nguoi_dung_id: userId,
        ma_nhom_mo_rong: extendedCode,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException({
        code: 'EDG_002',
        message: 'Mã nhóm mở rộng đã tồn tại',
      });
    }

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

    await this.invalidateCache({ id: created.id });

    return {
      id: created.id,
      extendedCode: created.ma_nhom_mo_rong || '',
      displayName: created.ten_hien_thi || '',
      userId: created.nguoi_dung_id || '',
      parentId: created.ma_nhom_cha || undefined,
      parentName: parent.ten_nhom || '',
      fullCode: this.buildFullCode(created.ma_nhom_mo_rong, parent.ma_nhom),
    };
  }

  /**
   * Cập nhật nhóm bệnh mở rộng của user
   */
  async update({
    id,
    userId,
    dto,
  }: UpdateExtendedDiseaseGroupParamsDto): Promise<ExtendedDiseaseGroupResponseDto> {
    const existing = await this.prisma.nhom_benh_mo_rong.findFirst({
      where: {
        id,
        nguoi_dung_id: userId,
      },
      select: {
        id: true,
        ma_nhom_cha: true,
        nhom_benh: {
          select: {
            ma_nhom: true,
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

    let parentId = existing.ma_nhom_cha;
    let parentMaNhom: string | null | undefined = existing.nhom_benh?.ma_nhom;
    if (dto.parentId !== undefined) {
      const parent = await this.prisma.nhom_benh.findUnique({
        where: { id: dto.parentId },
        select: { id: true, ma_nhom: true },
      });
      if (!parent) {
        throw new NotFoundException({
          code: 'DATA_001',
          message: 'error.data.not_found',
        });
      }
      parentId = parent.id;
      parentMaNhom = parent.ma_nhom;
    } else if (!parentMaNhom && parentId) {
      const parent = await this.prisma.nhom_benh.findUnique({
        where: { id: parentId },
        select: { ma_nhom: true },
      });
      parentMaNhom = parent?.ma_nhom;
    }

    const rawExtendedCode = (
      typeof dto.getExtendedCode === 'function'
        ? dto.getExtendedCode()
        : dto.extendedCode || dto.maNhomBenh || dto.maNhomMoRong || ''
    ).trim();
    const extendedCode = this.stripParentCodePrefix(rawExtendedCode, parentMaNhom);
    const displayName = (
      typeof dto.getDisplayName === 'function'
        ? dto.getDisplayName()
        : dto.displayName || dto.tenNhomBenh || dto.tenHienThi || ''
    ).trim();

    if (extendedCode) {
      const duplicate = await this.prisma.nhom_benh_mo_rong.findFirst({
        where: {
          nguoi_dung_id: userId,
          ma_nhom_mo_rong: extendedCode,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException({
          code: 'EDG_002',
          message: 'Mã nhóm mở rộng đã tồn tại',
        });
      }
    }

    const updated = await this.prisma.nhom_benh_mo_rong.update({
      where: { id },
      data: {
        ...(extendedCode && { ma_nhom_mo_rong: extendedCode }),
        ...(displayName && { ten_hien_thi: displayName }),
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

    await this.invalidateCache({ id: updated.id });

    return {
      id: updated.id,
      extendedCode: updated.ma_nhom_mo_rong || '',
      displayName: updated.ten_hien_thi || '',
      userId: updated.nguoi_dung_id || '',
      parentId: updated.ma_nhom_cha || undefined,
      parentName: updated.nhom_benh?.ten_nhom || '',
      fullCode: this.buildFullCode(updated.ma_nhom_mo_rong, updated.nhom_benh?.ma_nhom),
    };
  }

  /**
   * Xóa nhóm bệnh mở rộng của user
   * - Proactive check _count trên thuc_don, de_xuat_thuc_don, benh_nhan & benh_nhan_benh_an (EDG_001, 409)
   */
  async delete({
    id,
    userId,
  }: DeleteExtendedDiseaseGroupParamsDto): Promise<{ success: boolean; message: string }> {
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
            benh_nhan: true,
            benh_nhan_benh_an: true,
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
    const patientCount = existing._count?.benh_nhan ?? 0;
    const medicalRecordCount = existing._count?.benh_nhan_benh_an ?? 0;

    if (menuCount + menuProposalCount + patientCount + medicalRecordCount > 0) {
      throw new ConflictException({
        code: 'EDG_001',
        message: 'error.extended_disease_group.in_use',
      });
    }

    await this.prisma.nhom_benh_mo_rong.delete({
      where: { id },
    });

    await this.invalidateCache({ id });

    return {
      success: true,
      message: `Deleted ExtendedDiseaseGroup with id ${id}`,
    };
  }

  private async invalidateCache({ id }: { id?: number } = {}): Promise<void> {
    if (this.cacheService) {
      const tags = [CACHE_TAG_EXTENDED_DISEASE_GROUPS];
      if (id) {
        tags.push(buildExtendedDiseaseGroupCacheTag(id));
      }
      await this.cacheService.debouncedInvalidateTags(tags);
    }
  }
}
