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
  CACHE_TAG_CATEGORIES,
  CACHE_TTL_LIST_SECONDS,
  CACHE_TTL_LOOKUP_SECONDS,
} from '../../../config/constants/cache.constants';
import {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../../config/constants/pagination.constants';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryQueryDto,
  CategoryResponseDto,
} from '../dto';

export interface PaginatedCategoriesResult {
  items: CategoryResponseDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Danh sách danh mục phân trang kèm tìm kiếm (Anti-OOM: max 100 items, Lean Projection)
   */
  async findAll(query?: CategoryQueryDto): Promise<PaginatedCategoriesResult> {
    const page = Math.max(1, Number(query?.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query?.limit) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const cacheKey = this.cacheService?.generateKey('categories:list', {
      page,
      limit,
      search: query?.search,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder,
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedCategoriesResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {};
    if (query?.search) {
      const keyword = query.search.trim();
      where.ten_danh_muc = { contains: keyword };
    }

    const orderBy: any = {};
    const sortField =
      query?.sortBy === 'categoryName' || query?.sortBy === 'name' ? 'ten_danh_muc' : 'id';
    orderBy[sortField] = query?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, records] = await Promise.all([
      this.prisma.danh_muc.count({ where }),
      this.prisma.danh_muc.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          ten_danh_muc: true,
        },
      }),
    ]);

    const items: CategoryResponseDto[] = records.map((r) => ({
      id: r.id,
      categoryName: r.ten_danh_muc || '',
      tenDanhMuc: r.ten_danh_muc || '',
    }));

    const result: PaginatedCategoriesResult = {
      items,
      total,
      page,
      limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_LIST_SECONDS, CACHE_TAG_CATEGORIES);
    }

    return result;
  }

  /**
   * Public lookup endpoint phục vụ dropdown / combobox với TTL 30 phút (Rule 23)
   */
  async getPublicLookup(): Promise<CategoryResponseDto[]> {
    const cacheKey = 'cache:categories:lookup';

    if (this.cacheService) {
      const cached = await this.cacheService.get<CategoryResponseDto[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const records = await this.prisma.danh_muc.findMany({
      orderBy: { ten_danh_muc: 'asc' },
      select: {
        id: true,
        ten_danh_muc: true,
      },
    });

    const items: CategoryResponseDto[] = records.map((r) => ({
      id: r.id,
      categoryName: r.ten_danh_muc || '',
      tenDanhMuc: r.ten_danh_muc || '',
    }));

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, items, CACHE_TTL_LOOKUP_SECONDS, CACHE_TAG_CATEGORIES);
    }

    return items;
  }

  /**
   * Lấy chi tiết danh mục theo ID
   */
  async findById(id: number): Promise<CategoryResponseDto> {
    const record = await this.prisma.danh_muc.findUnique({
      where: { id },
      select: {
        id: true,
        ten_danh_muc: true,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'PROP_007',
        message: 'error.category.not_found',
      });
    }

    return {
      id: record.id,
      categoryName: record.ten_danh_muc || '',
      tenDanhMuc: record.ten_danh_muc || '',
    };
  }

  /**
   * Tạo mới danh mục
   * - Trim whitespace
   * - Check trùng tên (CAT_001, 400)
   * - Invalidate Cache tag: categories
   */
  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const name = (
      typeof dto.getName === 'function' ? dto.getName() : dto.categoryName || dto.tenDanhMuc || ''
    ).trim();
    if (!name) {
      throw new BadRequestException({
        code: 'CAT_001',
        message: 'Tên danh mục không được để trống',
      });
    }

    const existing = await this.prisma.danh_muc.findFirst({
      where: {
        ten_danh_muc: name,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'CAT_001',
        message: 'error.category.already_exists',
      });
    }

    const created = await this.prisma.danh_muc.create({
      data: {
        ten_danh_muc: name,
      },
      select: {
        id: true,
        ten_danh_muc: true,
      },
    });

    await this.invalidateCategoryCache();

    return {
      id: created.id,
      categoryName: created.ten_danh_muc || '',
      tenDanhMuc: created.ten_danh_muc || '',
    };
  }

  /**
   * Cập nhật danh mục
   * - Kiểm tra tồn tại (PROP_007, 404)
   * - Check trùng tên khác ID (CAT_001, 400)
   * - Invalidate Cache tag: categories
   */
  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existing = await this.prisma.danh_muc.findUnique({
      where: { id },
      select: { id: true, ten_danh_muc: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PROP_007',
        message: 'error.category.not_found',
      });
    }

    const name = (
      typeof dto.getName === 'function' ? dto.getName() : dto.categoryName || dto.tenDanhMuc || ''
    ).trim();
    if (!name) {
      throw new BadRequestException({
        code: 'CAT_001',
        message: 'Tên danh mục không được để trống',
      });
    }

    const duplicate = await this.prisma.danh_muc.findFirst({
      where: {
        ten_danh_muc: name,
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new BadRequestException({
        code: 'CAT_001',
        message: 'error.category.already_exists',
      });
    }

    const updated = await this.prisma.danh_muc.update({
      where: { id },
      data: {
        ten_danh_muc: name,
      },
      select: {
        id: true,
        ten_danh_muc: true,
      },
    });

    await this.invalidateCategoryCache();

    return {
      id: updated.id,
      categoryName: updated.ten_danh_muc || '',
      tenDanhMuc: updated.ten_danh_muc || '',
    };
  }

  /**
   * Xóa danh mục
   * - Kiểm tra tồn tại (PROP_007, 404)
   * - Proactive check _count trên nguyen_lieu & de_xuat_nguyen_lieu (CAT_002, 409)
   * - Invalidate Cache tag: categories
   */
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.danh_muc.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            nguyen_lieu_nguyen_lieu_danh_mucTodanh_muc: true,
            de_xuat_nguyen_lieu_de_xuat_nguyen_lieu_danh_mucTodanh_muc: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PROP_007',
        message: 'error.category.not_found',
      });
    }

    const ingredientCount = existing._count?.nguyen_lieu_nguyen_lieu_danh_mucTodanh_muc ?? 0;
    const proposalCount =
      existing._count?.de_xuat_nguyen_lieu_de_xuat_nguyen_lieu_danh_mucTodanh_muc ?? 0;

    if (ingredientCount > 0 || proposalCount > 0) {
      throw new ConflictException({
        code: 'CAT_002',
        message: 'error.category.in_use',
      });
    }

    await this.prisma.danh_muc.delete({
      where: { id },
    });

    await this.invalidateCategoryCache();

    return {
      success: true,
      message: `Xóa thành công category id: ${id}`,
    };
  }

  private async invalidateCategoryCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([CACHE_TAG_CATEGORIES]);
    }
  }
}
