import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { IdorDefenseService } from '../../../security/idor/idor-defense.service';
import { RefreshTokenRotationService } from '../../../security/token/refresh-token-rotation.service';
import { UserRole } from '../../../config/enums/role.enum';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  CACHE_TTL_DETAIL_SECONDS,
  CACHE_TTL_LIST_SECONDS,
  buildUserCacheTag,
} from '../../../config/constants/cache.constants';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../../config/constants/pagination.constants';
import { QueryUsersDto, UpdateUserInfoReqDto } from '../dto';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { UserInfoViewResponse } from '../interfaces/user-info-view.interface';

export interface PaginatedUsersResult {
  items: Array<{
    id: string;
    keycloakUserId: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    address: string;
    gender: string;
    dob: string;
    role: string;
    active: boolean;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface UserDetailResult {
  id: string;
  ten_dang_nhap: string;
  vai_tro: string;
  active: boolean;
  keycloak_user_id: string | null;
  created_at: Date | null;
  ho_so_ca_nhan: {
    ho_ten: string | null;
    email: string | null;
    phone: string | null;
    dia_chi: string | null;
    gioi_tinh: string | null;
    ngay_sinh: Date | null;
  } | null;
  nguoi_de_xuat: {
    trinh_do_hoc_van: string | null;
    nghe_nghiep: string | null;
    don_vi_cong_tac: string | null;
    vi_tri_cong_tac: string | null;
    linh_vuc_cong_tac: string | null;
  } | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idorDefenseService: IdorDefenseService,
    @Optional() private readonly cacheService?: CacheService,
    @Optional() private readonly refreshTokenRotationService?: RefreshTokenRotationService,
  ) {}

  /**
   * Danh sách người dùng có phân trang (Admin only) - Anti-Overfetching: Explicit select
   * Tích hợp Caching 15s và chuẩn hóa query params (Rule 23 & Rule 25)
   */
  async findAll(query: QueryUsersDto): Promise<PaginatedUsersResult> {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const cacheKey = this.cacheService?.generateKey('users:list', {
      page,
      limit,
      search: query.search,
      role: query.role,
      active: query.active,
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedUsersResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {
      deleted_at: null,
    };

    if (query.role) {
      where.vai_tro = query.role;
    }

    if (typeof query.active === 'boolean') {
      where.active = query.active;
    }

    if (query.search) {
      const keyword = query.search.trim();
      where.OR = [
        { ten_dang_nhap: { contains: keyword } },
        { ho_so_ca_nhan: { ho_ten: { contains: keyword } } },
        { ho_so_ca_nhan: { email: { contains: keyword } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.nguoi_dung.count({ where }),
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
          created_at: true,
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
      }),
    ]);

    const items = users.map((u) => ({
      id: u.id,
      keycloakUserId: u.keycloak_user_id || u.id,
      username: u.ten_dang_nhap,
      fullName: u.ho_so_ca_nhan?.ho_ten || u.ten_dang_nhap,
      email: u.ho_so_ca_nhan?.email || '',
      phone: u.ho_so_ca_nhan?.phone || '',
      address: u.ho_so_ca_nhan?.dia_chi || '',
      gender: u.ho_so_ca_nhan?.gioi_tinh || '',
      dob: u.ho_so_ca_nhan?.ngay_sinh
        ? new Date(u.ho_so_ca_nhan.ngay_sinh).toISOString().split('T')[0]
        : '',
      role: u.vai_tro,
      active: u.active,
      createdAt: u.created_at?.toISOString() || '',
    }));

    const result = {
      items,
      total,
      page,
      limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_LIST_SECONDS, CACHE_TAG_USERS);
    }

    return result;
  }

  /**
   * Lấy chi tiết tài khoản theo ID - Explicit select (có Cache 60s)
   */
  async findById(id: string): Promise<UserDetailResult> {
    const cacheKey = this.cacheService?.generateKey('users:detail', { id });
    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<UserDetailResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id },
      select: {
        id: true,
        ten_dang_nhap: true,
        vai_tro: true,
        active: true,
        keycloak_user_id: true,
        created_at: true,
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
        nguoi_de_xuat: {
          select: {
            trinh_do_hoc_van: true,
            nghe_nghiep: true,
            don_vi_cong_tac: true,
            vi_tri_cong_tac: true,
            linh_vuc_cong_tac: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng với ID này.');
    }

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, user, CACHE_TTL_DETAIL_SECONDS, buildUserCacheTag(id));
    }

    return user;
  }

  /**
   * Lấy chi tiết thông tin của người dùng hiện tại (/users/me)
   */
  async getMe(currentUserId: string) {
    const user = await this.findById(currentUserId);
    const dobStr = user.ho_so_ca_nhan?.ngay_sinh
      ? new Date(user.ho_so_ca_nhan.ngay_sinh).toISOString().split('T')[0]
      : '';

    return {
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
      career: user.nguoi_de_xuat
        ? {
            education: user.nguoi_de_xuat.trinh_do_hoc_van || '',
            major: user.nguoi_de_xuat.nghe_nghiep || '',
            unit: user.nguoi_de_xuat.don_vi_cong_tac || '',
            position: user.nguoi_de_xuat.vi_tri_cong_tac || '',
            field: user.nguoi_de_xuat.linh_vuc_cong_tac || '',
          }
        : null,
    };
  }

  /**
   * Vá lỗ hổng IDOR PII - Trả đúng schema { viewUser, viewJob } cho InfomationUser.jsx
   */
  async getUserInfo(
    targetUserId: string,
    currentUser: AuthenticatedUser,
  ): Promise<UserInfoViewResponse> {
    // 1. Kiểm tra IDOR Defense
    this.idorDefenseService.assertUserOwnershipOrAdmin(
      currentUser.id,
      currentUser.role,
      targetUserId,
    );

    const cacheKey = this.cacheService?.generateKey('users:info', { targetUserId });
    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<UserInfoViewResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. Explicit select dữ liệu từ database (Anti-Overfetching)
    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        ten_dang_nhap: true,
        vai_tro: true,
        active: true,
        created_at: true,
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
        nguoi_de_xuat: {
          select: {
            trinh_do_hoc_van: true,
            nghe_nghiep: true,
            don_vi_cong_tac: true,
            vi_tri_cong_tac: true,
            linh_vuc_cong_tac: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng.');
    }

    const dobStr = user.ho_so_ca_nhan?.ngay_sinh
      ? new Date(user.ho_so_ca_nhan.ngay_sinh).toISOString().split('T')[0]
      : '';

    const result: UserInfoViewResponse = {
      viewUser: {
        id: user.id,
        username: user.ten_dang_nhap,
        fullName: user.ho_so_ca_nhan?.ho_ten || user.ten_dang_nhap,
        email: user.ho_so_ca_nhan?.email || '',
        phone: user.ho_so_ca_nhan?.phone || '',
        address: user.ho_so_ca_nhan?.dia_chi || '',
        gender: user.ho_so_ca_nhan?.gioi_tinh || '',
        dob: dobStr,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.ten_dang_nhap}`,
        createdAt: user.created_at ? user.created_at.toISOString() : '',
        role: user.vai_tro,
        status: user.active ? 'active' : 'inactive',
      },
      viewJob: {
        education: user.nguoi_de_xuat?.trinh_do_hoc_van || '',
        major: user.nguoi_de_xuat?.nghe_nghiep || '',
        unit: user.nguoi_de_xuat?.don_vi_cong_tac || '',
        field: user.nguoi_de_xuat?.linh_vuc_cong_tac || '',
        position: user.nguoi_de_xuat?.vi_tri_cong_tac || '',
      },
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(
        cacheKey,
        result,
        CACHE_TTL_DETAIL_SECONDS,
        buildUserCacheTag(targetUserId),
      );
    }

    return result;
  }

  /**
   * Cập nhật thông tin cá nhân & nghề nghiệp (Hỗ trợ cả /users/me và alias /api/users/update-info)
   */
  async updateUserInfo(
    dto: UpdateUserInfoReqDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const targetId = dto.userId || dto.keycloakUserId || currentUser.id;

    // Kiểm tra IDOR Defense
    this.idorDefenseService.assertUserOwnershipOrAdmin(currentUser.id, currentUser.role, targetId);

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    const dobValue = dto.dob || dto.birthDate;
    const dobDate = dobValue ? new Date(dobValue) : undefined;

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật hồ sơ cá nhân
      await tx.ho_so_ca_nhan.upsert({
        where: { nguoi_dung_id: targetId },
        create: {
          nguoi_dung_id: targetId,
          ho_ten: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          dia_chi: dto.address,
          gioi_tinh: dto.gender,
          ngay_sinh: dobDate,
        },
        update: {
          ...(dto.fullName !== undefined && { ho_ten: dto.fullName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.address !== undefined && { dia_chi: dto.address }),
          ...(dto.gender !== undefined && { gioi_tinh: dto.gender }),
          ...(dobDate !== undefined && { ngay_sinh: dobDate }),
        },
      });

      // 2. Cập nhật thông tin chuyên môn nếu có
      if (
        dto.education !== undefined ||
        dto.major !== undefined ||
        dto.unit !== undefined ||
        dto.position !== undefined ||
        dto.field !== undefined
      ) {
        await tx.nguoi_de_xuat.upsert({
          where: { nguoi_dung_id: targetId },
          create: {
            nguoi_dung_id: targetId,
            trinh_do_hoc_van: dto.education,
            nghe_nghiep: dto.major,
            don_vi_cong_tac: dto.unit,
            vi_tri_cong_tac: dto.position,
            linh_vuc_cong_tac: dto.field,
          },
          update: {
            ...(dto.education !== undefined && { trinh_do_hoc_van: dto.education }),
            ...(dto.major !== undefined && { nghe_nghiep: dto.major }),
            ...(dto.unit !== undefined && { don_vi_cong_tac: dto.unit }),
            ...(dto.position !== undefined && { vi_tri_cong_tac: dto.position }),
            ...(dto.field !== undefined && { linh_vuc_cong_tac: dto.field }),
          },
        });
      }
    });

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(targetId),
      ]);
    }

    return {
      success: true,
      message: 'Cập nhật thông tin người dùng thành công.',
    };
  }

  /**
   * Cập nhật vai trò người dùng (Admin only)
   */
  async updateRole(
    targetUserId: string,
    newRole: UserRole,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string; role: string }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: targetUserId },
      select: { id: true, vai_tro: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng cần phân quyền.');
    }

    await this.prisma.nguoi_dung.update({
      where: { id: targetUserId },
      data: {
        vai_tro: newRole,
      },
    });

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(targetUserId),
      ]);
    }

    return {
      success: true,
      message: `Phân quyền người dùng thành ${newRole} thành công.`,
      role: newRole,
    };
  }

  /**
   * Cập nhật trạng thái hoạt động (active) của người dùng (Admin only)
   */
  async updateStatus(
    targetUserId: string,
    isActive: boolean,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string; active: boolean }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng cần cập nhật trạng thái.');
    }

    await this.prisma.nguoi_dung.update({
      where: { id: targetUserId },
      data: {
        active: isActive,
      },
    });

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(targetUserId),
      ]);
    }

    return {
      success: true,
      message: `Cập nhật trạng thái người dùng thành ${isActive ? 'kích hoạt' : 'khóa'} thành công.`,
      active: isActive,
    };
  }

  /**
   * Kiểm tra người dùng đã hoàn thiện hồ sơ chưa (Tương thích FE cũ: check-profile)
   */
  async checkProfile(userId: string): Promise<{ profileComplete: boolean }> {
    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: userId },
      select: { profile_completed: true, deleted_at: true },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException('Không tìm thấy người dùng hoặc tài khoản đã bị vô hiệu hóa.');
    }

    return {
      profileComplete: Boolean(user.profile_completed),
    };
  }

  /**
   * Xóa mềm người dùng và thu hồi toàn bộ Refresh Token (Admin only)
   */
  async softDeleteUser(
    targetUserId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: targetUserId },
      select: { id: true, active: true, deleted_at: true },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException('Không tìm thấy người dùng hoặc tài khoản đã bị xóa trước đó.');
    }

    await this.prisma.nguoi_dung.update({
      where: { id: targetUserId },
      data: {
        active: false,
        deleted_at: new Date(),
      },
    });

    // Thu hồi toàn bộ Refresh Token của user bị xóa mềm
    if (this.refreshTokenRotationService) {
      await this.refreshTokenRotationService.revokeAllUserTokens(targetUserId);
    }

    // Invalidate Cache gom cụm 500ms
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(targetUserId),
      ]);
    }

    return {
      success: true,
      message: 'Xóa mềm người dùng và thu hồi toàn bộ phiên đăng nhập thành công.',
    };
  }
}
