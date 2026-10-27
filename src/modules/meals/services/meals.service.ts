import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService, MealInput } from '../../../core/nutrition-engine';
import { CreateMealDto, UpdateMealDto, MealResponseDto, MealDishResponseDto } from '../dto';
import { UserRole } from '../../../config/enums/role.enum';

@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);
  private readonly CACHE_TAG = 'meals';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly nutritionCalculator: NutritionCalculatorService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  private mapMealEntityToResponse(meal: any): MealResponseDto {
    const mealInput: MealInput = {
      id: meal.id,
      mealName: meal.ten_bua_an,
      chi_tiet_bua_an: (meal.chi_tiet_bua_an || []).map((detail: any) => ({
        dishId: detail.mon_an_id,
        he_so_song_chin: detail.he_so_song_chin,
        mon_an: {
          id: detail.mon_an?.id,
          ten_mon: detail.mon_an?.ten_mon,
          he_so_song_chin: detail.he_so_song_chin,
          chi_tiet_mon_an: (detail.mon_an?.chi_tiet_mon_an || []).map((cd: any) => ({
            ingredientId: cd.nguyen_lieu_id,
            khoi_luong_song_sach: cd.khoi_luong_song_sach,
            ingredient: cd.nguyen_lieu,
          })),
        },
      })),
    };

    const calculationResult = this.nutritionCalculator.calculateMealNutrition(mealInput);

    const dishResponses: MealDishResponseDto[] = (meal.chi_tiet_bua_an || []).map(
      (detail: any, index: number) => {
        const dishCalc = calculationResult.dishes[index];
        const coef = detail.he_so_song_chin != null ? Number(detail.he_so_song_chin) : 1.0;

        return {
          id: detail.mon_an?.id ? detail.mon_an.id.toString() : detail.mon_an_id.toString(),
          name: detail.mon_an?.ten_mon || '',
          dishWeight: dishCalc ? dishCalc.cookedWeightGrams : 0,
          coefficient: coef,
          nutrients: dishCalc ? dishCalc.nutrients : {},
        };
      },
    );

    return {
      id: meal.id.toString(),
      mealName: meal.ten_bua_an || null,
      time: meal.gio_an,
      status: meal.trang_thai || null,
      isPublic: Boolean(meal.la_cong_khai),
      totalMealNutrients: calculationResult.nutrients,
      dishes: dishResponses,
    };
  }

  async create(
    dto: CreateMealDto,
    currentUser: { id: string; role?: string },
  ): Promise<MealResponseDto> {
    // 1. Kiểm tra sự tồn tại của tất cả các món ăn
    const dishesList = dto.dishes || [];
    for (const d of dishesList) {
      const dish = await this.prisma.mon_an.findFirst({
        where: { id: BigInt(d.dishId), deleted_at: null },
        select: { id: true },
      });
      if (!dish) {
        throw new HttpException(
          { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 2. Tạo bữa ăn trong transaction
    const createdMeal = await this.prisma.$transaction(async (tx) => {
      const meal = await tx.bua_an.create({
        data: {
          nguoi_dung_id: currentUser.id,
          ten_bua_an: dto.mealName || null,
          gio_an: dto.time,
          trang_thai: dto.status || 'RIENG_TU',
          la_cong_khai: Boolean(dto.isPublic),
        },
      });

      if (dishesList.length > 0) {
        await tx.chi_tiet_bua_an.createMany({
          data: dishesList.map((d) => ({
            bua_an_id: meal.id,
            mon_an_id: BigInt(d.dishId),
            he_so_song_chin: d.coefficient != null && d.coefficient > 0 ? d.coefficient : 1.0,
          })),
        });
      }

      return tx.bua_an.findUnique({
        where: { id: meal.id },
        include: {
          chi_tiet_bua_an: {
            include: {
              mon_an: {
                include: {
                  chi_tiet_mon_an: {
                    include: { nguyen_lieu: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapMealEntityToResponse(createdMeal);
  }

  async findAll(currentUser?: { id?: string; role?: string }): Promise<MealResponseDto[]> {
    const isAdminUser = this.isAdmin(currentUser);

    const whereClause: any = isAdminUser
      ? {}
      : currentUser?.id
        ? {
            OR: [
              { nguoi_dung_id: currentUser.id },
              { la_cong_khai: true },
              { trang_thai: 'DA_DUYET' },
            ],
          }
        : {
            OR: [{ la_cong_khai: true }, { trang_thai: 'DA_DUYET' }],
          };

    const meals = await this.prisma.bua_an.findMany({
      where: whereClause,
      include: {
        chi_tiet_bua_an: {
          include: {
            mon_an: {
              include: {
                chi_tiet_mon_an: {
                  include: { nguyen_lieu: true },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return meals.map((meal) => this.mapMealEntityToResponse(meal));
  }

  async findById(
    id: string | number,
    currentUser?: { id?: string; role?: string },
  ): Promise<MealResponseDto> {
    const meal = await this.prisma.bua_an.findUnique({
      where: { id: BigInt(id) },
      include: {
        chi_tiet_bua_an: {
          include: {
            mon_an: {
              include: {
                chi_tiet_mon_an: {
                  include: { nguyen_lieu: true },
                },
              },
            },
          },
        },
      },
    });

    if (!meal) {
      throw new HttpException(
        { code: 'MEAL_001', message: 'Không tìm thấy bữa ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    const isOwner = currentUser?.id && meal.nguoi_dung_id === currentUser.id;
    const isPublic = meal.la_cong_khai || meal.trang_thai === 'DA_DUYET';

    if (!isAdminUser && !isOwner && !isPublic) {
      throw new HttpException(
        { code: 'MEAL_001', message: 'Không tìm thấy bữa ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapMealEntityToResponse(meal);
  }

  async update(
    id: string | number,
    dto: UpdateMealDto,
    currentUser: { id: string; role?: string },
  ): Promise<MealResponseDto> {
    const existing = await this.prisma.bua_an.findUnique({
      where: { id: BigInt(id) },
      include: { chi_tiet_bua_an: true },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'MEAL_001', message: 'Không tìm thấy bữa ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    if (!isAdminUser && existing.nguoi_dung_id !== currentUser.id) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Lưu lại hệ số sống/chín cũ theo món
    const oldCoefMap = new Map<number, number>();
    if (existing.chi_tiet_bua_an) {
      for (const old of existing.chi_tiet_bua_an) {
        oldCoefMap.set(
          Number(old.mon_an_id),
          old.he_so_song_chin != null ? Number(old.he_so_song_chin) : 1.0,
        );
      }
    }

    const newDishes = dto.dishes;

    if (newDishes && newDishes.length > 0) {
      for (const d of newDishes) {
        const dish = await this.prisma.mon_an.findFirst({
          where: { id: BigInt(d.dishId), deleted_at: null },
          select: { id: true },
        });
        if (!dish) {
          throw new HttpException(
            { code: 'PROP_019', message: 'Không tìm thấy món ăn' },
            HttpStatus.NOT_FOUND,
          );
        }
      }
    }

    const updatedMeal = await this.prisma.$transaction(async (tx) => {
      await tx.bua_an.update({
        where: { id: BigInt(id) },
        data: {
          ten_bua_an: dto.mealName !== undefined ? dto.mealName : undefined,
          gio_an: dto.time !== undefined ? dto.time : undefined,
          trang_thai: dto.status !== undefined ? dto.status : undefined,
          la_cong_khai: dto.isPublic !== undefined ? Boolean(dto.isPublic) : undefined,
        },
      });

      if (newDishes !== undefined) {
        await tx.chi_tiet_bua_an.deleteMany({
          where: { bua_an_id: BigInt(id) },
        });

        if (newDishes.length > 0) {
          await tx.chi_tiet_bua_an.createMany({
            data: newDishes.map((entry) => {
              const coef =
                entry.coefficient != null && entry.coefficient > 0
                  ? entry.coefficient
                  : (oldCoefMap.get(entry.dishId) ?? 1.0);

              return {
                bua_an_id: BigInt(id),
                mon_an_id: BigInt(entry.dishId),
                he_so_song_chin: coef,
              };
            }),
          });
        }
      }

      return tx.bua_an.findUnique({
        where: { id: BigInt(id) },
        include: {
          chi_tiet_bua_an: {
            include: {
              mon_an: {
                include: {
                  chi_tiet_mon_an: {
                    include: { nguyen_lieu: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return this.mapMealEntityToResponse(updatedMeal);
  }

  async delete(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<{ message: string }> {
    const existing = await this.prisma.bua_an.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'MEAL_001', message: 'Không tìm thấy bữa ăn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isAdminUser = this.isAdmin(currentUser);
    if (!isAdminUser && existing.nguoi_dung_id !== currentUser.id) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Bảo vệ xóa khi đang dùng trong thực đơn (MEAL_002)
    const inUseCount = await this.prisma.chi_tiet_thuc_don.count({
      where: { bua_an_id: BigInt(id) },
    });

    if (inUseCount > 0) {
      throw new HttpException(
        { code: 'MEAL_002', message: 'Không thể xóa bữa ăn này vì đã được sử dụng trong thực đơn' },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.chi_tiet_bua_an.deleteMany({
        where: { bua_an_id: BigInt(id) },
      });
      await tx.bua_an.delete({
        where: { id: BigInt(id) },
      });
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { message: 'Xóa bữa ăn thành công' };
  }
}
