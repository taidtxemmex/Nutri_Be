import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService, MealInput, MenuInput } from '../../../core/nutrition-engine';
import { computeRecipeHash } from '../../../core/nutrition-engine/recipe-hash.util';
import {
  MenuListDto,
  MenuDetailResponseDto,
  MenuFullResponseDto,
  MenuMutationResponseDto,
  ResolveDishDto,
  MenuMealDto,
  MenuDishDto,
  GetAllMenusParamsDto,
  GetMenuByIdParamsDto,
  GetFullMenuParamsDto,
  CreateMenuParamsDto,
  UpdateMenuParamsDto,
  DeleteMenuParamsDto,
  CloneMenuParamsDto,
  ResolveDishForMenuParamsDto,
} from '../dto';
import { MenuType, DishStatus } from '../../../config/enums/domain.enum';
import { isAdminRole } from '../../../config/enums/role.enum';
import {
  CACHE_TAG_PATIENTS,
  CACHE_TTL_PERPETUAL,
  buildPatientCacheTag,
  buildPatientDetailCacheKey,
} from '../../../config/constants/cache.constants';
import { PatientsService } from '../../patients/services/patients.service';
import { Optional } from '@nestjs/common';

export interface UpdateMenuEnergyDisplayParamDto {
  menuId: bigint;
  tx?: any;
}

export interface HandleMealInTransactionParamDto {
  mealDto: MenuMealDto;
  currentUser: { id: string; role?: string };
  tx: any;
}

export interface ResolveDishInTransactionParamDto {
  dishDto: MenuDishDto | ResolveDishDto;
  currentUser: { id: string; role?: string };
  tx: any;
}

export interface ResolveMealWithCopyOnWriteParamDto {
  mealDto: MenuMealDto;
  currentUser: { id: string; role?: string };
  tx: any;
}

@Injectable()
export class MenusService {
  private readonly logger = new Logger(MenusService.name);
  private readonly CACHE_TAG = 'menus';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly nutritionCalculator: NutritionCalculatorService,
    @Optional() private readonly patientsService?: PatientsService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  /**
   * Helper: Lấy thông tin menu đầy đủ kèm nguyên liệu để tính toán dinh dưỡng
   */
  private async loadFullMenuEntityForCalculation(menuId: bigint): Promise<any> {
    return this.prisma.thuc_don.findUnique({
      where: { id: menuId },
      include: {
        benh_nhan: true,
        nhom_benh_mo_rong: true,
        gioi_han_dinh_duong: true,
        chi_tiet_thuc_don: {
          include: {
            bua_an: {
              include: {
                chi_tiet_bua_an: {
                  include: {
                    mon_an: {
                      include: {
                        chi_tiet_mon_an: {
                          include: {
                            nguyen_lieu: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Chuyển đổi entity Menu sang format chuẩn của NutritionCalculatorService
   */
  private mapMenuEntityToEngineInput(menuEntity: any): MenuInput {
    const details = (menuEntity.chi_tiet_thuc_don || []).map((detail: any) => {
      const meal = detail.bua_an;
      const mealInput: MealInput = {
        id: meal?.id,
        mealName: meal?.ten_bua_an,
        gio_an: meal?.gio_an,
        chi_tiet_bua_an: (meal?.chi_tiet_bua_an || []).map((mb: any) => ({
          dishId: mb.mon_an_id,
          he_so_song_chin: mb.he_so_song_chin,
          mon_an: {
            id: mb.mon_an?.id,
            ten_mon: mb.mon_an?.ten_mon,
            he_so_song_chin: mb.he_so_song_chin,
            chi_tiet_mon_an: (mb.mon_an?.chi_tiet_mon_an || []).map((cd: any) => ({
              ingredientId: cd.nguyen_lieu_id,
              khoi_luong_song_sach: cd.khoi_luong_song_sach,
              ingredient: cd.nguyen_lieu,
            })),
          },
        })),
      };

      return {
        id: detail.id,
        weekNo: detail.so_tuan,
        dayOfWeek: detail.thu_trong_tuan,
        thu_tu_trong_tuan: detail.thu_tu_trong_tuan,
        meal: mealInput,
      };
    });

    return {
      id: menuEntity.id,
      menuType: menuEntity.loai_thuc_don,
      ten_thuc_don: menuEntity.ten_thuc_don,
      menuDetails: details,
    };
  }

  /**
   * Tính và cập nhật chuỗi hiển thị tổng năng lượng (kcal) cho thực đơn
   */
  private async updateMenuEnergyDisplay(
    paramOrMenuId: UpdateMenuEnergyDisplayParamDto | bigint,
    legacyTx?: any,
  ): Promise<string> {
    let menuId: bigint;
    let tx: any;
    if (paramOrMenuId && typeof paramOrMenuId === 'object' && 'menuId' in paramOrMenuId) {
      menuId = paramOrMenuId.menuId;
      tx = paramOrMenuId.tx;
    } else {
      menuId = paramOrMenuId as bigint;
      tx = legacyTx;
    }
    const client = tx || this.prisma;
    const fullMenu = await this.loadFullMenuEntityForCalculation(menuId);
    if (!fullMenu) return '0 kcal';

    const engineInput = this.mapMenuEntityToEngineInput(fullMenu);
    const energyDisplay = this.nutritionCalculator.getMenuEnergyDisplay(engineInput);

    await client.thuc_don.update({
      where: { id: menuId },
      data: { tong_nang_luong: energyDisplay },
    });

    return energyDisplay;
  }

  /**
   * 1. GET /api/menus & /api/menu: Lấy danh sách thực đơn phân trang (Anti-Overfetching)
   */
  async getAll({ query, currentUser }: GetAllMenusParamsDto): Promise<{
    items: MenuListDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const searchTerm = query.keyword?.trim() || query.search?.trim();

    const where: any = {
      deleted_at: null,
    };

    if (query.isPublic) {
      where.loai_thuc_don = { in: ['CONG_KHAI', 'MAU_HE_THONG'] };
    } else {
      if (!this.isAdmin(currentUser)) {
        where.nguoi_dung_id = currentUser.id;
      }
    }

    if (searchTerm) {
      where.ten_thuc_don = { contains: searchTerm };
    }

    if (query.menuType) {
      where.loai_thuc_don = query.menuType;
    }

    if (query.targetType) {
      where.loai_doi_tuong = query.targetType;
    }

    if (query.patientId) {
      where.benh_nhan_id = BigInt(query.patientId);
    }

    if (query.diseaseGroupId) {
      where.nhom_benh_id = Number(query.diseaseGroupId);
    }

    // Explicit select projection chống overfetching
    const [total, rows] = await Promise.all([
      this.prisma.thuc_don.count({ where }),
      this.prisma.thuc_don.findMany({
        where,
        select: {
          id: true,
          ten_thuc_don: true,
          loai_thuc_don: true,
          loai_doi_tuong: true,
          ngay_tao: true,
          tong_nang_luong: true,
          nguoi_dung_id: true,
          benh_nhan_id: true,
          nhom_benh_id: true,
          gioi_han_dinh_duong_id: true,
          benh_nhan: {
            select: { id: true, ho_ten: true },
          },
          nhom_benh_mo_rong: {
            select: { id: true, ten_hien_thi: true },
          },
          nguoi_dung: {
            select: {
              id: true,
              ten_dang_nhap: true,
              ho_so_ca_nhan: {
                select: { ho_ten: true },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: MenuListDto[] = rows.map((r) => ({
      id: r.id.toString(),
      menuName: r.ten_thuc_don,
      menuType: r.loai_thuc_don,
      targetType: r.loai_doi_tuong,
      createdDate: r.ngay_tao,
      totalEnergy: r.tong_nang_luong || null,
      createdBy: r.nguoi_dung?.ho_so_ca_nhan?.ho_ten || r.nguoi_dung?.ten_dang_nhap || null,
      patientId: r.benh_nhan_id ? r.benh_nhan_id.toString() : null,
      patientName: r.benh_nhan?.ho_ten || null,
      diseaseGroupId: r.nhom_benh_id || null,
      diseaseGroupName: r.nhom_benh_mo_rong?.ten_hien_thi || null,
      nutritionLimitSetId: r.gioi_han_dinh_duong_id ? r.gioi_han_dinh_duong_id.toString() : null,
    }));

    return { items, total, page, limit };
  }

  /**
   * 2. GET /api/menus/:id & /api/menu/:id: Lấy chi tiết thực đơn theo ngày/tuần
   */
  async getById({
    id,
    weekNo,
    dayOfWeek,
    currentUser,
  }: GetMenuByIdParamsDto): Promise<MenuDetailResponseDto> {
    const menuId = BigInt(id);
    const menu = await this.prisma.thuc_don.findFirst({
      where: { id: menuId, deleted_at: null },
      include: {
        benh_nhan: true,
        nhom_benh_mo_rong: true,
        gioi_han_dinh_duong: true,
        nguoi_dung: {
          select: {
            id: true,
            ten_dang_nhap: true,
            ho_so_ca_nhan: { select: { ho_ten: true } },
          },
        },
        chi_tiet_thuc_don: {
          include: {
            bua_an: {
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
            },
          },
        },
      },
    });

    if (!menu) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isOwner = currentUser && menu.nguoi_dung_id === currentUser.id;
    const isPublic = menu.loai_thuc_don === 'CONG_KHAI' || menu.loai_thuc_don === 'MAU_HE_THONG';

    if (!isOwner && !isPublic && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Lọc chi tiết theo loại thực đơn và tham số lọc tuần/ngày
    let filteredDetails = menu.chi_tiet_thuc_don || [];

    if (menu.loai_thuc_don === MenuType.TUAN || menu.loai_thuc_don === MenuType.THANG) {
      filteredDetails = filteredDetails.filter((md) => {
        const matchWeek = weekNo == null || md.so_tuan === Number(weekNo);
        const matchDay = dayOfWeek == null || md.thu_trong_tuan === Number(dayOfWeek);
        return matchWeek && matchDay;
      });
    }

    // Chuyển đổi và tính toán dinh dưỡng từng bữa ăn
    const mealResponses: any[] = [];
    const totalDayNutrients: Record<string, number> = {};

    for (const md of filteredDetails) {
      const meal = md.bua_an;
      if (!meal) continue;

      const mealInput: MealInput = {
        id: meal.id,
        mealName: meal.ten_bua_an,
        gio_an: meal.gio_an,
        chi_tiet_bua_an: (meal.chi_tiet_bua_an || []).map((mb: any) => ({
          dishId: mb.mon_an_id,
          he_so_song_chin: mb.he_so_song_chin,
          mon_an: {
            id: mb.mon_an?.id,
            ten_mon: mb.mon_an?.ten_mon,
            he_so_song_chin: mb.he_so_song_chin,
            chi_tiet_mon_an: (mb.mon_an?.chi_tiet_mon_an || []).map((cd: any) => ({
              ingredientId: cd.nguyen_lieu_id,
              khoi_luong_song_sach: cd.khoi_luong_song_sach,
              ingredient: cd.nguyen_lieu,
            })),
          },
        })),
      };

      const mealCalc = this.nutritionCalculator.calculateMealNutrition(mealInput);

      const dishSummaries = (meal.chi_tiet_bua_an || []).map((mb: any, idx: number) => {
        const dishCalc = mealCalc.dishes[idx];
        const coef = mb.he_so_song_chin != null ? Number(mb.he_so_song_chin) : 1.0;

        return {
          id: mb.mon_an?.id ? mb.mon_an.id.toString() : mb.mon_an_id.toString(),
          name: mb.mon_an?.ten_mon || '',
          dishWeight: dishCalc ? dishCalc.cookedWeightGrams : 0,
          coefficient: coef,
          nutrients: dishCalc ? dishCalc.nutrients : {},
        };
      });

      // Cộng dồn vi chất vào ngày
      for (const [k, v] of Object.entries(mealCalc.nutrients)) {
        totalDayNutrients[k] = Number(((totalDayNutrients[k] || 0) + v).toFixed(2));
      }

      mealResponses.push({
        id: meal.id.toString(),
        mealName: meal.ten_bua_an || null,
        time: meal.gio_an,
        dishes: dishSummaries,
        totalMealNutrients: mealCalc.nutrients,
      });
    }

    return {
      id: menu.id.toString(),
      menuName: menu.ten_thuc_don,
      menuType: menu.loai_thuc_don,
      targetType: menu.loai_doi_tuong,
      createdDate: menu.ngay_tao,
      createdBy: menu.nguoi_dung?.ho_so_ca_nhan?.ho_ten || menu.nguoi_dung?.ten_dang_nhap || null,
      patientId: menu.benh_nhan_id ? menu.benh_nhan_id.toString() : null,
      patientName: menu.benh_nhan?.ho_ten || null,
      diseaseGroupId: menu.nhom_benh_id || null,
      diseaseGroupName: menu.nhom_benh_mo_rong?.ten_hien_thi || null,
      nutritionLimitSetId: menu.gioi_han_dinh_duong_id
        ? menu.gioi_han_dinh_duong_id.toString()
        : null,
      weekNo: weekNo || null,
      dayOfWeek: dayOfWeek || null,
      meals: mealResponses,
      totalDayNutrients,
    };
  }

  /**
   * 3. GET /api/menus/:id/full & /api/menu/:id/full: Lấy toàn bộ cây 5 cấp thực đơn
   */
  async getFullMenu({ id, currentUser }: GetFullMenuParamsDto): Promise<MenuFullResponseDto> {
    const menuId = BigInt(id);
    const menu = await this.prisma.thuc_don.findFirst({
      where: { id: menuId, deleted_at: null },
      include: {
        chi_tiet_thuc_don: {
          include: {
            bua_an: {
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
            },
          },
        },
      },
    });

    if (!menu) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isOwner = currentUser && menu.nguoi_dung_id === currentUser.id;
    const isPublic = menu.loai_thuc_don === 'CONG_KHAI' || menu.loai_thuc_don === 'MAU_HE_THONG';

    if (!isOwner && !isPublic && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Gom dữ liệu theo week -> day -> meal -> dish
    const weekMap = new Map<number, Map<number, any>>();

    for (const md of menu.chi_tiet_thuc_don || []) {
      const weekNo = md.so_tuan != null ? md.so_tuan : 0;
      const dayOfWeek = md.thu_trong_tuan != null ? md.thu_trong_tuan : 0;

      if (!weekMap.has(weekNo)) {
        weekMap.set(weekNo, new Map<number, any>());
      }
      const dayMap = weekMap.get(weekNo)!;

      if (!dayMap.has(dayOfWeek)) {
        dayMap.set(dayOfWeek, {
          dayOfWeek,
          meals: [],
        });
      }
      const dayObj = dayMap.get(dayOfWeek);

      const meal = md.bua_an;
      if (!meal) continue;

      const dishDTOs = (meal.chi_tiet_bua_an || []).map((mb: any) => {
        const dish = mb.mon_an;
        const details = (dish?.chi_tiet_mon_an || []).map((cd: any) => ({
          ingredientId: cd.nguyen_lieu_id.toString(),
          ingredientName: cd.nguyen_lieu?.ten_nguyen_lieu || '',
          netWeight: cd.khoi_luong_song_sach != null ? Number(cd.khoi_luong_song_sach) : 0,
        }));

        return {
          id: dish ? dish.id.toString() : mb.mon_an_id.toString(),
          name: dish?.ten_mon || '',
          coefficient: mb.he_so_song_chin != null ? Number(mb.he_so_song_chin) : 1.0,
          details,
        };
      });

      dayObj.meals.push({
        id: meal.id.toString(),
        mealName: meal.ten_bua_an || null,
        time: meal.gio_an,
        status: meal.trang_thai || 'RIENG_TU',
        isPublic: Boolean(meal.la_cong_khai),
        dishes: dishDTOs,
      });
    }

    const weeks = Array.from(weekMap.entries()).map(([weekNo, dayMap]) => ({
      weekNo,
      days: Array.from(dayMap.values()),
    }));

    return {
      id: menu.id.toString(),
      menuName: menu.ten_thuc_don,
      menuType: menu.loai_thuc_don,
      targetType: menu.loai_doi_tuong,
      patientId: menu.benh_nhan_id ? menu.benh_nhan_id.toString() : null,
      diseaseGroupId: menu.nhom_benh_id || null,
      nutritionLimitSetId: menu.gioi_han_dinh_duong_id
        ? menu.gioi_han_dinh_duong_id.toString()
        : null,
      weeks,
    };
  }

  /**
   * Helper: Xử lý hoặc tạo bữa ăn trong Transaction
   */
  private async handleMealInTransaction(
    paramOrDto: HandleMealInTransactionParamDto | MenuMealDto,
    legacyCurrentUser?: { id: string; role?: string },
    legacyTx?: any,
  ): Promise<bigint> {
    let mealDto: MenuMealDto;
    let currentUser: { id: string; role?: string };
    let tx: any;

    if (paramOrDto && typeof paramOrDto === 'object' && 'mealDto' in paramOrDto) {
      mealDto = paramOrDto.mealDto;
      currentUser = paramOrDto.currentUser;
      tx = paramOrDto.tx;
    } else {
      mealDto = paramOrDto as MenuMealDto;
      currentUser = legacyCurrentUser!;
      tx = legacyTx;
    }
    let mealId: bigint;

    if (mealDto.mealId) {
      mealId = BigInt(mealDto.mealId);
      const existingMeal = await tx.bua_an.findUnique({
        where: { id: mealId },
        select: { id: true, nguoi_dung_id: true },
      });

      if (!existingMeal) {
        throw new HttpException(
          { code: 'MEAL_NOT_FOUND', message: 'Không tìm thấy bữa ăn' },
          HttpStatus.NOT_FOUND,
        );
      }
    } else {
      const createdMeal = await tx.bua_an.create({
        data: {
          nguoi_dung_id: currentUser.id,
          ten_bua_an: mealDto.mealName || null,
          gio_an: mealDto.time,
          trang_thai: mealDto.status || 'RIENG_TU',
          la_cong_khai: Boolean(mealDto.isPublic),
        },
      });
      mealId = createdMeal.id;
    }

    // Nếu có danh sách món ăn, tạo các chi tiết món ăn cho bữa ăn này
    if (mealDto.dishes && mealDto.dishes.length > 0) {
      for (const dishDto of mealDto.dishes) {
        const dishId = await this.resolveDishInTransaction({ dishDto, currentUser, tx });

        await tx.chi_tiet_bua_an.upsert({
          where: {
            bua_an_id_mon_an_id: {
              bua_an_id: mealId,
              mon_an_id: dishId,
            },
          },
          create: {
            bua_an_id: mealId,
            mon_an_id: dishId,
            he_so_song_chin: dishDto.coefficient != null ? dishDto.coefficient : 1.0,
          },
          update: {
            he_so_song_chin: dishDto.coefficient != null ? dishDto.coefficient : 1.0,
          },
        });
      }
    }

    return mealId;
  }

  /**
   * Helper: Xử lý gắn món có sẵn hoặc tạo món inline theo recipe
   */
  private async resolveDishInTransaction(
    paramOrDto: ResolveDishInTransactionParamDto | MenuDishDto | ResolveDishDto,
    legacyCurrentUser?: { id: string; role?: string },
    legacyTx?: any,
  ): Promise<bigint> {
    let dishDto: MenuDishDto | ResolveDishDto;
    let currentUser: { id: string; role?: string };
    let tx: any;

    if (paramOrDto && typeof paramOrDto === 'object' && 'dishDto' in paramOrDto) {
      dishDto = paramOrDto.dishDto;
      currentUser = paramOrDto.currentUser;
      tx = paramOrDto.tx;
    } else {
      dishDto = paramOrDto as MenuDishDto | ResolveDishDto;
      currentUser = legacyCurrentUser!;
      tx = legacyTx;
    }
    // 1. Nếu có dishId và không có chi tiết nguyên liệu -> dùng lại món có sẵn
    if (dishDto.dishId && (!dishDto.details || dishDto.details.length === 0)) {
      const dish = await tx.mon_an.findFirst({
        where: { id: BigInt(dishDto.dishId), deleted_at: null },
        select: { id: true },
      });
      if (!dish) {
        throw new HttpException(
          { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn' },
          HttpStatus.NOT_FOUND,
        );
      }
      return dish.id;
    }

    // 2. Nếu có chi tiết nguyên liệu, tính toán recipe_hash
    if (dishDto.details && dishDto.details.length > 0) {
      const recipeComponents = dishDto.details.map((d) => ({
        ingredientId: d.ingredientId,
        weightGrams: d.netWeight,
      }));
      const hash = computeRecipeHash(recipeComponents);

      // Kiểm tra món hệ thống hoặc món của user có cùng recipe_hash
      const existingMatch = await tx.mon_an.findFirst({
        where: {
          recipe_hash: hash,
          deleted_at: null,
          OR: [
            { trang_thai: DishStatus.HE_THONG },
            { trang_thai: DishStatus.DA_DUYET },
            { nguoi_dung_id: currentUser.id },
          ],
        },
        select: { id: true },
      });

      if (existingMatch) {
        return existingMatch.id;
      }

      // Tạo món mới inline
      const dishName = dishDto.name?.trim() || 'Món ăn tùy chỉnh';
      const createdDish = await tx.mon_an.create({
        data: {
          ten_mon: dishName,
          nguoi_dung_id: currentUser.id,
          trang_thai: DishStatus.RIENG_TU,
          recipe_hash: hash,
          mon_goc_id: dishDto.dishId ? BigInt(dishDto.dishId) : null,
          ngay_tao: new Date(),
        },
      });

      // Tạo các chi tiết nguyên liệu
      for (const d of dishDto.details) {
        await tx.chi_tiet_mon_an.create({
          data: {
            mon_an_id: createdDish.id,
            nguyen_lieu_id: BigInt(d.ingredientId),
            khoi_luong_song_sach: d.netWeight,
          },
        });
      }

      return createdDish.id;
    }

    if (dishDto.dishId) {
      return BigInt(dishDto.dishId);
    }

    throw new HttpException(
      { code: 'DISH_INVALID', message: 'Thông tin món ăn không hợp lệ' },
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * 4. POST /api/menus & /api/menu: Tạo mới thực đơn lồng 5 cấp trong 1 Transaction nguyên tử
   */
  async create({ dto, currentUser }: CreateMenuParamsDto): Promise<MenuMutationResponseDto> {
    // Kiểm tra bệnh nhân thuộc user (nếu có) - Tái sử dụng Cache thực thể 0ms
    if (dto.patientId) {
      let patient: any;
      if (this.patientsService) {
        patient = await this.patientsService.getPatientEntity({ id: dto.patientId });
      } else if (this.cacheService && typeof this.cacheService.getOrSet === 'function') {
        patient = await this.cacheService.getOrSet(
          buildPatientDetailCacheKey(dto.patientId),
          CACHE_TTL_PERPETUAL,
          async () =>
            this.prisma.benh_nhan.findFirst({
              where: { id: BigInt(dto.patientId), deleted_at: null },
            }),
          [CACHE_TAG_PATIENTS, buildPatientCacheTag(dto.patientId)],
        );
      } else {
        patient = await this.prisma.benh_nhan.findFirst({
          where: { id: BigInt(dto.patientId), deleted_at: null },
        });
      }

      if (
        !patient ||
        patient.deleted_at ||
        (patient.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser))
      ) {
        throw new HttpException(
          { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Transaction lồng 5 cấp
    const createdMenu = await this.prisma.$transaction(
      async (tx) => {
        const menu = await tx.thuc_don.create({
          data: {
            nguoi_dung_id: currentUser.id,
            ten_thuc_don: dto.menuName.trim(),
            loai_thuc_don: dto.menuType,
            loai_doi_tuong: dto.targetType,
            benh_nhan_id: dto.patientId ? BigInt(dto.patientId) : null,
            nhom_benh_id: dto.diseaseGroupId || null,
            gioi_han_dinh_duong_id: dto.nutritionLimitSetId
              ? BigInt(dto.nutritionLimitSetId)
              : null,
            ngay_tao: new Date(),
          },
        });

        // Xử lý chi tiết thực đơn
        if (dto.menuType === MenuType.NGAY && dto.meals && dto.meals.length > 0) {
          for (let i = 0; i < dto.meals.length; i++) {
            const mealDto = dto.meals[i];
            const mealId = await this.handleMealInTransaction({ mealDto, currentUser, tx });

            await tx.chi_tiet_thuc_don.create({
              data: {
                thuc_don_id: menu.id,
                bua_an_id: mealId,
                so_tuan: null,
                thu_trong_tuan: null,
                thu_tu_trong_tuan: i + 1,
              },
            });
          }
        } else if (
          (dto.menuType === MenuType.TUAN || dto.menuType === MenuType.THANG) &&
          dto.weeks &&
          dto.weeks.length > 0
        ) {
          for (const week of dto.weeks) {
            for (const day of week.days || []) {
              if (!day.meals) continue;
              for (let i = 0; i < day.meals.length; i++) {
                const mealDto = day.meals[i];
                const mealId = await this.handleMealInTransaction({ mealDto, currentUser, tx });

                await tx.chi_tiet_thuc_don.create({
                  data: {
                    thuc_don_id: menu.id,
                    bua_an_id: mealId,
                    so_tuan: week.weekNo,
                    thu_trong_tuan: day.dayOfWeek,
                    thu_tu_trong_tuan: i + 1,
                  },
                });
              }
            }
          }
        }

        return menu;
      },
      { timeout: 15000 },
    );

    // Tính toán năng lượng tổng và lưu lại
    const totalEnergy = await this.updateMenuEnergyDisplay({ menuId: createdMenu.id });
    await this.cacheService.invalidateTag(this.CACHE_TAG);

    return {
      id: createdMenu.id.toString(),
      menuName: createdMenu.ten_thuc_don,
      menuType: createdMenu.loai_thuc_don,
      message: 'Tạo thực đơn thành công',
      totalEnergy,
    };
  }

  /**
   * 5. PUT /api/menus/:id & /api/menu/:id: Cập nhật thực đơn với cơ chế Copy-on-Write (CoW) cho bữa ăn
   */
  async update({ id, dto, currentUser }: UpdateMenuParamsDto): Promise<MenuMutationResponseDto> {
    const menuId = BigInt(id);

    const existingMenu = await this.prisma.thuc_don.findFirst({
      where: { id: menuId, deleted_at: null },
      select: { id: true, nguoi_dung_id: true, ten_thuc_don: true, loai_thuc_don: true },
    });

    if (!existingMenu) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (existingMenu.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Khóa cấm sửa nếu đang có đề xuất chờ duyệt (REQ-P02)
    const hasPendingProposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: {
        menu_goc_id: menuId,
        trang_thai: 'CHO_DUYET',
      },
      select: { id: true },
    });

    if (hasPendingProposal) {
      throw new HttpException(
        {
          code: 'MENU_PENDING_PROPOSAL',
          message: 'Thực đơn đang có đề xuất chờ duyệt, không thể chỉnh sửa',
        },
        HttpStatus.CONFLICT,
      );
    }

    const updatedMenu = await this.prisma.$transaction(
      async (tx) => {
        // 1. Cập nhật thông tin cơ bản
        const menu = await tx.thuc_don.update({
          where: { id: menuId },
          data: {
            ten_thuc_don:
              dto.menuName !== undefined ? dto.menuName.trim() : existingMenu.ten_thuc_don,
            loai_thuc_don: dto.menuType !== undefined ? dto.menuType : existingMenu.loai_thuc_don,
            loai_doi_tuong: dto.targetType !== undefined ? dto.targetType : undefined,
            benh_nhan_id:
              dto.patientId !== undefined
                ? dto.patientId
                  ? BigInt(dto.patientId)
                  : null
                : undefined,
            nhom_benh_id: dto.diseaseGroupId !== undefined ? dto.diseaseGroupId : undefined,
            gioi_han_dinh_duong_id:
              dto.nutritionLimitSetId !== undefined
                ? dto.nutritionLimitSetId
                  ? BigInt(dto.nutritionLimitSetId)
                  : null
                : undefined,
          },
        });

        // 2. Nếu có gửi danh sách cấu trúc mới (meals hoặc weeks) -> Xóa liên kết cũ & áp dụng Copy-on-Write
        const shouldUpdateDetails = dto.meals !== undefined || dto.weeks !== undefined;

        if (shouldUpdateDetails) {
          // Xóa quan hệ chi_tiet_thuc_don cũ của menu này
          await tx.chi_tiet_thuc_don.deleteMany({
            where: { thuc_don_id: menuId },
          });

          // Áp dụng Copy-on-Write khi chèn các bữa ăn
          const currentMenuType = dto.menuType || existingMenu.loai_thuc_don;
          const isDaily =
            currentMenuType === MenuType.NGAY ||
            (dto.meals !== undefined && dto.meals.length > 0 && !dto.weeks);

          if (isDaily && dto.meals) {
            for (let i = 0; i < dto.meals.length; i++) {
              const mealDto = dto.meals[i];
              const resolvedMealId = await this.resolveMealWithCopyOnWrite({
                mealDto,
                currentUser,
                tx,
              });

              await tx.chi_tiet_thuc_don.create({
                data: {
                  thuc_don_id: menuId,
                  bua_an_id: resolvedMealId,
                  so_tuan: null,
                  thu_trong_tuan: null,
                  thu_tu_trong_tuan: i + 1,
                },
              });
            }
          } else if (dto.weeks) {
            for (const week of dto.weeks) {
              for (const day of week.days || []) {
                if (!day.meals) continue;
                for (let i = 0; i < day.meals.length; i++) {
                  const mealDto = day.meals[i];
                  const resolvedMealId = await this.resolveMealWithCopyOnWrite({
                    mealDto,
                    currentUser,
                    tx,
                  });

                  await tx.chi_tiet_thuc_don.create({
                    data: {
                      thuc_don_id: menuId,
                      bua_an_id: resolvedMealId,
                      so_tuan: week.weekNo,
                      thu_trong_tuan: day.dayOfWeek,
                      thu_tu_trong_tuan: i + 1,
                    },
                  });
                }
              }
            }
          }
        }

        return menu;
      },
      { timeout: 15000 },
    );

    const totalEnergy = await this.updateMenuEnergyDisplay({ menuId });
    await this.cacheService.invalidateTag(this.CACHE_TAG);

    return {
      id: updatedMenu.id.toString(),
      menuName: updatedMenu.ten_thuc_don,
      menuType: updatedMenu.loai_thuc_don,
      message: 'Cập nhật thực đơn thành công',
      totalEnergy,
    };
  }

  /**
   * Helper: Cơ chế Copy-on-Write cho bữa ăn
   * Nếu mealId được dùng chung bởi nhiều thực đơn khác -> TẠO BẢN SAO (Clone) thay vì ghi đè làm biến dạng thực đơn khác!
   */
  private async resolveMealWithCopyOnWrite(
    paramOrDto: ResolveMealWithCopyOnWriteParamDto | MenuMealDto,
    legacyCurrentUser?: { id: string; role?: string },
    legacyTx?: any,
  ): Promise<bigint> {
    let mealDto: MenuMealDto;
    let currentUser: { id: string; role?: string };
    let tx: any;

    if (paramOrDto && typeof paramOrDto === 'object' && 'mealDto' in paramOrDto) {
      mealDto = paramOrDto.mealDto;
      currentUser = paramOrDto.currentUser;
      tx = paramOrDto.tx;
    } else {
      mealDto = paramOrDto as MenuMealDto;
      currentUser = legacyCurrentUser!;
      tx = legacyTx;
    }
    if (!mealDto.mealId) {
      return this.handleMealInTransaction({ mealDto, currentUser, tx });
    }

    const originalMealId = BigInt(mealDto.mealId);
    const originalMeal = await tx.bua_an.findUnique({
      where: { id: originalMealId },
      include: { chi_tiet_bua_an: true },
    });

    if (!originalMeal) {
      return this.handleMealInTransaction({ mealDto, currentUser, tx });
    }

    // Đếm số lượng thực đơn đang sử dụng chung bữa ăn này
    const usageCount = await tx.chi_tiet_thuc_don.count({
      where: { bua_an_id: originalMealId },
    });

    const isShared = usageCount > 0;
    const isOtherUser = originalMeal.nguoi_dung_id !== currentUser.id;

    // Nếu bữa ăn đang được dùng ở thực đơn khác hoặc của người dùng khác -> COPY-ON-WRITE
    if (isShared || isOtherUser) {
      this.logger.log(
        `[Copy-on-Write] Tách bữa ăn ID=${originalMealId} (usageCount=${usageCount}) thành bản sao mới cho người dùng ${currentUser.id}`,
      );

      const cloneMeal = await tx.bua_an.create({
        data: {
          nguoi_dung_id: currentUser.id,
          ten_bua_an: mealDto.mealName || originalMeal.ten_bua_an,
          gio_an: mealDto.time || originalMeal.gio_an,
          trang_thai: 'RIENG_TU',
          la_cong_khai: false,
        },
      });

      // Nếu người dùng gửi dishes mới thì dùng dishes mới, không thì clone dishes cũ
      if (mealDto.dishes && mealDto.dishes.length > 0) {
        for (const dishDto of mealDto.dishes) {
          const dishId = await this.resolveDishInTransaction({ dishDto, currentUser, tx });
          await tx.chi_tiet_bua_an.create({
            data: {
              bua_an_id: cloneMeal.id,
              mon_an_id: dishId,
              he_so_song_chin: dishDto.coefficient != null ? dishDto.coefficient : 1.0,
            },
          });
        }
      } else {
        for (const detail of originalMeal.chi_tiet_bua_an) {
          await tx.chi_tiet_bua_an.create({
            data: {
              bua_an_id: cloneMeal.id,
              mon_an_id: detail.mon_an_id,
              he_so_song_chin: detail.he_so_song_chin,
            },
          });
        }
      }

      return cloneMeal.id;
    }

    // Nếu là bữa ăn riêng của mình và không chia sẻ ở thực đơn nào khác -> Cập nhật trực tiếp
    await tx.bua_an.update({
      where: { id: originalMealId },
      data: {
        ten_bua_an: mealDto.mealName !== undefined ? mealDto.mealName : originalMeal.ten_bua_an,
        gio_an: mealDto.time !== undefined ? mealDto.time : originalMeal.gio_an,
        trang_thai: mealDto.status !== undefined ? mealDto.status : originalMeal.trang_thai,
        la_cong_khai:
          mealDto.isPublic !== undefined ? Boolean(mealDto.isPublic) : originalMeal.la_cong_khai,
      },
    });

    if (mealDto.dishes) {
      await tx.chi_tiet_bua_an.deleteMany({
        where: { bua_an_id: originalMealId },
      });

      for (const dishDto of mealDto.dishes) {
        const dishId = await this.resolveDishInTransaction({ dishDto, currentUser, tx });
        await tx.chi_tiet_bua_an.create({
          data: {
            bua_an_id: originalMealId,
            mon_an_id: dishId,
            he_so_song_chin: dishDto.coefficient != null ? dishDto.coefficient : 1.0,
          },
        });
      }
    }

    return originalMealId;
  }

  /**
   * 6. DELETE /api/menus/:id & /api/menu/:id: Xóa thực đơn an toàn
   */
  async delete({
    id,
    currentUser,
  }: DeleteMenuParamsDto): Promise<{ success: boolean; message: string }> {
    const menuId = BigInt(id);

    const menu = await this.prisma.thuc_don.findFirst({
      where: { id: menuId, deleted_at: null },
      select: { id: true, nguoi_dung_id: true },
    });

    if (!menu) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (menu.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Kiểm tra xem thực đơn có liên kết đề xuất đang chờ duyệt không
    const pendingProposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { menu_goc_id: menuId, trang_thai: 'CHO_DUYET' },
      select: { id: true },
    });

    if (pendingProposal) {
      throw new HttpException(
        {
          code: 'MENU_IN_USE',
          message: 'Không thể xóa thực đơn đang có đề xuất chờ duyệt',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Xóa mềm thực đơn để bảo toàn lịch sử
    await this.prisma.thuc_don.update({
      where: { id: menuId },
      data: { deleted_at: new Date() },
    });

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return { success: true, message: 'Xóa thực đơn thành công' };
  }

  /**
   * 7. POST /api/menus/:id/clone & /api/menu/:id/clone: Deep clone cây thực đơn sang ID mới
   */
  async clone({ id, currentUser }: CloneMenuParamsDto): Promise<MenuMutationResponseDto> {
    const originalMenuId = BigInt(id);

    const original = await this.prisma.thuc_don.findFirst({
      where: { id: originalMenuId, deleted_at: null },
      include: {
        chi_tiet_thuc_don: {
          include: {
            bua_an: {
              include: {
                chi_tiet_bua_an: true,
              },
            },
          },
        },
      },
    });

    if (!original) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn gốc' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isOwner = currentUser && original.nguoi_dung_id === currentUser.id;
    const isPublic =
      original.loai_thuc_don === 'CONG_KHAI' || original.loai_thuc_don === 'MAU_HE_THONG';

    if (!isOwner && !isPublic && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_001', message: 'Không tìm thấy thực đơn gốc' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Nếu clone thực đơn của người khác (ví dụ mẫu công khai), không kế thừa bệnh nhân riêng tư
    const targetPatientId = isOwner ? original.benh_nhan_id : null;

    const clonedMenu = await this.prisma.$transaction(
      async (tx) => {
        const newMenu = await tx.thuc_don.create({
          data: {
            nguoi_dung_id: currentUser.id,
            ten_thuc_don: `[Bản sao] ${original.ten_thuc_don}`,
            loai_thuc_don: original.loai_thuc_don,
            loai_doi_tuong: original.loai_doi_tuong,
            benh_nhan_id: targetPatientId,
            nhom_benh_id: original.nhom_benh_id,
            gioi_han_dinh_duong_id: original.gioi_han_dinh_duong_id,
            ngay_tao: new Date(),
          },
        });

        // Sao chép đệ quy từng liên kết chi_tiet_thuc_don
        for (const detail of original.chi_tiet_thuc_don) {
          const oldMeal = detail.bua_an;
          let newMealId = detail.bua_an_id;

          // Nếu là bữa ăn riêng tư, tạo bản sao bữa ăn mới cho user
          if (oldMeal) {
            const cloneMeal = await tx.bua_an.create({
              data: {
                nguoi_dung_id: currentUser.id,
                ten_bua_an: oldMeal.ten_bua_an,
                gio_an: oldMeal.gio_an,
                trang_thai: 'RIENG_TU',
                la_cong_khai: false,
              },
            });

            for (const mb of oldMeal.chi_tiet_bua_an) {
              await tx.chi_tiet_bua_an.create({
                data: {
                  bua_an_id: cloneMeal.id,
                  mon_an_id: mb.mon_an_id,
                  he_so_song_chin: mb.he_so_song_chin,
                },
              });
            }

            newMealId = cloneMeal.id;
          }

          await tx.chi_tiet_thuc_don.create({
            data: {
              thuc_don_id: newMenu.id,
              bua_an_id: newMealId,
              so_tuan: detail.so_tuan,
              thu_trong_tuan: detail.thu_trong_tuan,
              thu_tu_trong_tuan: detail.thu_tu_trong_tuan,
            },
          });
        }

        return newMenu;
      },
      { timeout: 15000 },
    );

    const totalEnergy = await this.updateMenuEnergyDisplay({ menuId: clonedMenu.id });
    await this.cacheService.invalidateTag(this.CACHE_TAG);

    return {
      id: clonedMenu.id.toString(),
      menuName: clonedMenu.ten_thuc_don,
      menuType: clonedMenu.loai_thuc_don,
      message: 'Nhân bản thực đơn thành công',
      totalEnergy,
    };
  }

  /**
   * 8. POST /api/menus/:id/resolve-dish & /api/menu/:id/resolve-dish: Giải quyết món ăn nhanh
   */
  async resolveDishForMenu({ dto, currentUser }: ResolveDishForMenuParamsDto): Promise<{
    dishId: string;
    name: string;
    recipeHash?: string | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const dishId = await this.resolveDishInTransaction({ dishDto: dto, currentUser, tx });
      const dish = await tx.mon_an.findUnique({
        where: { id: dishId },
        select: { id: true, ten_mon: true, recipe_hash: true },
      });

      return {
        dishId: dish!.id.toString(),
        name: dish!.ten_mon,
        recipeHash: dish!.recipe_hash,
      };
    });
  }
}
