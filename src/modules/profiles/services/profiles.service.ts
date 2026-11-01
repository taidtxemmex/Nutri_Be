import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  CACHE_TTL_PERPETUAL,
  buildUserCacheTag,
} from '../../../config/constants/cache.constants';
import { DEFAULT_LIMIT } from '../../../config/constants/pagination.constants';
import { GetMyProfileParamsDto, UpdateMyProfileParamsDto, GetAllProfilesParamsDto } from '../dto';

export interface MyProfileResult {
  id: string;
  keycloakUserId: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  dob: string;
  avatarUrl: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface PaginatedProfilesResult {
  items: Array<{
    id: string;
    keycloakUserId: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    gender: string | null;
    address: string | null;
    dob: string;
    role: string;
    active: boolean;
  }>;
  totalItems: number;
  totalPages: number;
  page: number;
  size: number;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  private async findUserByIdOrKeycloakId<T = any>(
    targetId: string,
    select: Record<string, any>,
  ): Promise<T | null> {
    if (typeof (this.prisma.nguoi_dung as any)?.findFirst === 'function') {
      const found = await this.prisma.nguoi_dung.findFirst({
        where: {
          OR: [{ id: targetId }, { keycloak_user_id: targetId }],
        },
        select,
      });
      if (found) {
        return found as T;
      }
    }
    if (typeof this.prisma.nguoi_dung?.findUnique === 'function') {
      return (await this.prisma.nguoi_dung.findUnique({
        where: { id: targetId },
        select,
      })) as T | null;
    }
    return null;
  }

  /**
   * Lấy thông tin hồ sơ của người dùng hiện tại (có Cache 60s per detail)
   */
  async getMyProfile({ userId }: GetMyProfileParamsDto): Promise<MyProfileResult> {
    const cacheKey = this.cacheService?.generateKey({
      prefix: 'profiles:my',
      params: { userId },
    });
    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<MyProfileResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const user = await this.findUserByIdOrKeycloakId(userId, {
      id: true,
      ten_dang_nhap: true,
      vai_tro: true,
      active: true,
      keycloak_user_id: true,
      created_at: true,
      deleted_at: true,
      ho_so_ca_nhan: {
        select: {
          ho_ten: true,
          email: true,
          phone: true,
          dia_chi: true,
          gioi_tinh: true,
          ngay_sinh: true,
          avatar_url: true,
        },
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException(
        'Hồ sơ người dùng không tồn tại hoặc tài khoản đã bị vô hiệu hóa.',
      );
    }

    const dobStr = user.ho_so_ca_nhan?.ngay_sinh
      ? new Date(user.ho_so_ca_nhan.ngay_sinh).toISOString().split('T')[0]
      : '';

    const avatar =
      user.ho_so_ca_nhan?.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.ten_dang_nhap}`;

    const result = {
      id: user.id,
      keycloakUserId: user.keycloak_user_id || user.id,
      username: user.ten_dang_nhap,
      fullName: user.ho_so_ca_nhan?.ho_ten || user.ten_dang_nhap,
      email: user.ho_so_ca_nhan?.email || '',
      phone: user.ho_so_ca_nhan?.phone || '',
      address: user.ho_so_ca_nhan?.dia_chi || '',
      gender: user.ho_so_ca_nhan?.gioi_tinh || '',
      dob: dobStr,
      avatarUrl: avatar,
      avatar_url: user.ho_so_ca_nhan?.avatar_url || null,
      role: user.vai_tro,
      status: user.active ? 'active' : 'inactive',
      createdAt: user.created_at?.toISOString() || '',
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_PERPETUAL, [
        CACHE_TAG_PROFILES,
        buildUserCacheTag(user.id),
      ]);
    }

    return result;
  }

  /**
   * Cập nhật hồ sơ người dùng hiện tại (với Debounced Invalidation 500ms)
   */
  async updateMyProfile({ userId, dto }: UpdateMyProfileParamsDto) {
    const existingUser = await this.findUserByIdOrKeycloakId(userId, {
      id: true,
      deleted_at: true,
    });
    if (!existingUser || existingUser.deleted_at) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị vô hiệu hóa.',
      );
    }

    const actualUserId = existingUser.id;
    const dobValue = dto.dob || dto.birthDate;
    const dobDate = dobValue ? new Date(dobValue) : undefined;
    const avatarUrl = dto.avatarUrl || dto.avatar_url;

    await this.prisma.ho_so_ca_nhan.upsert({
      where: { nguoi_dung_id: actualUserId },
      create: {
        nguoi_dung_id: actualUserId,
        ho_ten: dto.fullName,
        phone: dto.phone,
        dia_chi: dto.address,
        gioi_tinh: dto.gender,
        ngay_sinh: dobDate,
        avatar_url: avatarUrl,
      },
      update: {
        ...(dto.fullName !== undefined && { ho_ten: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { dia_chi: dto.address }),
        ...(dto.gender !== undefined && { gioi_tinh: dto.gender }),
        ...(dobDate !== undefined && { ngay_sinh: dobDate }),
        ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
      },
    });

    // Invalidate Cache qua Debounce Buffer (gom cụm các thao tác liên tiếp)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(actualUserId),
      ]);
    }

    return {
      success: true,
      message: 'Cập nhật hồ sơ cá nhân thành công.',
    };
  }

  /**
   * Lấy danh sách hồ sơ cho Admin (Tương thích UserTable.jsx contract: res.data.data.items)
   */
  async getAllProfiles({ filter }: GetAllProfilesParamsDto): Promise<PaginatedProfilesResult> {
    const page = Math.max(0, Number(filter?.page ?? 0) || 0);
    const limit = Math.min(Math.max(1, Number(filter?.size) || DEFAULT_LIMIT), 5000);
    const skip = page * limit;

    const cacheKey = this.cacheService?.generateKey({
      prefix: 'profiles:list',
      params: {
        page,
        size: limit,
        keyword: filter?.keyword,
      },
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedProfilesResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {
      deleted_at: null,
    };
    if (filter?.keyword) {
      const keyword = filter.keyword.trim();
      // Hỗ trợ tìm kiếm theo cả số điện thoại (so_dien_thoai: { contains: keyword } / phone)
      where.OR = [
        { ten_dang_nhap: { contains: keyword } },
        { ho_so_ca_nhan: { ho_ten: { contains: keyword } } },
        { ho_so_ca_nhan: { email: { contains: keyword } } },
        { ho_so_ca_nhan: { phone: { contains: keyword } } },
      ];
    }

    const [users, countedTotal] = await Promise.all([
      this.prisma.nguoi_dung.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          ten_dang_nhap: true,
          vai_tro: true,
          active: true,
          keycloak_user_id: true,
          ho_so_ca_nhan: {
            select: {
              ho_ten: true,
              email: true,
              phone: true,
              gioi_tinh: true,
              dia_chi: true,
              ngay_sinh: true,
            },
          },
        },
      }),
      typeof (this.prisma.nguoi_dung as any).count === 'function'
        ? this.prisma.nguoi_dung.count({ where })
        : Promise.resolve(undefined),
    ]);

    const total = typeof countedTotal === 'number' ? countedTotal : users.length;

    const mappedItems = users.map((u) => {
      const p = u.ho_so_ca_nhan;
      return {
        id: u.id,
        keycloakUserId: u.keycloak_user_id || u.id,
        username: u.ten_dang_nhap,
        fullName: p?.ho_ten || u.ten_dang_nhap,
        email: p?.email || '',
        phone: p?.phone || '',
        gender: p?.gioi_tinh ?? null,
        address: p?.dia_chi ?? null,
        dob: p?.ngay_sinh ? new Date(p.ngay_sinh).toISOString().split('T')[0] : '',
        role: u.vai_tro,
        active: u.active,
      };
    });

    const result: PaginatedProfilesResult = {
      items: mappedItems,
      totalItems: total,
      totalPages: Math.ceil(total / limit) || 1,
      page: Number(filter?.page ?? 0),
      size: limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_PERPETUAL, CACHE_TAG_PROFILES);
    }

    return result;
  }

  async findAll(paramOrFilter?: GetAllProfilesParamsDto | any): Promise<PaginatedProfilesResult> {
    const filter =
      paramOrFilter && typeof paramOrFilter === 'object' && 'filter' in paramOrFilter
        ? paramOrFilter.filter
        : (paramOrFilter ?? {});
    return this.getAllProfiles({ filter });
  }
}
