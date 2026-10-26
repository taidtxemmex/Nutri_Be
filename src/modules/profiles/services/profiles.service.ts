import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  CACHE_TTL_DETAIL_SECONDS,
  CACHE_TTL_LIST_SECONDS,
  buildUserCacheTag,
} from '../../../config/constants/cache.constants';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../../config/constants/pagination.constants';
import { ProfileFilterDto, UpdateProfileDto } from '../dto';

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
    fullName: string;
    email: string;
    phone: string;
    dob: string;
    role: string;
    active: boolean;
  }>;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Lấy thông tin hồ sơ của người dùng hiện tại (có Cache 60s per detail)
   */
  async getMyProfile(userId: string): Promise<MyProfileResult> {
    const cacheKey = this.cacheService?.generateKey('profiles:my', { userId });
    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<MyProfileResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: userId },
      select: {
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
          },
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
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.ten_dang_nhap}`,
      role: user.vai_tro,
      status: user.active ? 'active' : 'inactive',
      createdAt: user.created_at?.toISOString() || '',
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(
        cacheKey,
        result,
        CACHE_TTL_DETAIL_SECONDS,
        buildUserCacheTag(userId),
      );
    }

    return result;
  }

  /**
   * Cập nhật hồ sơ người dùng hiện tại (với Debounced Invalidation 500ms)
   */
  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.nguoi_dung.findUnique({
      where: { id: userId },
      select: { id: true, deleted_at: true },
    });
    if (!existingUser || existingUser.deleted_at) {
      throw new NotFoundException(
        'Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị vô hiệu hóa.',
      );
    }

    const dobValue = dto.dob || dto.birthDate;
    const dobDate = dobValue ? new Date(dobValue) : undefined;

    await this.prisma.ho_so_ca_nhan.upsert({
      where: { nguoi_dung_id: userId },
      create: {
        nguoi_dung_id: userId,
        ho_ten: dto.fullName,
        phone: dto.phone,
        dia_chi: dto.address,
        gioi_tinh: dto.gender,
        ngay_sinh: dobDate,
      },
      update: {
        ...(dto.fullName !== undefined && { ho_ten: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { dia_chi: dto.address }),
        ...(dto.gender !== undefined && { gioi_tinh: dto.gender }),
        ...(dobDate !== undefined && { ngay_sinh: dobDate }),
      },
    });

    // Invalidate Cache qua Debounce Buffer (gom cụm các thao tác liên tiếp)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(userId),
      ]);
    }

    return {
      success: true,
      message: 'Cập nhật hồ sơ cá nhân thành công.',
    };
  }

  /**
   * Lấy danh sách hồ sơ cho Admin (Tương thích UserTable.jsx contract: res.data.data.items)
   * Anti-OOM: Bounded take <= MAX_LIMIT (100)
   * Cache 15s có chuẩn hóa query params (Rule 23 & Rule 25)
   */
  async getAllProfiles(filter: ProfileFilterDto): Promise<PaginatedProfilesResult> {
    const page = Math.max(0, Number(filter.page) || 0);
    const size = Math.min(MAX_LIMIT, Math.max(1, Number(filter.size) || DEFAULT_LIMIT));
    const skip = page * size;

    const cacheKey = this.cacheService?.generateKey('profiles:list', {
      page,
      size,
      keyword: filter.keyword,
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
    if (filter.keyword) {
      const keyword = filter.keyword.trim();
      where.OR = [
        { ten_dang_nhap: { contains: keyword } },
        { ho_so_ca_nhan: { ho_ten: { contains: keyword } } },
        { ho_so_ca_nhan: { email: { contains: keyword } } },
      ];
    }

    const users = await this.prisma.nguoi_dung.findMany({
      where,
      skip,
      take: size,
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
            ngay_sinh: true,
          },
        },
      },
    });

    const items = users.map((u) => ({
      id: u.id,
      keycloakUserId: u.keycloak_user_id || u.id,
      username: u.ten_dang_nhap,
      fullName: u.ho_so_ca_nhan?.ho_ten || u.ten_dang_nhap,
      email: u.ho_so_ca_nhan?.email || '',
      phone: u.ho_so_ca_nhan?.phone || '',
      dob: u.ho_so_ca_nhan?.ngay_sinh
        ? new Date(u.ho_so_ca_nhan.ngay_sinh).toISOString().split('T')[0]
        : '',
      role: u.vai_tro,
      active: u.active,
    }));

    const result = {
      items,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_LIST_SECONDS, CACHE_TAG_PROFILES);
    }

    return result;
  }
}
