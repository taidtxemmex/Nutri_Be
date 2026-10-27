import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TTL_PERPETUAL } from '../../../config/constants/cache.constants';
import { CreateCoefficientDto, UpdateCoefficientDto, CoefficientResponseDto } from '../dto';
import { UserRole, isAdminRole } from '../../../config/enums/role.enum';

@Injectable()
export class CoefficientsService {
  private readonly logger = new Logger(CoefficientsService.name);
  private readonly CACHE_TAG = 'coefficients';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  private mapToDto(item: any): CoefficientResponseDto {
    return {
      id: item.id.toString(),
      ingredientId: item.nguyen_lieu_id ? Number(item.nguyen_lieu_id) : null,
      ingredientName: item.nguyen_lieu?.ten_nguyen_lieu || null,
      processingMethod: item.phuong_phap_che_bien || null,
      coefficient: item.he_so != null ? Number(item.he_so) : null,
      isPublic: Boolean(item.is_public),
      userId: item.nguoi_dung_id || null,
    };
  }

  async create(
    dto: CreateCoefficientDto,
    currentUser: { id: string; role?: string },
  ): Promise<CoefficientResponseDto> {
    if (dto.coefficient < 0.1 || dto.coefficient > 5.0) {
      throw new HttpException(
        {
          code: 'COEF_INVALID_RANGE',
          message: 'Hệ số sống chín phải nằm trong khoảng sinh hóa hợp lệ (0.1 đến 5.0)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ingredient = await this.prisma.nguyen_lieu.findFirst({
      where: { id: BigInt(dto.ingredientId), deleted_at: null },
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
          nguyen_lieu_id: BigInt(dto.ingredientId),
          phuong_phap_che_bien: dto.processingMethod,
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
          nguyen_lieu_id: BigInt(dto.ingredientId),
          phuong_phap_che_bien: dto.processingMethod,
          he_so: dto.coefficient,
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
          nguyen_lieu_id: BigInt(dto.ingredientId),
          phuong_phap_che_bien: dto.processingMethod,
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
          nguyen_lieu_id: BigInt(dto.ingredientId),
          phuong_phap_che_bien: dto.processingMethod,
          he_so: dto.coefficient,
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

  async findAll(currentUser?: { id?: string; role?: string }): Promise<CoefficientResponseDto[]> {
    const isAdminUser = this.isAdmin(currentUser);

    const whereClause: any = isAdminUser
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

  async findMy(currentUser: { id: string }): Promise<CoefficientResponseDto[]> {
    const cacheKey = `${this.CACHE_TAG}:my:${currentUser.id}`;
    return this.cacheService.getOrSet(
      cacheKey,
      CACHE_TTL_PERPETUAL,
      async () => {
        const items = await this.prisma.he_so_song_chin.findMany({
          where: { nguoi_dung_id: currentUser.id },
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

  async findById(id: string | number): Promise<CoefficientResponseDto> {
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

  async update(
    id: string | number,
    dto: UpdateCoefficientDto,
    currentUser: { id: string; role?: string },
  ): Promise<CoefficientResponseDto> {
    if (dto.coefficient !== undefined && (dto.coefficient < 0.1 || dto.coefficient > 5.0)) {
      throw new HttpException(
        {
          code: 'COEF_INVALID_RANGE',
          message: 'Hệ số sống chín phải nằm trong khoảng sinh hóa hợp lệ (0.1 đến 5.0)',
        },
        HttpStatus.BAD_REQUEST,
      );
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

    if (dto.ingredientId) {
      const ingredient = await this.prisma.nguyen_lieu.findFirst({
        where: { id: BigInt(dto.ingredientId), deleted_at: null },
      });
      if (!ingredient) {
        throw new HttpException(
          { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const updated = await this.prisma.he_so_song_chin.update({
      where: { id: BigInt(id) },
      data: {
        nguyen_lieu_id: dto.ingredientId ? BigInt(dto.ingredientId) : undefined,
        phuong_phap_che_bien: dto.processingMethod ?? undefined,
        he_so: dto.coefficient !== undefined ? dto.coefficient : undefined,
        is_public: isAdminUser && dto.isPublic !== undefined ? dto.isPublic : undefined,
      },
      include: {
        nguyen_lieu: { select: { ten_nguyen_lieu: true } },
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapToDto(updated);
  }

  async delete(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<{ message: string }> {
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
    } catch (error: any) {
      this.logger.error(`Lỗi xóa hệ số sống chín ID ${id}: ${error?.message}`);
      throw new HttpException(
        { code: 'COEF_004', message: 'Không thể xóa hệ số này vì đang được sử dụng' },
        HttpStatus.CONFLICT,
      );
    }

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Xóa hệ số thành công' };
  }
}
