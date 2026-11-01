import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Prisma, nguoi_de_xuat } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { IdorDefenseService } from '../../../security/idor/idor-defense.service';
import { RefreshTokenRotationService } from '../../../security/token/refresh-token-rotation.service';
import { UserRole } from '../../../config/enums/role.enum';
import { AuthProvider } from '../../../config/enums/domain.enum';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  CACHE_TTL_DETAIL_SECONDS,
  CACHE_TTL_PERPETUAL,
  buildUserAuthCacheKey,
  buildUserCacheTag,
  buildUserDetailCacheKey,
} from '../../../config/constants/cache.constants';
import { normalizePagination } from '../../../common/dto/base-pagination-query.dto';
import {
  QueryUsersDto,
  FindAllUsersParamsDto,
  FindUserByIdParamsDto,
  GetMeParamsDto,
  GetUserInfoParamsDto,
  UpdateUserInfoParamsDto,
  UpdateUserRoleParamsDto,
  UpdateUserStatusParamsDto,
  CheckProfileParamsDto,
  SoftDeleteUserParamsDto,
  SoftDeleteBatchParamsDto,
  UpdateStatusBatchParamsDto,
  CreateBatchUsersParamsDto,
} from '../dto';
import { UserInfoViewResponse } from '../interfaces/user-info-view.interface';

import { PaginatedResult } from '../../../common/interfaces/pagination.interface';

export interface UserListItem {
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
}

export type PaginatedUsersResult = PaginatedResult<UserListItem>;

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

export interface FoundUserResult {
  id: string;
  ten_dang_nhap?: string;
  vai_tro?: string;
  active?: boolean | null;
  deleted_at?: Date | null;
  created_at?: Date | null;
  profile_completed?: boolean | null;
  keycloak_user_id?: string | null;
  ho_so_ca_nhan?: {
    ho_ten?: string | null;
    email?: string | null;
    phone?: string | null;
    dia_chi?: string | null;
    gioi_tinh?: string | null;
    ngay_sinh?: Date | string | null;
  } | null;
  nguoi_de_xuat?: {
    trinh_do_hoc_van?: string | null;
    nghe_nghiep?: string | null;
    don_vi_cong_tac?: string | null;
    vi_tri_cong_tac?: string | null;
    linh_vuc_cong_tac?: string | null;
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
  async findAll({ query = {} }: FindAllUsersParamsDto = {}): Promise<PaginatedUsersResult> {
    const { page, limit, skip } = normalizePagination(query as QueryUsersDto);

    const cacheKey = this.cacheService?.generateKey({
      prefix: 'users:list',
      params: {
        page,
        limit,
        search: query.search,
        role: query.role,
        active: query.active,
      },
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<PaginatedUsersResult>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: Prisma.nguoi_dungWhereInput = {
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
      // Hỗ trợ tìm kiếm theo cả số điện thoại (so_dien_thoai: { contains: keyword } / phone)
      where.OR = [
        { ten_dang_nhap: { contains: keyword } },
        { ho_so_ca_nhan: { ho_ten: { contains: keyword } } },
        { ho_so_ca_nhan: { email: { contains: keyword } } },
        { ho_so_ca_nhan: { phone: { contains: keyword } } },
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
      await this.cacheService.set(cacheKey, result, CACHE_TTL_PERPETUAL, CACHE_TAG_USERS);
    }

    return result;
  }

  private isNonEmptyString(val: unknown): boolean {
    return typeof val === 'string' && val.trim().length > 0;
  }

  /**
   * Kiểm tra hồ sơ đã hoàn thiện đủ 7 trường bắt buộc theo chuẩn Java UserServiceImpl.isProfileComplete
   */
  private isProfileComplete(
    profile?: {
      ho_ten?: string | null;
      fullName?: string | null;
      ngay_sinh?: unknown;
      gioi_tinh?: string | null;
      gender?: string | null;
      phone?: string | null;
      so_dien_thoai?: string | null;
      phoneNumber?: string | null;
      email?: string | null;
    } | null,
    proposer?: {
      don_vi_cong_tac?: string | null;
      unit?: string | null;
      workUnit?: string | null;
      vi_tri_cong_tac?: string | null;
      chuc_vu?: string | null;
      position?: string | null;
    } | null,
  ): boolean {
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

  /**
   * Tra cứu người dùng theo id hoặc keycloak_user_id (hỗ trợ tài khoản từ Java cũ có id != keycloak_user_id)
   */
  private async findUserByIdOrKeycloakId<T = FoundUserResult>(
    targetId: string,
    select: Prisma.nguoi_dungSelect,
    client: {
      nguoi_dung?: {
        findFirst?: (args: {
          where: Prisma.nguoi_dungWhereInput;
          select: Prisma.nguoi_dungSelect;
        }) => Promise<unknown>;
        findUnique?: (args: {
          where: Prisma.nguoi_dungWhereUniqueInput;
          select: Prisma.nguoi_dungSelect;
        }) => Promise<unknown>;
      };
    } = this.prisma,
  ): Promise<T | null> {
    if (typeof client.nguoi_dung?.findFirst === 'function') {
      const found = await client.nguoi_dung.findFirst({
        where: {
          OR: [{ id: targetId }, { keycloak_user_id: targetId }],
        },
        select,
      });
      if (found) {
        return found as T;
      }
    }
    if (typeof client.nguoi_dung?.findUnique === 'function') {
      return (await client.nguoi_dung.findUnique({
        where: { id: targetId },
        select,
      })) as T | null;
    }
    return null;
  }

  /**
   * Lấy chi tiết tài khoản theo ID - Tích hợp Shared Entity Cache (Identity Map) vĩnh viễn
   */
  async findById({ id }: FindUserByIdParamsDto): Promise<UserDetailResult> {
    const fetchUser = async () => {
      const user = await this.findUserByIdOrKeycloakId<UserDetailResult>(id, {
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
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng với ID này.');
      }

      return user;
    };

    if (this.cacheService) {
      return this.cacheService.getOrSet<UserDetailResult>(
        buildUserDetailCacheKey(id),
        CACHE_TTL_PERPETUAL,
        fetchUser,
        [CACHE_TAG_USERS, buildUserCacheTag(id)],
      );
    }

    return fetchUser();
  }

  /**
   * Lấy chi tiết thông tin của người dùng hiện tại (/users/me)
   */
  async getMe({ currentUserId }: GetMeParamsDto) {
    const user = await this.findById({ id: currentUserId });
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
  async getUserInfo({
    targetUserId,
    currentUser,
  }: GetUserInfoParamsDto): Promise<UserInfoViewResponse> {
    const normalizedTargetForIdor =
      targetUserId && currentUser.keycloakUserId && targetUserId === currentUser.keycloakUserId
        ? currentUser.id
        : targetUserId;

    // 1. Kiểm tra IDOR Defense
    this.idorDefenseService.assertUserOwnershipOrAdmin({
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role,
      targetUserId: normalizedTargetForIdor,
    });

    const lookupId = targetUserId || currentUser.id;

    const cacheKey = this.cacheService?.generateKey({
      prefix: 'users:info',
      params: { targetUserId: lookupId },
    });
    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<UserInfoViewResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. Explicit select dữ liệu từ database theo id hoặc keycloak_user_id (Anti-Overfetching)
    const user = await this.findUserByIdOrKeycloakId(lookupId, {
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
        buildUserCacheTag(user.id),
      );
    }

    return result;
  }

  /**
   * Cập nhật thông tin cá nhân & nghề nghiệp (Hỗ trợ cả /users/me và alias /api/users/update-info)
   */
  async updateUserInfo({
    dto,
    currentUser,
  }: UpdateUserInfoParamsDto): Promise<{ success: boolean; message: string }> {
    const rawTargetId = dto.userId || dto.keycloakUserId || currentUser.id;
    const normalizedTargetForIdor =
      rawTargetId && currentUser.keycloakUserId && rawTargetId === currentUser.keycloakUserId
        ? currentUser.id
        : rawTargetId;

    // Kiểm tra IDOR Defense
    this.idorDefenseService.assertUserOwnershipOrAdmin({
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role,
      targetUserId: normalizedTargetForIdor,
    });

    const user = await this.findUserByIdOrKeycloakId(rawTargetId, {
      id: true,
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
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    const actualUserId = user.id;
    const dobValue = dto.dob || dto.birthDate;
    const dobDate = dobValue ? new Date(dobValue) : undefined;
    const unitValue = dto.unit ?? dto.workUnit;

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật hồ sơ cá nhân
      const upsertedProfile = await tx.ho_so_ca_nhan.upsert({
        where: { nguoi_dung_id: actualUserId },
        create: {
          nguoi_dung_id: actualUserId,
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
      let upsertedProposer: nguoi_de_xuat | null = null;
      if (
        dto.education !== undefined ||
        dto.major !== undefined ||
        unitValue !== undefined ||
        dto.position !== undefined ||
        dto.field !== undefined
      ) {
        upsertedProposer = await tx.nguoi_de_xuat.upsert({
          where: { nguoi_dung_id: actualUserId },
          create: {
            nguoi_dung_id: actualUserId,
            trinh_do_hoc_van: dto.education,
            nghe_nghiep: dto.major,
            don_vi_cong_tac: unitValue,
            vi_tri_cong_tac: dto.position,
            linh_vuc_cong_tac: dto.field,
          },
          update: {
            ...(dto.education !== undefined && { trinh_do_hoc_van: dto.education }),
            ...(dto.major !== undefined && { nghe_nghiep: dto.major }),
            ...(unitValue !== undefined && { don_vi_cong_tac: unitValue }),
            ...(dto.position !== undefined && { vi_tri_cong_tac: dto.position }),
            ...(dto.field !== undefined && { linh_vuc_cong_tac: dto.field }),
          },
        });
      }

      // 3. Kiểm tra 7 trường bắt buộc và cập nhật nguoi_dung.profile_completed ngay trong transaction
      const mergedProfile = {
        ...(user.ho_so_ca_nhan || {}),
        ...(upsertedProfile || {}),
        ...(dto.fullName !== undefined && { ho_ten: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { dia_chi: dto.address }),
        ...(dto.gender !== undefined && { gioi_tinh: dto.gender }),
        ...(dobDate !== undefined && { ngay_sinh: dobDate }),
      };

      const mergedProposer = {
        ...(user.nguoi_de_xuat || {}),
        ...(upsertedProposer || {}),
        ...(dto.education !== undefined && { trinh_do_hoc_van: dto.education }),
        ...(dto.major !== undefined && { nghe_nghiep: dto.major }),
        ...(unitValue !== undefined && { don_vi_cong_tac: unitValue }),
        ...(dto.position !== undefined && { vi_tri_cong_tac: dto.position }),
        ...(dto.field !== undefined && { linh_vuc_cong_tac: dto.field }),
      };

      const isComplete = this.isProfileComplete(mergedProfile, mergedProposer);
      if (tx.nguoi_dung?.update) {
        await tx.nguoi_dung.update({
          where: { id: actualUserId },
          data: { profile_completed: isComplete },
        });
      }
    });

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(actualUserId),
        buildUserAuthCacheKey(actualUserId),
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
  async updateRole({
    targetUserId,
    newRole,
    currentUser,
  }: UpdateUserRoleParamsDto): Promise<{ success: boolean; message: string; role: string }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    if (newRole === UserRole.SUPERADMIN && currentUser?.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên cấp cao (SUPERADMIN) mới có quyền phân quyền SUPERADMIN.',
      );
    }

    const user = await this.findUserByIdOrKeycloakId(targetUserId, {
      id: true,
      vai_tro: true,
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng cần phân quyền.');
    }

    if (user.vai_tro === UserRole.SUPERADMIN && newRole !== UserRole.SUPERADMIN) {
      throw new BadRequestException({
        code: 'CANNOT_CHANGE_SUPERADMIN_ROLE',
        message: 'Không thể thay đổi quyền của tài khoản SUPERADMIN.',
      });
    }

    const actualUserId = user.id;

    await this.prisma.nguoi_dung.update({
      where: { id: actualUserId },
      data: {
        vai_tro: newRole,
      },
    });

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(actualUserId),
        buildUserAuthCacheKey(actualUserId),
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
  async updateStatus({
    targetUserId,
    isActive,
    currentUser,
  }: UpdateUserStatusParamsDto): Promise<{ success: boolean; message: string; active: boolean }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    const user = await this.findUserByIdOrKeycloakId(targetUserId, {
      id: true,
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng cần cập nhật trạng thái.');
    }

    const actualUserId = user.id;

    await this.prisma.nguoi_dung.update({
      where: { id: actualUserId },
      data: {
        active: isActive,
      },
    });

    if (isActive === false && this.refreshTokenRotationService) {
      await this.refreshTokenRotationService.revokeAllUserTokens(actualUserId);
    }

    // Invalidate Cache gom cụm 500ms (Rule 25)
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(actualUserId),
        buildUserAuthCacheKey(actualUserId),
      ]);
    }

    return {
      success: true,
      message: `Cập nhật trạng thái người dùng thành ${isActive ? 'kích hoạt' : 'khóa'} thành công.`,
      active: isActive,
    };
  }

  async updateActiveStatus(
    params: UpdateUserStatusParamsDto,
  ): Promise<{ success: boolean; message: string; active: boolean }> {
    return this.updateStatus(params);
  }

  /**
   * Kiểm tra người dùng đã hoàn thiện hồ sơ chưa (Tương thích FE cũ: check-profile)
   */
  async checkProfile(
    paramOrUserId: CheckProfileParamsDto | string,
  ): Promise<{ profileComplete: boolean }> {
    const userId =
      typeof paramOrUserId === 'object' && paramOrUserId !== null && 'userId' in paramOrUserId
        ? paramOrUserId.userId
        : (paramOrUserId as string);

    const user = await this.findUserByIdOrKeycloakId(userId, {
      id: true,
      profile_completed: true,
      deleted_at: true,
      ho_so_ca_nhan: {
        select: {
          ho_ten: true,
          ngay_sinh: true,
          gioi_tinh: true,
          phone: true,
          email: true,
        },
      },
      nguoi_de_xuat: {
        select: {
          don_vi_cong_tac: true,
          vi_tri_cong_tac: true,
        },
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException('Không tìm thấy người dùng hoặc tài khoản đã bị vô hiệu hóa.');
    }

    const hasRelationFields = 'ho_so_ca_nhan' in user || 'nguoi_de_xuat' in user;
    const computedComplete = hasRelationFields
      ? this.isProfileComplete(user.ho_so_ca_nhan, user.nguoi_de_xuat)
      : Boolean(user.profile_completed);

    if (
      hasRelationFields &&
      Boolean(user.profile_completed) !== computedComplete &&
      this.prisma.nguoi_dung?.update
    ) {
      await this.prisma.nguoi_dung.update({
        where: { id: user.id },
        data: { profile_completed: computedComplete },
      });
    }

    return {
      profileComplete: computedComplete,
    };
  }

  async checkProfileComplete(
    paramOrUserId: CheckProfileParamsDto | string,
  ): Promise<{ profileComplete: boolean }> {
    return this.checkProfile(paramOrUserId);
  }

  /**
   * Xóa mềm người dùng và thu hồi toàn bộ Refresh Token (Admin only)
   */
  async softDeleteUser({
    targetUserId,
    currentUser,
  }: SoftDeleteUserParamsDto): Promise<{ success: boolean; message: string }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    const user = await this.findUserByIdOrKeycloakId(targetUserId, {
      id: true,
      active: true,
      deleted_at: true,
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException('Không tìm thấy người dùng hoặc tài khoản đã bị xóa trước đó.');
    }

    const actualUserId = user.id;

    await this.prisma.nguoi_dung.update({
      where: { id: actualUserId },
      data: {
        active: false,
        deleted_at: new Date(),
      },
    });

    // Thu hồi toàn bộ Refresh Token của user bị xóa mềm
    if (this.refreshTokenRotationService) {
      await this.refreshTokenRotationService.revokeAllUserTokens(actualUserId);
    }

    // Invalidate Cache gom cụm 500ms
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        buildUserCacheTag(actualUserId),
        buildUserAuthCacheKey(actualUserId),
      ]);
    }

    return {
      success: true,
      message: 'Xóa mềm người dùng và thu hồi toàn bộ phiên đăng nhập thành công.',
    };
  }

  /**
   * Xóa mềm hàng loạt người dùng theo batch (Rule 20 - Chunked Atomic Commit & Batching)
   */
  async softDeleteBatch({ userIds, currentUser }: SoftDeleteBatchParamsDto): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('Danh sách userIds không được để trống.');
    }

    // 1. Chặn người dùng tự xóa chính mình trong batch
    if (userIds.includes(currentUser.id)) {
      throw new ForbiddenException(
        'Bạn không thể tự xóa tài khoản của chính mình trong danh sách batch.',
      );
    }

    // 2. Chặn xóa tài khoản SUPERADMIN nếu người thực hiện không phải SUPERADMIN
    const targetUsers = await this.prisma.nguoi_dung.findMany({
      where: { id: { in: userIds }, deleted_at: null },
      select: { id: true, vai_tro: true },
    });

    if (targetUsers.length === 0) {
      return {
        success: true,
        message: 'Không tìm thấy người dùng hợp lệ nào cần xóa mềm.',
        affectedCount: 0,
      };
    }

    const hasSuperAdmin = targetUsers.some((u) => u.vai_tro === UserRole.SUPERADMIN);
    if (hasSuperAdmin && currentUser.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên cấp cao (SUPERADMIN) mới có quyền xóa tài khoản SUPERADMIN.',
      );
    }

    const validIds = targetUsers.map((u) => u.id);

    // 3. Batch Soft-Delete trực tiếp bằng updateMany (Single Query - Rule 20)
    const result = await this.prisma.nguoi_dung.updateMany({
      where: { id: { in: validIds }, deleted_at: null },
      data: {
        active: false,
        deleted_at: new Date(),
      },
    });

    // 4. Thu hồi hàng loạt Refresh Tokens và Sessions theo batch
    if (this.refreshTokenRotationService) {
      await this.refreshTokenRotationService.revokeMultipleUsersTokens(validIds);
    }

    // 5. Invalidate Cache gom cụm 500ms
    if (this.cacheService) {
      const cacheTags = [
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        ...validIds.map((id) => buildUserCacheTag(id)),
        ...validIds.map((id) => buildUserAuthCacheKey(id)),
      ];
      await this.cacheService.debouncedInvalidateTags(cacheTags);
    }

    this.logger.log(
      `Quản trị viên ${currentUser.username} (${currentUser.id}) đã xóa mềm hàng loạt ${result.count} người dùng.`,
    );

    return {
      success: true,
      message: `Đã xóa mềm thành công ${result.count} người dùng và thu hồi toàn bộ phiên đăng nhập.`,
      affectedCount: result.count,
    };
  }

  /**
   * Cập nhật trạng thái hoạt động (active/inactive) hàng loạt người dùng theo batch
   */
  async updateStatusBatch({ userIds, isActive, currentUser }: UpdateStatusBatchParamsDto): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('Danh sách userIds không được để trống.');
    }

    if (userIds.includes(currentUser.id) && !isActive) {
      throw new ForbiddenException('Bạn không thể tự khóa tài khoản của chính mình.');
    }

    const targetUsers = await this.prisma.nguoi_dung.findMany({
      where: { id: { in: userIds }, deleted_at: null },
      select: { id: true, vai_tro: true },
    });

    if (targetUsers.length === 0) {
      return {
        success: true,
        message: 'Không tìm thấy người dùng hợp lệ nào cần cập nhật trạng thái.',
        affectedCount: 0,
      };
    }

    const hasSuperAdmin = targetUsers.some((u) => u.vai_tro === UserRole.SUPERADMIN);
    if (hasSuperAdmin && currentUser.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên cấp cao (SUPERADMIN) mới có quyền thay đổi trạng thái tài khoản SUPERADMIN.',
      );
    }

    const validIds = targetUsers.map((u) => u.id);

    // Batch update trực tiếp bằng updateMany (Single Query)
    const result = await this.prisma.nguoi_dung.updateMany({
      where: { id: { in: validIds }, deleted_at: null },
      data: { active: isActive },
    });

    if (!isActive && this.refreshTokenRotationService) {
      await this.refreshTokenRotationService.revokeMultipleUsersTokens(validIds);
    }

    if (this.cacheService) {
      const cacheTags = [
        CACHE_TAG_USERS,
        CACHE_TAG_PROFILES,
        ...validIds.map((id) => buildUserCacheTag(id)),
        ...validIds.map((id) => buildUserAuthCacheKey(id)),
      ];
      await this.cacheService.debouncedInvalidateTags(cacheTags);
    }

    return {
      success: true,
      message: `Đã cập nhật trạng thái cho ${result.count} người dùng thành công.`,
      affectedCount: result.count,
    };
  }

  /**
   * Tạo hàng loạt người dùng theo batch transaction (Rule 20 - Chunked Atomic Commit & Batching)
   */
  async createBatch({ dtoList, currentUser }: CreateBatchUsersParamsDto): Promise<{
    success: boolean;
    message: string;
    createdCount: number;
  }> {
    this.idorDefenseService.assertAdmin(currentUser.role);

    if (!dtoList || dtoList.length === 0) {
      throw new BadRequestException('Danh sách người dùng cần tạo không được để trống.');
    }

    // 1. Kiểm tra trùng lặp username / email trong chính payload gửi lên
    const usernames = dtoList.map((u) => u.username.toLowerCase());
    const emails = dtoList.map((u) => u.email.toLowerCase());

    if (new Set(usernames).size !== usernames.length) {
      throw new BadRequestException('Danh sách payload có chứa tên đăng nhập bị trùng lặp.');
    }
    if (new Set(emails).size !== emails.length) {
      throw new BadRequestException('Danh sách payload có chứa email bị trùng lặp.');
    }

    // 2. Kiểm tra trùng lặp với CSDL bằng 1 single query (Chống N+1 Query - Rule 11)
    const existingUsers = await this.prisma.nguoi_dung.findMany({
      where: {
        OR: [{ ten_dang_nhap: { in: usernames } }, { ho_so_ca_nhan: { email: { in: emails } } }],
      },
      select: {
        ten_dang_nhap: true,
        ho_so_ca_nhan: { select: { email: true } },
      },
    });

    if (existingUsers.length > 0) {
      const existingUsernames = existingUsers.map((u) => u.ten_dang_nhap);
      throw new ConflictException(
        `Các tài khoản sau đã tồn tại trong hệ thống: ${existingUsernames.join(', ')}`,
      );
    }

    // 3. Chuẩn bị mật khẩu băm
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('P@ssw0rd123!', salt);

    // 4. Batch Transaction: Gom toàn bộ thao tác tạo user vào 1 transaction duy nhất (Rule 20)
    const createOps = dtoList.map((u) => {
      const userId = crypto.randomUUID();
      const role = u.role || UserRole.USER;
      const hashedPassword = u.password ? bcrypt.hashSync(u.password, salt) : defaultPasswordHash;

      return this.prisma.nguoi_dung.create({
        data: {
          id: userId,
          ten_dang_nhap: u.username,
          mat_khau: hashedPassword,
          vai_tro: role,
          kenh: AuthProvider.LOCAL,
          active: true,
          profile_completed: false,
          keycloak_user_id: userId,
          deleted_at: null,
          ho_so_ca_nhan: {
            create: {
              ho_ten: u.fullName,
              email: u.email,
              phone: u.phone || null,
              deleted_at: null,
            },
          },
        },
      });
    });

    await this.prisma.$transaction(createOps);

    // 5. Invalidate Cache gom cụm 500ms
    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([CACHE_TAG_USERS, CACHE_TAG_PROFILES]);
    }

    this.logger.log(
      `Quản trị viên ${currentUser.username} (${currentUser.id}) đã tạo hàng loạt ${dtoList.length} người dùng theo batch.`,
    );

    return {
      success: true,
      message: `Đã tạo thành công ${dtoList.length} người dùng theo batch.`,
      createdCount: dtoList.length,
    };
  }
}
