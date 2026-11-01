import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TTL_PERPETUAL } from '../../../config/constants/cache.constants';
import {
  CoefficientResponseDto,
  CreateCoefficientParamsDto,
  FindAllCoefficientsParamsDto,
  FindMyCoefficientsParamsDto,
  FindCoefficientByIdParamsDto,
  UpdateCoefficientParamsDto,
  DeleteCoefficientParamsDto,
} from '../dto';
import { isAdminRole } from '../../../config/enums/role.enum';

@Injectable()
export class CoefficientsService {
  private readonly logger = new Logger(CoefficientsService.name);
  private readonly CACHE_TAG = 'coefficients';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private isAdmin(user?: { id?: string; role?: string }): boolean {
    return isAdminRole(user);
  }

  private mapToDto(item: {
    id: bigint | number;
    nguyen_lieu_id?: bigint | number | null;
    nguyen_lieu?: { ten_nguyen_lieu?: string | null } | null;
    phuong_phap_che_bien?: string | null;
    he_so?: unknown;
    is_public?: boolean | number | null;
    nguoi_dung_id?: string | null;
  }): CoefficientResponseDto {
    return {
      id: item.id.toString(),
      ingredientId: item.nguyen_lieu_id ? Number(item.nguyen_lieu_id) : null,
      ingredientName: item.nguyen_lieu?.ten_nguyen_lieu || null,
      ingredient: {
        id: Number(item.nguyen_lieu_id),
        material: item.nguyen_lieu?.ten_nguyen_lieu ?? null,
        name: item.nguyen_lieu?.ten_nguyen_lieu ?? null,
      },
      processingMethod: item.phuong_phap_che_bien || null,
      coefficient: item.he_so != null ? Number(item.he_so) : null,
      isPublic: Boolean(item.is_public),
      userId: item.nguoi_dung_id || null,
    } as CoefficientResponseDto;
  }

  private validateCoefficient(coefficient: number): void {
    if (coefficient <= 0 || coefficient > 10) {
      throw new HttpException(
        {
          code: 'COEF_INVALID_RANGE',
          message: 'Hệ số sống chín phải lớn hơn 0 và không vượt quá 10',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async create({ dto, currentUser }: CreateCoefficientParamsDto): Promise<CoefficientResponseDto> {
    const resolvedIngredientId = dto.ingredientId ?? dto.nguyenLieuId;
    const resolvedProcessingMethod = dto.processingMethod ?? dto.phuongPhapCheBien;
    const resolvedCoefficient = dto.coefficient ?? dto.heSo;

    this.validateCoefficient(resolvedCoefficient);

    const ingredient = await this.prisma.nguyen_lieu.findFirst({
      where: { id: BigInt(resolvedIngredientId), deleted_at: null },
      select: { id: true, ten_nguyen_lieu: true },
    });

    if (!ingredient) {
      throw new HttpException(
        { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    const shouldBePublic = isAdminUser && Boolean(dto.isPublic);

    if (shouldBePublic) {
      const existedPublic = await this.prisma.he_so_song_chin.findFirst({
        where: {
          nguyen_lieu_id: BigInt(resolvedIngredientId),
          phuong_phap_che_bien: resolvedProcessingMethod,
          is_public: true,
        },
      });

      if (existedPublic) {
        throw new HttpException(
          { code: 'COEF_003', message: 'Hệ số công khai đã tồn tại' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const created = await this.prisma.he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(resolvedIngredientId),
          phuong_phap_che_bien: resolvedProcessingMethod,
          he_so: resolvedCoefficient,
          is_public: true,
          nguoi_dung_id: null,
        },
        include: {
          nguyen_lieu: { select: { ten_nguyen_lieu: true } },
        },
      });

      await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
      return this.mapToDto(created);
    } else {
      const existedUser = await this.prisma.he_so_song_chin.findFirst({
        where: {
          nguyen_lieu_id: BigInt(resolvedIngredientId),
          phuong_phap_che_bien: resolvedProcessingMethod,
          nguoi_dung_id: currentUser.id,
        },
      });

      if (existedUser) {
        throw new HttpException(
          { code: 'COEF_002', message: 'Hệ số đã tồn tại' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const created = await this.prisma.he_so_song_chin.create({
        data: {
          nguyen_lieu_id: BigInt(resolvedIngredientId),
          phuong_phap_che_bien: resolvedProcessingMethod,
          he_so: resolvedCoefficient,
          is_public: false,
          nguoi_dung_id: currentUser.id,
        },
        include: {
          nguyen_lieu: { select: { ten_nguyen_lieu: true } },
        },
      });

      await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
      return this.mapToDto(created);
    }
  }

  async findAll({ currentUser }: FindAllCoefficientsParamsDto = {}): Promise<
    CoefficientResponseDto[]
  > {
    const isAdminUser = this.isAdmin(currentUser);

    const whereClause: Prisma.he_so_song_chinWhereInput = isAdminUser
      ? {}
      : currentUser?.id
        ? {
            OR: [{ is_public: true }, { nguoi_dung_id: currentUser.id }],
          }
        : { is_public: true };

    const items = await this.prisma.he_so_song_chin.findMany({
      where: whereClause,
      select: {
        id: true,
        nguyen_lieu_id: true,
        phuong_phap_che_bien: true,
        he_so: true,
        is_public: true,
        nguoi_dung_id: true,
        nguyen_lieu: { select: { ten_nguyen_lieu: true } },
      },
      orderBy: { id: 'desc' },
    });

    if (currentUser?.id) {
      items.sort((a, b) => {
        const aIsOwn = a.nguoi_dung_id === currentUser.id ? 0 : 1;
        const bIsOwn = b.nguoi_dung_id === currentUser.id ? 0 : 1;
        return aIsOwn - bIsOwn;
      });

      if (!isAdminUser) {
        const dedupedMap = new Map<string, (typeof items)[number]>();
        for (const item of items) {
          const key = `${String(item.nguyen_lieu_id)}:${item.phuong_phap_che_bien}`;
          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, item);
          }
        }
        return Array.from(dedupedMap.values()).map((item) => this.mapToDto(item));
      }
    }

    return items.map((item) => this.mapToDto(item));
  }

  async findPublic(): Promise<CoefficientResponseDto[]> {
    const cacheKey = `${this.CACHE_TAG}:public`;
    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        const items = await this.prisma.he_so_song_chin.findMany({
          where: { is_public: true },
          select: {
            id: true,
            nguyen_lieu_id: true,
            phuong_phap_che_bien: true,
            he_so: true,
            is_public: true,
            nguoi_dung_id: true,
            nguyen_lieu: { select: { ten_nguyen_lieu: true } },
          },
          orderBy: { id: 'desc' },
        });

        return items.map((item) => this.mapToDto(item));
      },
      this.CACHE_TAG,
    );
  }

  async findMy({ currentUser }: FindMyCoefficientsParamsDto): Promise<CoefficientResponseDto[]> {
    const isAdminUser = this.isAdmin(currentUser);
    const cacheKey = `${this.CACHE_TAG}:my:${currentUser.id}:${isAdminUser ? 'admin' : 'user'}`;
    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        const whereClause = isAdminUser
          ? {
              OR: [{ nguoi_dung_id: currentUser.id }, { is_public: true, nguoi_dung_id: null }],
            }
          : { nguoi_dung_id: currentUser.id };

        const items = await this.prisma.he_so_song_chin.findMany({
          where: whereClause,
          select: {
            id: true,
            nguyen_lieu_id: true,
            phuong_phap_che_bien: true,
            he_so: true,
            is_public: true,
            nguoi_dung_id: true,
            nguyen_lieu: { select: { ten_nguyen_lieu: true } },
          },
          orderBy: { id: 'desc' },
        });

        return items.map((item) => this.mapToDto(item));
      },
      this.CACHE_TAG,
    );
  }

  async findById({ id }: FindCoefficientByIdParamsDto): Promise<CoefficientResponseDto> {
    const cacheKey = `${this.CACHE_TAG}:detail:${id}`;
    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        const item = await this.prisma.he_so_song_chin.findUnique({
          where: { id: BigInt(id) },
          include: {
            nguyen_lieu: { select: { ten_nguyen_lieu: true } },
          },
        });

        if (!item) {
          throw new HttpException(
            { code: 'COEF_001', message: 'Không tìm thấy hệ số' },
            HttpStatus.NOT_FOUND,
          );
        }

        return this.mapToDto(item);
      },
      [this.CACHE_TAG, `${this.CACHE_TAG}:${id}`],
    );
  }

  async update({
    id,
    dto,
    currentUser,
  }: UpdateCoefficientParamsDto): Promise<CoefficientResponseDto> {
    const resolvedIngredientId = dto.ingredientId ?? dto.nguyenLieuId;
    const resolvedProcessingMethod = dto.processingMethod ?? dto.phuongPhapCheBien;
    const resolvedCoefficient = dto.coefficient ?? dto.heSo;

    if (resolvedCoefficient !== undefined) {
      this.validateCoefficient(resolvedCoefficient);
    }

    const existing = await this.prisma.he_so_song_chin.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'COEF_001', message: 'Không tìm thấy hệ số' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);

    if (existing.is_public && !isAdminUser) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!existing.is_public && !isAdminUser && existing.nguoi_dung_id !== currentUser.id) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    if (resolvedIngredientId) {
      const ingredient = await this.prisma.nguyen_lieu.findFirst({
        where: { id: BigInt(resolvedIngredientId), deleted_at: null },
      });
      if (!ingredient) {
        throw new HttpException(
          { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const nextIsPublic =
      existing.nguoi_dung_id === null
        ? existing.is_public
        : isAdminUser && dto.isPublic !== undefined
          ? dto.isPublic
          : undefined;

    const updated = await this.prisma.he_so_song_chin.update({
      where: { id: BigInt(id) },
      data: {
        nguyen_lieu_id: resolvedIngredientId ? BigInt(resolvedIngredientId) : undefined,
        phuong_phap_che_bien: resolvedProcessingMethod ?? undefined,
        he_so: resolvedCoefficient !== undefined ? resolvedCoefficient : undefined,
        is_public: nextIsPublic,
      },
      include: {
        nguyen_lieu: { select: { ten_nguyen_lieu: true } },
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapToDto(updated);
  }

  async delete({ id, currentUser }: DeleteCoefficientParamsDto): Promise<{ message: string }> {
    const existing = await this.prisma.he_so_song_chin.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'COEF_001', message: 'Không tìm thấy hệ số' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);

    if (existing.is_public && !isAdminUser) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!existing.is_public && !isAdminUser && existing.nguoi_dung_id !== currentUser.id) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      await this.prisma.he_so_song_chin.delete({
        where: { id: BigInt(id) },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete raw-to-cooked coefficient ID ${id}: ${errorMessage}`);
      throw new HttpException(
        { code: 'COEF_004', message: 'Không thể xóa hệ số này vì đang được sử dụng' },
        HttpStatus.CONFLICT,
      );
    }

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Xóa hệ số thành công' };
  }
}
