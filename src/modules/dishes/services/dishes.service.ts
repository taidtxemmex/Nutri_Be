import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService } from '../../../core/nutrition-engine';
import { computeRecipeHash } from '../../../core/nutrition-engine/recipe-hash.util';
import {
  CreateDishDto,
  UpdateDishDto,
  DishSummaryDto,
  DishResponseDto,
  DishCloneRequestDto,
  DishCloneResponseDto,
} from '../dto';
import { UserRole } from '../../../config/enums/role.enum';
import { DishStatus } from '../../../config/enums/domain.enum';

@Injectable()
export class DishesService {
  private readonly logger = new Logger(DishesService.name);
  private readonly CACHE_TAG = 'dishes';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly nutritionCalculator: NutritionCalculatorService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  private isPublicDish(dish: { trang_thai?: string | null }): boolean {
    return dish.trang_thai === DishStatus.DA_DUYET || dish.trang_thai === DishStatus.HE_THONG;
  }

  private mapToSummaryDto(dish: any, currentUserId?: string): DishSummaryDto {
    const calc = this.nutritionCalculator.calculateDishNutrition({
      id: dish.id,
      ten_mon: dish.ten_mon,
      chi_tiet_mon_an: (dish.chi_tiet_mon_an || []).map((cd: any) => ({
        ingredientId: cd.nguyen_lieu_id,
        khoi_luong_song_sach: cd.khoi_luong_song_sach,
        ingredient: cd.nguyen_lieu,
      })),
    });

    return {
      id: dish.id.toString(),
      name: dish.ten_mon,
      status: dish.trang_thai || null,
      recipeHash: dish.recipe_hash || null,
      dishWeight: calc.cookedWeightGrams,
      totalNutrients: calc.nutrients,
      isMine: Boolean(currentUserId && dish.nguoi_dung_id === currentUserId),
      createdAt: dish.ngay_tao || null,
    };
  }

  private mapToDetailDto(dish: any): DishResponseDto {
    const calc = this.nutritionCalculator.calculateDishNutrition({
      id: dish.id,
      ten_mon: dish.ten_mon,
      chi_tiet_mon_an: (dish.chi_tiet_mon_an || []).map((cd: any) => ({
        ingredientId: cd.nguyen_lieu_id,
        khoi_luong_song_sach: cd.khoi_luong_song_sach,
        ingredient: cd.nguyen_lieu,
      })),
    });

    const details = (dish.chi_tiet_mon_an || []).map((cd: any, index: number) => {
      const breakdown = calc.ingredientBreakdown[index];
      const netWeight = cd.khoi_luong_song_sach != null ? Number(cd.khoi_luong_song_sach) : 0;

      return {
        ingredientId: cd.nguyen_lieu_id.toString(),
        ingredientName: cd.nguyen_lieu?.ten_nguyen_lieu || '',
        netWeight,
        edible: cd.nguyen_lieu?.edible != null ? Number(cd.nguyen_lieu.edible) : null,
        nutrients: breakdown ? breakdown.nutrients : {},
      };
    });

    return {
      id: dish.id.toString(),
      name: dish.ten_mon,
      status: dish.trang_thai || null,
      recipeHash: dish.recipe_hash || null,
      dishWeight: calc.cookedWeightGrams,
      totalNutrients: calc.nutrients,
      details,
      originalDishId: dish.mon_goc_id ? dish.mon_goc_id.toString() : null,
      rejectReason: dish.ly_do_tu_choi || null,
      approvedAt: dish.ngay_phe_duyet || null,
      createdAt: dish.ngay_tao || null,
    };
  }

  /**
   * 1. Tạo món ăn mới trong 1 transaction, tính recipe_hash và 86 chỉ tiêu vi chất
   */
  async create(
    dto: CreateDishDto,
    currentUser: { id: string; role?: string },
  ): Promise<DishResponseDto> {
    if (!dto.name || !dto.name.trim()) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'Tên món ăn không được để trống' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dto.details || dto.details.length === 0) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'Món ăn phải có ít nhất một nguyên liệu' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Kiểm tra tất cả nguyên liệu có tồn tại trong DB không
    // Tự động gộp các nguyên liệu trùng ID trong payload (TC-S3-03 BVA)
    const mergedDetailsMap = new Map<string, number>();
    for (const d of dto.details) {
      const ingIdStr = String(d.ingredientId);
      const currentWeight = mergedDetailsMap.get(ingIdStr) || 0;
      mergedDetailsMap.set(ingIdStr, currentWeight + Number(d.netWeight));
    }
    const coalescedDetails = Array.from(mergedDetailsMap.entries()).map(([ingId, weight]) => ({
      ingredientId: ingId,
      netWeight: weight,
    }));

    for (const d of coalescedDetails) {
      const ing = await this.prisma.nguyen_lieu.findFirst({
        where: { id: BigInt(d.ingredientId), deleted_at: null },
        select: { id: true },
      });
      if (!ing) {
        throw new HttpException(
          { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Tự động tính recipe_hash SHA-256
    const recipeHash = computeRecipeHash(
      coalescedDetails.map((d) => ({
        ingredientId: Number(d.ingredientId),
        weight: d.netWeight,
      })),
    );

    const savedDish = await this.prisma.$transaction(async (tx) => {
      const dish = await tx.mon_an.create({
        data: {
          nguoi_dung_id: currentUser.id,
          ten_mon: dto.name.trim(),
          trang_thai: DishStatus.RIENG_TU,
          ngay_tao: new Date(),
          recipe_hash: recipeHash,
        },
      });

      await tx.chi_tiet_mon_an.createMany({
        data: coalescedDetails.map((d) => ({
          mon_an_id: dish.id,
          nguyen_lieu_id: BigInt(d.ingredientId),
          khoi_luong_song_sach: d.netWeight,
        })),
      });

      return tx.mon_an.findUnique({
        where: { id: dish.id },
        include: {
          chi_tiet_mon_an: {
            include: { nguyen_lieu: true },
          },
        },
      });
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapToDetailDto(savedDish);
  }

  /**
   * 2. Xem danh sách món ăn cá nhân (lọc theo statuses)
   */
  async getUserDishes(
    statuses?: string | string[],
    currentUser?: { id: string; role?: string },
  ): Promise<DishSummaryDto[]> {
    if (!currentUser?.id) {
      throw new HttpException(
        { code: 'AUTH_001', message: 'Chưa được xác thực' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    let statusList: string[];
    if (statuses) {
      statusList = Array.isArray(statuses)
        ? statuses
        : typeof statuses === 'string'
          ? statuses.split(',').map((s) => s.trim())
          : [statuses];
    } else {
      statusList = [DishStatus.RIENG_TU];
    }

    const dishes = await this.prisma.mon_an.findMany({
      where: {
        nguoi_dung_id: currentUser.id,
        deleted_at: null,
        trang_thai: { in: statusList },
      },
      include: {
        chi_tiet_mon_an: {
          include: { nguyen_lieu: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return dishes.map((d) => this.mapToSummaryDto(d, currentUser.id));
  }

  /**
   * 3. Lấy danh sách món ăn công khai (ĐÃ DUYỆT)
   */
  async getPublicDishes(currentUserId?: string): Promise<DishSummaryDto[]> {
    const dishes = await this.prisma.mon_an.findMany({
      where: {
        trang_thai: DishStatus.DA_DUYET,
        deleted_at: null,
      },
      include: {
        chi_tiet_mon_an: {
          include: { nguyen_lieu: true },
        },
      },
      orderBy: { ten_mon: 'asc' },
      take: 100,
    });

    return dishes.map((d) => this.mapToSummaryDto(d, currentUserId));
  }

  /**
   * 4. Admin xem danh sách món đề xuất và duyệt
   */
  async getAdminDishes(
    statuses?: string | string[],
    currentUserId?: string,
  ): Promise<DishSummaryDto[]> {
    let statusList: string[];
    if (statuses) {
      statusList = Array.isArray(statuses)
        ? statuses
        : typeof statuses === 'string'
          ? statuses.split(',').map((s) => s.trim())
          : [statuses];
    } else {
      statusList = [DishStatus.CHO_DUYET, DishStatus.DA_DUYET, DishStatus.TU_CHOI];
    }

    const dishes = await this.prisma.mon_an.findMany({
      where: {
        trang_thai: { in: statusList },
        deleted_at: null,
      },
      include: {
        chi_tiet_mon_an: {
          include: { nguyen_lieu: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return dishes.map((d) => this.mapToSummaryDto(d, currentUserId));
  }

  /**
   * 5. Autocomplete tìm kiếm món ăn nhanh
   */
  async autocomplete(
    dishName: string,
    limit: number = 10,
    currentUser?: { id?: string },
  ): Promise<DishSummaryDto[]> {
    const keyword = dishName ? dishName.trim() : '';

    const whereConditions: any[] = [
      { trang_thai: DishStatus.DA_DUYET },
      { trang_thai: DishStatus.HE_THONG },
    ];

    if (currentUser?.id) {
      whereConditions.push({ nguoi_dung_id: currentUser.id });
    }

    const dishes = await this.prisma.mon_an.findMany({
      where: {
        deleted_at: null,
        ...(keyword ? { ten_mon: { contains: keyword } } : {}),
        OR: whereConditions,
      },
      include: {
        chi_tiet_mon_an: {
          include: { nguyen_lieu: true },
        },
      },
      take: Number(limit) || 10,
      orderBy: { id: 'desc' },
    });

    return dishes.map((d) => this.mapToSummaryDto(d, currentUser?.id));
  }

  /**
   * 6. Lấy chi tiết món ăn (đầy đủ 86 chỉ tiêu vi chất)
   */
  async findById(
    id: string | number,
    currentUser?: { id?: string; role?: string },
  ): Promise<DishResponseDto> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
      include: {
        chi_tiet_mon_an: {
          include: { nguyen_lieu: true },
        },
      },
    });

    if (!dish) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isPublic = this.isPublicDish(dish);
    const isOwner = currentUser?.id && dish.nguoi_dung_id === currentUser.id;
    const isAdminUser = this.isAdmin(currentUser);

    // Không đủ quyền -> ném PROP_019 NOT_FOUND để bảo mật không lộ ID
    if (!isPublic && !isOwner && !(isAdminUser && dish.trang_thai !== DishStatus.RIENG_TU)) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapToDetailDto(dish);
  }

  /**
   * 7. Cập nhật món ăn
   * Immutability Guard: Chặn sửa món đã duyệt (DA_DUYET hoặc HE_THONG) -> DISH_CANNOT_EDIT (400)
   */
  async update(
    id: string | number,
    dto: UpdateDishDto,
    currentUser: { id: string; role?: string },
  ): Promise<DishResponseDto> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
      include: { chi_tiet_mon_an: true },
    });

    if (!dish) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    const isOwner = dish.nguoi_dung_id === currentUser.id;

    if (!isOwner && !isAdminUser) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 🔒 Immutability Guard: Chặn sửa món đã duyệt hoặc đang chờ duyệt (TC-S3-02)
    if (dish.trang_thai === DishStatus.DA_DUYET || dish.trang_thai === DishStatus.HE_THONG) {
      throw new HttpException(
        { code: 'DISH_002', message: 'Không thể chỉnh sửa món ăn đã được duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dish.trang_thai === DishStatus.CHO_DUYET) {
      throw new HttpException(
        { code: 'DISH_003', message: 'Không thể chỉnh sửa món ăn đang chờ duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rawDetails = dto.details;
    let coalescedDetails: Array<{ ingredientId: string; netWeight: number }> | undefined = undefined;

    if (rawDetails !== undefined) {
      const mergedMap = new Map<string, number>();
      for (const d of rawDetails) {
        const ingIdStr = String(d.ingredientId);
        const currentWeight = mergedMap.get(ingIdStr) || 0;
        mergedMap.set(ingIdStr, currentWeight + Number(d.netWeight));
      }
      coalescedDetails = Array.from(mergedMap.entries()).map(([ingId, weight]) => ({
        ingredientId: ingId,
        netWeight: weight,
      }));

      for (const d of coalescedDetails) {
        const ing = await this.prisma.nguyen_lieu.findFirst({
          where: { id: BigInt(d.ingredientId), deleted_at: null },
          select: { id: true },
        });
        if (!ing) {
          throw new HttpException(
            { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
            HttpStatus.NOT_FOUND,
          );
        }
      }
    }

    const recipeHash =
      coalescedDetails && coalescedDetails.length > 0
        ? computeRecipeHash(
            coalescedDetails.map((d) => ({
              ingredientId: Number(d.ingredientId),
              weight: d.netWeight,
            })),
          )
        : undefined;

    const updatedDish = await this.prisma.$transaction(async (tx) => {
      await tx.mon_an.update({
        where: { id: BigInt(id) },
        data: {
          ten_mon: dto.name ? dto.name.trim() : undefined,
          recipe_hash: recipeHash,
        },
      });

      if (coalescedDetails !== undefined) {
        await tx.chi_tiet_mon_an.deleteMany({
          where: { mon_an_id: BigInt(id) },
        });

        if (coalescedDetails.length > 0) {
          await tx.chi_tiet_mon_an.createMany({
            data: coalescedDetails.map((d) => ({
              mon_an_id: BigInt(id),
              nguyen_lieu_id: BigInt(d.ingredientId),
              khoi_luong_song_sach: d.netWeight,
            })),
          });
        }
      }

      return tx.mon_an.findUnique({
        where: { id: BigInt(id) },
        include: {
          chi_tiet_mon_an: {
            include: { nguyen_lieu: true },
          },
        },
      });
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapToDetailDto(updatedDish);
  }

  /**
   * 8. Clone Món: POST /api/dish/:id/clone
   * Tạo bản sao RIENG_TU, liên kết mon_goc_id
   */
  async cloneDish(
    dishId: string | number,
    request: DishCloneRequestDto,
    currentUser: { id: string; role?: string },
  ): Promise<DishCloneResponseDto> {
    const original = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(dishId), deleted_at: null },
      include: { chi_tiet_mon_an: true },
    });

    if (!original) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isPublic = this.isPublicDish(original);
    const isOwner = original.nguoi_dung_id === currentUser.id;
    const isAdminUser = this.isAdmin(currentUser);

    if (!isPublic && !isOwner && !(isAdminUser && original.trang_thai !== DishStatus.RIENG_TU)) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const detailsToClone: Array<{ ingredientId: bigint; netWeight: number }> = [];

    if (request.ingredients && request.ingredients.length > 0) {
      for (const ing of request.ingredients) {
        detailsToClone.push({
          ingredientId: BigInt(ing.ingredientId),
          netWeight: ing.netWeight,
        });
      }
    } else {
      for (const old of original.chi_tiet_mon_an) {
        detailsToClone.push({
          ingredientId: old.nguyen_lieu_id,
          netWeight: old.khoi_luong_song_sach != null ? Number(old.khoi_luong_song_sach) : 0,
        });
      }
    }

    const recipeHash = computeRecipeHash(
      detailsToClone.map((d) => ({
        ingredientId: Number(d.ingredientId),
        weight: d.netWeight,
      })),
    );

    const cloneName = request.newName ? request.newName.trim() : `${original.ten_mon} (Bản sao)`;

    const cloned = await this.prisma.$transaction(async (tx) => {
      const clone = await tx.mon_an.create({
        data: {
          nguoi_dung_id: currentUser.id,
          ten_mon: cloneName,
          trang_thai: DishStatus.RIENG_TU,
          mon_goc_id: original.id,
          ngay_tao: new Date(),
          recipe_hash: recipeHash,
        },
      });

      if (detailsToClone.length > 0) {
        await tx.chi_tiet_mon_an.createMany({
          data: detailsToClone.map((d) => ({
            mon_an_id: clone.id,
            nguyen_lieu_id: d.ingredientId,
            khoi_luong_song_sach: d.netWeight,
          })),
        });
      }

      return clone;
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return {
      id: cloned.id.toString(),
      originalDishId: original.id.toString(),
      name: cloned.ten_mon,
    };
  }

  /**
   * 9. Đề xuất món ăn: PUT /api/dish/:id/propose (và POST)
   * Tối ưu O(1) chống OOM: Kiểm tra trùng công thức qua index DB recipe_hash (idx_mon_an_recipe_hash)
   */
  async proposeDish(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<{ message: string }> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
      include: { chi_tiet_mon_an: true },
    });

    if (!dish || dish.nguoi_dung_id !== currentUser.id) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (dish.trang_thai !== DishStatus.RIENG_TU) {
      throw new HttpException(
        { code: 'PROP_020', message: 'Chỉ món ăn riêng tư mới được đề xuất công khai' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Kiểm tra xem món gốc này đã có đề xuất nào đang chờ duyệt hay chưa
    const existingPending = await this.prisma.mon_an.findFirst({
      where: {
        mon_goc_id: BigInt(id),
        trang_thai: DishStatus.CHO_DUYET,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new HttpException(
        {
          code: 'PROP_017',
          message: 'Món ăn này đang có đề xuất chờ duyệt, không thể đề xuất lại',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // ⚡ Tối ưu O(1) chống OOM: Kiểm tra index DB idx_mon_an_recipe_hash
    const hash =
      dish.recipe_hash ||
      computeRecipeHash(
        dish.chi_tiet_mon_an.map((d) => ({
          ingredientId: Number(d.nguyen_lieu_id),
          weight: d.khoi_luong_song_sach,
        })),
      );

    if (hash) {
      const duplicatePublic = await this.prisma.mon_an.findFirst({
        where: {
          recipe_hash: hash,
          trang_thai: DishStatus.DA_DUYET,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (duplicatePublic) {
        throw new HttpException(
          { code: 'PROP_021', message: 'Món ăn này đã được công khai với công thức tương tự' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.prisma.mon_an.update({
      where: { id: BigInt(id) },
      data: {
        trang_thai: DishStatus.CHO_DUYET,
        recipe_hash: hash,
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Đã gửi đề xuất' };
  }

  /**
   * 10. Phê duyệt món ăn: PUT /api/dish/:id/approve (Admin)
   */
  async approveDish(id: string | number, adminUser: { id: string }): Promise<{ message: string }> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
    });

    if (!dish) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (dish.trang_thai !== DishStatus.CHO_DUYET) {
      throw new HttpException(
        { code: 'DISH_001', message: 'Món ăn không ở trạng thái chờ duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.mon_an.update({
      where: { id: BigInt(id) },
      data: {
        trang_thai: DishStatus.DA_DUYET,
        ngay_phe_duyet: new Date(),
        nguoi_phe_duyet_id: adminUser.id,
        ly_do_tu_choi: null,
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Đã duyệt' };
  }

  /**
   * 11. Từ chối đề xuất món ăn: PUT /api/dish/:id/reject (Admin)
   */
  async rejectDish(
    id: string | number,
    reason: string,
    adminUser: { id: string },
  ): Promise<{ message: string }> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
    });

    if (!dish) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (dish.trang_thai !== DishStatus.CHO_DUYET) {
      throw new HttpException(
        { code: 'DISH_001', message: 'Món ăn không ở trạng thái chờ duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.mon_an.update({
      where: { id: BigInt(id) },
      data: {
        trang_thai: DishStatus.TU_CHOI,
        ly_do_tu_choi: reason,
        ngay_phe_duyet: new Date(),
        nguoi_phe_duyet_id: adminUser.id,
      },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Đã từ chối đề xuất' };
  }

  /**
   * 12. Xóa món ăn
   * Chặn xóa món công khai (DISH_CANNOT_DELETE - 403)
   * Chặn xóa nếu đang trong thực đơn (DISH_IN_USE - 409)
   */
  async delete(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<{ message: string }> {
    const dish = await this.prisma.mon_an.findFirst({
      where: { id: BigInt(id), deleted_at: null },
    });

    if (!dish) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    const isOwner = dish.nguoi_dung_id === currentUser.id;

    if (!isOwner && !isAdminUser) {
      throw new HttpException(
        { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 🔒 Chặn xóa món công khai / hệ thống
    if (this.isPublicDish(dish)) {
      throw new HttpException(
        { code: 'DISH_004', message: 'Không thể xóa món ăn đã duyệt hoặc món hệ thống' },
        HttpStatus.FORBIDDEN,
      );
    }

    // 🔒 Chặn xóa nếu đang được sử dụng trong thực đơn
    const inUseCount = await this.prisma.chi_tiet_bua_an.count({
      where: { mon_an_id: BigInt(id) },
    });

    if (inUseCount > 0) {
      throw new HttpException(
        { code: 'DISH_003', message: 'Không thể xóa món ăn này vì đã được sử dụng trong thực đơn' },
        HttpStatus.CONFLICT,
      );
    }

    // Soft-delete an toàn
    await this.prisma.mon_an.update({
      where: { id: BigInt(id) },
      data: { deleted_at: new Date() },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: `Xoá thành công món ăn với id: ${id}` };
  }
}
