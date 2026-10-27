import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TTL_PERPETUAL } from '../../../config/constants/cache.constants';
import {
  CreateNutritionLimitSetDto,
  UpdateNutritionLimitSetDto,
  NutritionLimitSetResponseDto,
} from '../dto';
import { NutritionLimitWarning } from '../../../config/enums/domain.enum';
import { UserRole } from '../../../config/enums/role.enum';

@Injectable()
export class NutritionLimitSetsService {
  private readonly logger = new Logger(NutritionLimitSetsService.name);
  private readonly CACHE_TAG = 'nutrition-limit-sets';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  private mapToDto(entity: any): NutritionLimitSetResponseDto {
    return {
      id: entity.id.toString(),
      name: entity.ten_gioi_han || 'Giới hạn dinh dưỡng',
      warningRule: entity.canh_bao || NutritionLimitWarning.OFF,
      reusable: Boolean(entity.tai_su_dung),
      limits:
        typeof entity.gioi_han_json === 'string'
          ? JSON.parse(entity.gioi_han_json)
          : entity.gioi_han_json || {},
      createdAt: entity.ngay_tao || null,
      updatedAt: entity.ngay_cap_nhat || null,
    };
  }

  async create(
    dto: CreateNutritionLimitSetDto,
    currentUser: { id: string; role?: string },
  ): Promise<NutritionLimitSetResponseDto> {
    const isReusable = Boolean(dto.reusable);
    const name = dto.name?.trim() || 'Giới hạn dinh dưỡng';

    if (isReusable && name) {
      const existing = await this.prisma.gioi_han_dinh_duong.findFirst({
        where: {
          nguoi_dung_id: currentUser.id,
          ten_gioi_han: name,
          tai_su_dung: true,
        },
        select: { id: true },
      });

      if (existing) {
        throw new HttpException(
          { code: 'NLS_001', message: 'Tên bộ giới hạn tái sử dụng đã tồn tại' },
          HttpStatus.CONFLICT,
        );
      }
    }

    const created = await this.prisma.gioi_han_dinh_duong.create({
      data: {
        nguoi_dung_id: currentUser.id,
        ten_gioi_han: name,
        canh_bao: dto.warningRule || NutritionLimitWarning.OFF,
        tai_su_dung: isReusable,
        gioi_han_json: dto.limits || {},
        ngay_tao: new Date(),
        ngay_cap_nhat: new Date(),
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return this.mapToDto(created);
  }

  async update(
    id: string | number | bigint,
    dto: UpdateNutritionLimitSetDto,
    currentUser: { id: string; role?: string },
  ): Promise<NutritionLimitSetResponseDto> {
    const limitId = BigInt(id);
    const existing = await this.prisma.gioi_han_dinh_duong.findUnique({
      where: { id: limitId },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (existing.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.gioi_han_dinh_duong.update({
      where: { id: limitId },
      data: {
        ten_gioi_han: dto.name !== undefined ? dto.name.trim() : existing.ten_gioi_han,
        canh_bao: dto.warningRule !== undefined ? dto.warningRule : existing.canh_bao,
        tai_su_dung: dto.reusable !== undefined ? Boolean(dto.reusable) : existing.tai_su_dung,
        gioi_han_json: dto.limits !== undefined ? dto.limits : existing.gioi_han_json,
        ngay_cap_nhat: new Date(),
      },
    });

    await this.cacheService.debouncedInvalidateTags([
      this.CACHE_TAG,
      `nutrition_limit:${limitId.toString()}`,
    ]);
    return this.mapToDto(updated);
  }

  async getById(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<NutritionLimitSetResponseDto> {
    const limitId = BigInt(id);
    const cacheKey = `nutrition_limit:detail:${limitId.toString()}`;
    const existing = await this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        return this.prisma.gioi_han_dinh_duong.findUnique({
          where: { id: limitId },
        });
      },
      [this.CACHE_TAG, `nutrition_limit:${limitId.toString()}`],
    );

    if (!existing) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isOwner = existing.nguoi_dung_id === currentUser.id;
    const isPublicTemplate = Boolean(existing.tai_su_dung);

    if (!isOwner && !isPublicTemplate && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapToDto(existing);
  }

  async getAll(currentUser: {
    id: string;
    role?: string;
  }): Promise<NutritionLimitSetResponseDto[]> {
    const cacheKey = this.cacheService.generateKey(`${this.CACHE_TAG}:${currentUser.id}`);
    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        const sets = await this.prisma.gioi_han_dinh_duong.findMany({
          where: {
            OR: [{ nguoi_dung_id: currentUser.id }, { tai_su_dung: true }],
          },
          select: {
            id: true,
            ten_gioi_han: true,
            canh_bao: true,
            tai_su_dung: true,
            gioi_han_json: true,
            ngay_tao: true,
            ngay_cap_nhat: true,
          },
          orderBy: {
            ngay_cap_nhat: 'desc',
          },
          take: 100,
        });

        return sets.map((s) => this.mapToDto(s));
      },
      this.CACHE_TAG,
    );
  }

  async delete(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
    const limitId = BigInt(id);
    const existing = await this.prisma.gioi_han_dinh_duong.findUnique({
      where: { id: limitId },
      select: {
        id: true,
        nguoi_dung_id: true,
      },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (existing.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'NLS_004', message: 'Không tìm thấy bộ giới hạn dinh dưỡng' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Kiểm tra ràng buộc khóa ngoại trước khi xóa
    const [menuCount, proposalCount] = await Promise.all([
      this.prisma.thuc_don.count({
        where: { gioi_han_dinh_duong_id: limitId },
      }),
      this.prisma.de_xuat_thuc_don.count({
        where: { gioi_han_dinh_duong_id: limitId },
      }),
    ]);

    if (menuCount > 0 || proposalCount > 0) {
      throw new HttpException(
        {
          code: 'NLS_002',
          message: 'Không thể xóa bộ giới hạn đang được sử dụng trong thực đơn hoặc đề xuất',
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.gioi_han_dinh_duong.delete({
      where: { id: limitId },
    });

    await this.cacheService.debouncedInvalidateTags([
      this.CACHE_TAG,
      `nutrition_limit:${limitId.toString()}`,
    ]);
    return { success: true, message: 'Xóa bộ giới hạn dinh dưỡng thành công' };
  }
}
