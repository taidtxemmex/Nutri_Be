import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService, MealInput } from '../../../core/nutrition-engine';
import { MenuExcelService } from '../../menus/services/menu-excel.service';
import {
  MenuProposalListDto,
  MenuProposalDetailDto,
  ProposeMenuParamsDto,
  GetAdminProposalsParamsDto,
  GetMyProposalsParamsDto,
  GetProposalDetailParamsDto,
  GetProposalDayDetailParamsDto,
  ApproveProposalParamsDto,
  RejectProposalParamsDto,
  ExportProposalExcelParamsDto,
  DeleteProposalParamsDto,
} from '../dto';
import { MenuDetailResponseDto } from '../../menus/dto';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { isAdminRole } from '../../../config/enums/role.enum';
import { MenuExportType, MenuType, MenuProposalStatus } from '../../../config/enums/domain.enum';

@Injectable()
export class MenuProposalsService {
  private readonly logger = new Logger(MenuProposalsService.name);
  private readonly CACHE_TAG = 'menu-proposals';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly nutritionCalculator: NutritionCalculatorService,
    private readonly menuExcelService: MenuExcelService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  /**
   * Chuẩn hóa danh sách trạng thái lọc (hỗ trợ cả tiếng Anh lẫn tiếng Việt)
   */
  private normalizeStatuses(statuses?: string): string[] {
    if (!statuses) return [];
    const list = statuses.split(',').map((s) => s.trim().toUpperCase());
    const result: string[] = [];

    for (const s of list) {
      if (s === 'PENDING' || s === 'CHO_DUYET') {
        result.push(MenuProposalStatus.CHO_DUYET);
      } else if (s === 'APPROVED' || s === 'DA_DUYET') {
        result.push(MenuProposalStatus.DA_DUYET);
      } else if (s === 'REJECTED' || s === 'TU_CHOI') {
        result.push(MenuProposalStatus.TU_CHOI);
      } else {
        result.push(s);
      }
    }

    return Array.from(new Set(result));
  }

  private formatDateDdMmYyyy(date?: Date | string | null): any {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date.trim())) {
      return date.trim();
    }
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  private toIsoStringOrNull(date?: Date | string | null): string | null {
    if (!date) return null;
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    const trimmed = String(date).trim();
    const ddMmYyyyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
    if (ddMmYyyyMatch) {
      const [, dd, mm, yyyy] = ddMmYyyyMatch;
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }

  /**
   * 1. POST /api/menu-proposals/:menuId: Nộp đề xuất thực đơn cho Admin duyệt
   * ĐÓNG BĂNG DEEP SELF-CONTAINED SNAPSHOT JSONB chứa đầy đủ tên món, nguyên liệu, 86 vi chất tĩnh
   */
  async proposeMenu({ menuIdParam, currentUser }: ProposeMenuParamsDto): Promise<{
    id?: string;
    success: boolean;
    message: string;
    proposalId: string;
  }> {
    const menuId = BigInt(menuIdParam);

    // 1. Kiểm tra tồn tại thực đơn gốc và quyền sở hữu (Lean Projection trước)
    const menuMeta = await this.prisma.thuc_don.findFirst({
      where: { id: menuId, deleted_at: null },
      select: { id: true, nguoi_dung_id: true },
    });

    if (!menuMeta) {
      throw new HttpException(
        { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (menuMeta.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Chặn nếu đã có đề xuất đang chờ duyệt (CHO_DUYET) hoặc đã duyệt (DA_DUYET) - tương thích logic Java backend
    const existingProposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: {
        menu_goc_id: menuId,
        trang_thai: { in: [MenuProposalStatus.CHO_DUYET, MenuProposalStatus.DA_DUYET] },
        deleted_at: null,
      },
      select: { id: true, trang_thai: true },
    });

    if (existingProposal) {
      throw new HttpException(
        {
          code: 'MENU_PENDING_PROPOSAL',
          message: 'error.proposal.menu_pending_proposal',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 3. Thực hiện tạo đề xuất trong Transaction có kiểm tra chống race condition
    const result = await this.prisma.$transaction(async (tx) => {
      const existingInTx = await tx.de_xuat_thuc_don.findFirst({
        where: {
          menu_goc_id: menuId,
          trang_thai: { in: [MenuProposalStatus.CHO_DUYET, MenuProposalStatus.DA_DUYET] },
          deleted_at: null,
        },
        select: { id: true },
      });

      if (existingInTx) {
        throw new HttpException(
          {
            code: 'MENU_PENDING_PROPOSAL',
            message: 'error.proposal.menu_pending_proposal',
          },
          HttpStatus.CONFLICT,
        );
      }

      // Nạp cấu trúc đầy đủ của thực đơn để đóng băng Snapshot
      const menu = await tx.thuc_don.findFirst({
        where: { id: menuId, deleted_at: null },
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
                            include: { nguyen_lieu: { include: { he_so_song_chin: true } } },
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
          { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn' },
          HttpStatus.NOT_FOUND,
        );
      }

      // Xây dựng DEEP SELF-CONTAINED SNAPSHOT JSONB
      // Đóng băng toàn bộ cấu trúc tuần -> ngày -> bữa -> món -> nguyên liệu và tính toán sẵn 86 vi chất tĩnh
      const weekMap = new Map<number, Map<number, any>>();

      for (const md of menu.chi_tiet_thuc_don || []) {
        const weekNo = md.so_tuan ?? 1;
        const dayOfWeek = md.thu_trong_tuan ?? 1;

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

        const mealDishes: any[] = [];
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

        for (let idx = 0; idx < (meal.chi_tiet_bua_an || []).length; idx++) {
          const mb = meal.chi_tiet_bua_an[idx];
          const dish = mb.mon_an;
          const dishCalc = mealCalc.dishes[idx];
          const coef = mb.he_so_song_chin != null ? Number(mb.he_so_song_chin) : 1.0;

          const ingredientDetails = (dish?.chi_tiet_mon_an || []).map((cd: any, cidx: number) => {
            const breakdown = dishCalc?.ingredientBreakdown[cidx];
            return {
              ingredientId: Number(cd.nguyen_lieu_id),
              ingredientName: cd.nguyen_lieu?.ten_nguyen_lieu || '',
              netWeight: cd.khoi_luong_song_sach != null ? Number(cd.khoi_luong_song_sach) : 0,
              edible: cd.nguyen_lieu?.edible != null ? Number(cd.nguyen_lieu.edible) : null,
              nutrients: breakdown ? breakdown.nutrients : {},
            };
          });

          mealDishes.push({
            id: dish ? dish.id.toString() : mb.mon_an_id.toString(),
            name: dish?.ten_mon || '',
            dishWeight: dishCalc ? dishCalc.cookedWeightGrams : 0,
            coefficient: coef,
            nutrients: dishCalc ? dishCalc.nutrients : {},
            details: ingredientDetails,
          });
        }

        dayObj.meals.push({
          id: Number(meal.id),
          mealName: meal.ten_bua_an || null,
          time: meal.gio_an,
          status: meal.trang_thai || 'RIENG_TU',
          isPublic: Boolean(meal.la_cong_khai),
          dishes: mealDishes,
          totalMealNutrients: mealCalc.nutrients,
        });
      }

      const weeks = Array.from(weekMap.entries()).map(([weekNo, dayMap]) => ({
        weekNo,
        days: Array.from(dayMap.values()),
      }));

      const snapshotData = {
        id: menu.id.toString(),
        menuName: menu.ten_thuc_don,
        menuType: menu.loai_thuc_don,
        targetType: menu.loai_doi_tuong,
        totalEnergy: menu.tong_nang_luong || null,
        patientId: menu.benh_nhan_id ? menu.benh_nhan_id.toString() : null,
        diseaseGroupId: menu.nhom_benh_id || null,
        nutritionLimitSetId: menu.gioi_han_dinh_duong_id
          ? menu.gioi_han_dinh_duong_id.toString()
          : null,
        createdAt: new Date().toISOString(),
        weeks,
      };

      const snapshotJson = JSON.stringify(snapshotData);

      // 4. Lưu bản ghi đề xuất
      const proposal = await tx.de_xuat_thuc_don.create({
        data: {
          menu_goc_id: menuId,
          ten_thuc_don: menu.ten_thuc_don,
          loai_thuc_don: menu.loai_thuc_don,
          loai_doi_tuong: menu.loai_doi_tuong,
          tong_nang_luong: menu.tong_nang_luong || null,
          snapshot_json: snapshotJson,
          trang_thai: MenuProposalStatus.CHO_DUYET,
          nguoi_de_xuat_id: currentUser.id,
          benh_nhan_id: menu.benh_nhan_id,
          nhom_benh_id: menu.nhom_benh_id,
          gioi_han_dinh_duong_id: menu.gioi_han_dinh_duong_id,
          ngay_tao: new Date(),
        },
      });

      return {
        id: proposal.id.toString(),
        success: true,
        message: 'Gửi đề xuất thực đơn thành công',
        proposalId: proposal.id.toString(),
      };
    });

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return result;
  }

  /**
   * 2. GET /api/menu-proposals: Danh sách đề xuất cho Admin (lọc theo statuses)
   */
  async getAdminProposals({ query = {} }: GetAdminProposalsParamsDto = {}): Promise<
    PaginatedResult<MenuProposalListDto>
  > {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(5000, Math.max(1, Number(query.limit) || 1000));
    const skip = (page - 1) * limit;

    const normalizedStatuses = this.normalizeStatuses(query.statuses);
    const where: any = {
      deleted_at: null,
    };

    if (normalizedStatuses.length > 0) {
      where.trang_thai = { in: normalizedStatuses };
    }

    const [total, rows] = await Promise.all([
      this.prisma.de_xuat_thuc_don.count({ where }),
      this.prisma.de_xuat_thuc_don.findMany({
        where,
        select: {
          id: true,
          menu_goc_id: true,
          ten_thuc_don: true,
          loai_thuc_don: true,
          loai_doi_tuong: true,
          tong_nang_luong: true,
          trang_thai: true,
          ly_do_tu_choi: true,
          ngay_tao: true,
          ngay_phe_duyet: true,
          nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung: {
            select: { ten_dang_nhap: true },
          },
          nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung: {
            select: { ten_dang_nhap: true },
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: MenuProposalListDto[] = rows.map((r) => ({
      id: r.id.toString(),
      originalMenuId: r.menu_goc_id.toString(),
      menuName: r.ten_thuc_don,
      menuType: r.loai_thuc_don,
      targetType: r.loai_doi_tuong,
      totalEnergy: r.tong_nang_luong || null,
      status: r.trang_thai,
      rejectReason: r.ly_do_tu_choi || null,
      createdBy: r.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      approvedBy:
        r.nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung?.ten_dang_nhap || null,
      createdAt: this.toIsoStringOrNull(r.ngay_tao),
      approvedAt: this.toIsoStringOrNull(r.ngay_phe_duyet),
    }));

    return { items, total, page, limit };
  }

  /**
   * 3. GET /api/menu-proposals/my: Danh sách đề xuất của tôi
   */
  async getMyProposals({ currentUser }: GetMyProposalsParamsDto): Promise<MenuProposalListDto[]> {
    const rows = await this.prisma.de_xuat_thuc_don.findMany({
      where: {
        nguoi_de_xuat_id: currentUser.id,
        deleted_at: null,
      },
      select: {
        id: true,
        menu_goc_id: true,
        ten_thuc_don: true,
        loai_thuc_don: true,
        loai_doi_tuong: true,
        tong_nang_luong: true,
        trang_thai: true,
        ly_do_tu_choi: true,
        ngay_tao: true,
        ngay_phe_duyet: true,
        nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
        nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 1000,
    });

    return rows.map((r) => ({
      id: r.id.toString(),
      originalMenuId: r.menu_goc_id.toString(),
      menuName: r.ten_thuc_don,
      menuType: r.loai_thuc_don,
      targetType: r.loai_doi_tuong,
      totalEnergy: r.tong_nang_luong || null,
      status: r.trang_thai,
      rejectReason: r.ly_do_tu_choi || null,
      createdBy: r.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      approvedBy:
        r.nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung?.ten_dang_nhap || null,
      createdAt: this.toIsoStringOrNull(r.ngay_tao),
      approvedAt: this.toIsoStringOrNull(r.ngay_phe_duyet),
    }));
  }

  /**
   * 4. GET /api/menu-proposals/public: Danh sách đề xuất công khai đã được duyệt
   */
  async getPublicProposals(): Promise<MenuProposalListDto[]> {
    const rows = await this.prisma.de_xuat_thuc_don.findMany({
      where: {
        trang_thai: 'DA_DUYET',
        deleted_at: null,
      },
      select: {
        id: true,
        menu_goc_id: true,
        ten_thuc_don: true,
        loai_thuc_don: true,
        loai_doi_tuong: true,
        tong_nang_luong: true,
        trang_thai: true,
        ly_do_tu_choi: true,
        ngay_tao: true,
        ngay_phe_duyet: true,
        nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
        nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
      },
      orderBy: { ten_thuc_don: 'asc' },
      take: 1000,
    });

    return rows.map((r) => ({
      id: r.id.toString(),
      originalMenuId: r.menu_goc_id.toString(),
      menuName: r.ten_thuc_don,
      menuType: r.loai_thuc_don,
      targetType: r.loai_doi_tuong,
      totalEnergy: r.tong_nang_luong || null,
      status: r.trang_thai,
      rejectReason: r.ly_do_tu_choi || null,
      createdBy: r.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      approvedBy:
        r.nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung?.ten_dang_nhap || null,
      createdAt: this.toIsoStringOrNull(r.ngay_tao),
      approvedAt: this.toIsoStringOrNull(r.ngay_phe_duyet),
    }));
  }

  /**
   * 5. GET /api/menu-proposals/:id/full: Xem chi tiết toàn bộ cấu trúc đề xuất (Đọc snapshot)
   */
  async getDetail({ id, currentUser }: GetProposalDetailParamsDto): Promise<MenuProposalDetailDto> {
    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id: proposalId, deleted_at: null },
      include: {
        nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
        nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
      },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isOwner = proposal.nguoi_de_xuat_id === currentUser.id;
    const isPublic = proposal.trang_thai === 'DA_DUYET';

    if (!isOwner && !isPublic && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'Bạn không có quyền truy cập đề xuất này' },
        HttpStatus.FORBIDDEN,
      );
    }

    let snapshotData: any = {};
    try {
      snapshotData = JSON.parse(proposal.snapshot_json);
    } catch (e) {
      this.logger.error(
        `Failed to parse snapshot_json for proposal ID=${proposalId}: ${e.message}`,
      );
    }

    const normalizedWeeks = Array.isArray(snapshotData.weeks)
      ? snapshotData.weeks.map((w: any) => ({
          ...w,
          days: Array.isArray(w.days)
            ? w.days.map((day: any) => ({
                ...day,
                meals: Array.isArray(day.meals)
                  ? day.meals.map((meal: any) => ({
                      ...meal,
                      id:
                        meal.id !== undefined && meal.id !== null && !Number.isNaN(Number(meal.id))
                          ? Number(meal.id)
                          : meal.id,
                      dishes: Array.isArray(meal.dishes)
                        ? meal.dishes.map((d: any) => ({
                            ...d,
                            details: Array.isArray(d.details)
                              ? d.details.map((det: any) => ({
                                  ...det,
                                  ingredientId:
                                    det.ingredientId !== undefined &&
                                    det.ingredientId !== null &&
                                    !Number.isNaN(Number(det.ingredientId))
                                      ? Number(det.ingredientId)
                                      : det.ingredientId,
                                }))
                              : d.details,
                          }))
                        : meal.dishes,
                    }))
                  : day.meals,
              }))
            : w.days,
        }))
      : [];

    return {
      id: Number((proposal as any).thuc_don_id || proposal.menu_goc_id || proposal.id),
      proposalId: proposal.id.toString(),
      proposalStatus: proposal.trang_thai,
      rejectReason: proposal.ly_do_tu_choi || null,
      proposalCreatedBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      approvedBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung?.ten_dang_nhap || null,
      proposalCreatedAt: this.toIsoStringOrNull(proposal.ngay_tao),
      approvedAt: this.toIsoStringOrNull(proposal.ngay_phe_duyet),
      originalMenuId: proposal.menu_goc_id.toString(),
      menuName: proposal.ten_thuc_don,
      menuType: proposal.loai_thuc_don,
      targetType: proposal.loai_doi_tuong,
      patientId: proposal.benh_nhan_id ? proposal.benh_nhan_id.toString() : null,
      diseaseGroupId: proposal.nhom_benh_id || null,
      nutritionLimitSetId: proposal.gioi_han_dinh_duong_id
        ? proposal.gioi_han_dinh_duong_id.toString()
        : null,
      weeks: normalizedWeeks,
    } as any;
  }

  private recalculateNutrientRatios(nutrients: Record<string, number>): void {
    if (!nutrients || Object.keys(nutrients).length === 0) return;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const energy = Number(nutrients.energy || 0);
    const protein = Number(nutrients.protein || 0);
    const fat = Number(nutrients.fat || 0);
    const carbohydrate = Number(nutrients.carbohydrate || 0);
    const proteinAnimal = Number(nutrients.proteinAnimal || 0);
    const fatAnimal = Number(nutrients.fatAnimal || 0);

    nutrients.proteinRatio = energy > 0 ? round2(((protein * 4) / energy) * 100) : 0;
    nutrients.lipidRatio = energy > 0 ? round2(((fat * 9) / energy) * 100) : 0;
    nutrients.carbohydrateRatio = energy > 0 ? round2(((carbohydrate * 4) / energy) * 100) : 0;
    nutrients.animalProteinRatio = protein > 0 ? round2((proteinAnimal / protein) * 100) : 0;
    nutrients.animalFatRatio = fat > 0 ? round2((fatAnimal / fat) * 100) : 0;
  }

  /**
   * 6. GET /api/menu-proposals/:id: Xem chi tiết ngày của đề xuất (Lazy load từ snapshot)
   */
  async getProposalDayDetail({
    id,
    weekNo,
    dayOfWeek,
    currentUser: _currentUser,
  }: GetProposalDayDetailParamsDto): Promise<MenuDetailResponseDto> {
    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id: proposalId, deleted_at: null },
      include: {
        nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung: {
          select: { ten_dang_nhap: true },
        },
      },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    let snapshotData: any = {};
    try {
      snapshotData = JSON.parse(proposal.snapshot_json);
    } catch (e) {
      throw new HttpException(
        { code: 'INTERNAL_ERROR', message: 'Không thể đọc snapshot thực đơn' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const menuType = proposal.loai_thuc_don || snapshotData.menuType;
    let resolvedWeek: number | null = null;
    let resolvedDay: number | null = null;

    if (menuType === MenuType.NGAY) {
      resolvedWeek = null;
      resolvedDay = null;
    } else if (menuType === MenuType.TUAN) {
      resolvedWeek = 1;
      resolvedDay = dayOfWeek != null ? Number(dayOfWeek) : 2;
    } else if (menuType === MenuType.THANG) {
      resolvedWeek = weekNo != null ? Number(weekNo) : 1;
      resolvedDay = dayOfWeek != null ? Number(dayOfWeek) : 2;
    }

    const weeks = snapshotData.weeks || [];

    // Kiểm tra xem trong snapshot có món nào thiếu nutrients không (snapshot cũ từ Java)
    const missingDishIdsSet = new Set<string>();
    for (const week of weeks) {
      if (resolvedWeek != null && Number(week.weekNo) !== resolvedWeek) continue;
      for (const day of week.days || []) {
        if (resolvedDay != null && Number(day.dayOfWeek) !== resolvedDay) continue;
        for (const meal of day.meals || []) {
          for (const d of meal.dishes || []) {
            if (
              (!d.nutrients || Object.keys(d.nutrients).length === 0 || d.dishWeight == null) &&
              d.id != null
            ) {
              missingDishIdsSet.add(String(d.id));
            }
          }
        }
      }
    }

    const dbDishMap = new Map<string, any>();
    if (missingDishIdsSet.size > 0) {
      const validBigInts: bigint[] = [];
      for (const dId of missingDishIdsSet) {
        if (/^\d+$/.test(String(dId))) {
          validBigInts.push(BigInt(dId));
        }
      }
      if (
        validBigInts.length > 0 &&
        this.prisma.mon_an &&
        typeof this.prisma.mon_an.findMany === 'function'
      ) {
        const dbDishes = await this.prisma.mon_an.findMany({
          where: { id: { in: validBigInts } },
          include: {
            chi_tiet_mon_an: {
              include: { nguyen_lieu: { include: { he_so_song_chin: true } } },
            },
          },
        });
        for (const d of dbDishes) {
          dbDishMap.set(String(d.id), d);
        }
      }
    }

    const mealResponses: any[] = [];
    const totalDayNutrients: Record<string, number> = {};
    const ratioKeys = new Set([
      'proteinRatio',
      'lipidRatio',
      'carbohydrateRatio',
      'animalProteinRatio',
      'animalFatRatio',
      'energyRatio',
    ]);

    for (const week of weeks) {
      if (resolvedWeek != null && Number(week.weekNo) !== resolvedWeek) continue;

      for (const day of week.days || []) {
        if (resolvedDay != null && Number(day.dayOfWeek) !== resolvedDay) continue;

        for (const meal of day.meals || []) {
          const rawDishes = meal.dishes || [];
          const processedDishes: any[] = [];
          const mealNutrients: Record<string, number> = {};

          for (const d of rawDishes) {
            const coef = d.coefficient != null ? Number(d.coefficient) : 1.0;
            const normalizedDetails = Array.isArray(d.details)
              ? d.details.map((det: any) => ({
                  ...det,
                  ingredientId:
                    det.ingredientId !== undefined &&
                    det.ingredientId !== null &&
                    !Number.isNaN(Number(det.ingredientId))
                      ? Number(det.ingredientId)
                      : det.ingredientId,
                }))
              : undefined;

            if (d.nutrients && Object.keys(d.nutrients).length > 0 && d.dishWeight != null) {
              processedDishes.push({
                id: d.id,
                name: d.name || '',
                dishWeight: d.dishWeight,
                coefficient: coef,
                nutrients: d.nutrients,
                ...(normalizedDetails ? { details: normalizedDetails } : {}),
              });
              for (const [k, v] of Object.entries(d.nutrients)) {
                if (ratioKeys.has(k)) continue;
                mealNutrients[k] = Number(((mealNutrients[k] || 0) + Number(v || 0)).toFixed(2));
              }
            } else {
              const dbDish = dbDishMap.get(String(d.id));
              if (dbDish) {
                const mealInput: MealInput = {
                  id: meal.id || 0,
                  mealName: meal.mealName,
                  gio_an: meal.time,
                  chi_tiet_bua_an: [
                    {
                      dishId: dbDish.id,
                      he_so_song_chin: coef,
                      mon_an: {
                        id: dbDish.id,
                        ten_mon: dbDish.ten_mon,
                        he_so_song_chin: coef,
                        chi_tiet_mon_an: (dbDish.chi_tiet_mon_an || []).map((cd: any) => ({
                          ingredientId: cd.nguyen_lieu_id,
                          khoi_luong_song_sach: cd.khoi_luong_song_sach,
                          ingredient: cd.nguyen_lieu,
                        })),
                      },
                    },
                  ],
                };
                const mealCalc = this.nutritionCalculator.calculateMealNutrition(mealInput);
                const dishCalc = mealCalc.dishes[0];
                const dNutrients = dishCalc ? dishCalc.nutrients : {};
                const dbDetails = (dbDish.chi_tiet_mon_an || []).map((cd: any, cidx: number) => {
                  const breakdown = dishCalc?.ingredientBreakdown?.[cidx];
                  return {
                    ingredientId: Number(cd.nguyen_lieu?.id ?? cd.nguyen_lieu_id),
                    ingredientName: cd.nguyen_lieu?.ten_nguyen_lieu || '',
                    netWeight:
                      cd.khoi_luong_song_sach != null ? Number(cd.khoi_luong_song_sach) : 0,
                    edible: cd.nguyen_lieu?.edible != null ? Number(cd.nguyen_lieu.edible) : null,
                    nutrients: breakdown ? breakdown.nutrients : {},
                  };
                });

                processedDishes.push({
                  id: d.id,
                  name: dbDish.ten_mon || d.name || '',
                  dishWeight: dishCalc ? dishCalc.cookedWeightGrams : 0,
                  coefficient: coef,
                  nutrients: dNutrients,
                  details: normalizedDetails || dbDetails,
                });
                for (const [k, v] of Object.entries(dNutrients)) {
                  if (ratioKeys.has(k)) continue;
                  mealNutrients[k] = Number(((mealNutrients[k] || 0) + Number(v || 0)).toFixed(2));
                }
              } else {
                processedDishes.push({
                  id: d.id,
                  name: d.name || '',
                  dishWeight: d.dishWeight ?? 0,
                  coefficient: coef,
                  nutrients: d.nutrients || {},
                  ...(normalizedDetails ? { details: normalizedDetails } : {}),
                });
              }
            }
          }

          this.recalculateNutrientRatios(mealNutrients);

          const finalMealNutrients =
            meal.totalMealNutrients && Object.keys(meal.totalMealNutrients).length > 0
              ? { ...meal.totalMealNutrients }
              : mealNutrients;
          this.recalculateNutrientRatios(finalMealNutrients);

          const resolvedMealId =
            meal.id !== undefined && meal.id !== null && !Number.isNaN(Number(meal.id))
              ? Number(meal.id)
              : meal.id;

          mealResponses.push({
            id: resolvedMealId,
            mealName: meal.mealName,
            time: meal.time,
            dishes: processedDishes,
            totalMealNutrients: finalMealNutrients,
          });

          for (const [k, v] of Object.entries(finalMealNutrients)) {
            if (ratioKeys.has(k)) continue;
            totalDayNutrients[k] = Number(
              ((totalDayNutrients[k] || 0) + Number(v || 0)).toFixed(2),
            );
          }
        }
      }
    }

    this.recalculateNutrientRatios(totalDayNutrients);

    return {
      id: proposal.id.toString(),
      menuName: proposal.ten_thuc_don,
      menuType: proposal.loai_thuc_don,
      targetType: proposal.loai_doi_tuong,
      createdDate: this.formatDateDdMmYyyy(proposal.ngay_tao),
      createdBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      patientId: proposal.benh_nhan_id ? proposal.benh_nhan_id.toString() : null,
      diseaseGroupId: proposal.nhom_benh_id || null,
      nutritionLimitSetId: proposal.gioi_han_dinh_duong_id
        ? proposal.gioi_han_dinh_duong_id.toString()
        : null,
      weekNo: resolvedWeek,
      dayOfWeek: resolvedDay,
      meals: mealResponses,
      totalDayNutrients,
    };
  }

  /**
   * 7. PUT /api/menu-proposals/:id/approve: Admin duyệt đề xuất thực đơn
   */
  async approve({
    id,
    currentUser,
  }: ApproveProposalParamsDto): Promise<{ success: boolean; message: string }> {
    const proposalId = BigInt(id);

    const proposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id: proposalId, deleted_at: null },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (proposal.trang_thai !== MenuProposalStatus.CHO_DUYET) {
      throw new HttpException(
        { code: 'PROPOSAL_INVALID_STATUS', message: 'Đề xuất không ở trạng thái chờ duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.de_xuat_thuc_don.update({
        where: { id: proposalId },
        data: {
          trang_thai: MenuProposalStatus.DA_DUYET,
          ngay_phe_duyet: new Date(),
          nguoi_phe_duyet_id: currentUser.id,
        },
      });
    });

    await Promise.all([
      this.cacheService.invalidateTag(this.CACHE_TAG),
      this.cacheService.invalidateTag('menus'),
    ]);

    return { success: true, message: 'Phê duyệt đề xuất thực đơn thành công' };
  }

  /**
   * 8. PUT /api/menu-proposals/:id/reject: Admin từ chối đề xuất thực đơn
   */
  async reject({
    id,
    dto,
    currentUser,
  }: RejectProposalParamsDto): Promise<{ success: boolean; message: string }> {
    const proposalId = BigInt(id);

    const proposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id: proposalId, deleted_at: null },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (proposal.trang_thai !== MenuProposalStatus.CHO_DUYET) {
      throw new HttpException(
        { code: 'PROPOSAL_INVALID_STATUS', message: 'Đề xuất không ở trạng thái chờ duyệt' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const reason = dto.reason?.trim() || dto.rejectReason?.trim() || 'Không đạt tiêu chí lâm sàng';

    await this.prisma.de_xuat_thuc_don.update({
      where: { id: proposalId },
      data: {
        trang_thai: MenuProposalStatus.TU_CHOI,
        ly_do_tu_choi: reason,
        ngay_phe_duyet: new Date(),
        nguoi_phe_duyet_id: currentUser.id,
      },
    });

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return { success: true, message: 'Từ chối đề xuất thực đơn thành công' };
  }

  /**
   * 9. Xuất file Excel đề xuất thực đơn từ Snapshot (Khớp MenuSnapshotMapper.java)
   */
  async exportProposalExcel({
    id,
    columns,
    currentUser,
  }: ExportProposalExcelParamsDto): Promise<Buffer> {
    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id: proposalId, deleted_at: null },
      include: {
        benh_nhan: true,
        nhom_benh_mo_rong: {
          include: { nhom_benh: true },
        },
        gioi_han_dinh_duong: true,
      },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    let snapshotData: any = null;
    if (proposal.snapshot_json) {
      try {
        snapshotData = JSON.parse(proposal.snapshot_json);
      } catch (err: any) {
        this.logger.error(
          `Failed to parse snapshot_json for proposal ID=${proposalId}: ${err.message}`,
        );
      }
    }

    if (snapshotData && Array.isArray(snapshotData.weeks)) {
      const dishIdSet = new Set<string>();
      for (const week of snapshotData.weeks) {
        for (const day of week.days || []) {
          for (const meal of day.meals || []) {
            for (const d of meal.dishes || []) {
              if (d.id != null) {
                dishIdSet.add(String(d.id));
              }
            }
          }
        }
      }

      const dishMap = new Map<string, any>();
      if (
        dishIdSet.size > 0 &&
        this.prisma.mon_an &&
        typeof this.prisma.mon_an.findMany === 'function'
      ) {
        const validIds: bigint[] = [];
        for (const dId of dishIdSet) {
          if (/^\d+$/.test(String(dId))) {
            validIds.push(BigInt(dId));
          }
        }
        if (validIds.length > 0) {
          const dishes = await this.prisma.mon_an.findMany({
            where: { id: { in: validIds } },
            include: {
              chi_tiet_mon_an: {
                include: { nguyen_lieu: { include: { he_so_song_chin: true } } },
              },
            },
          });
          for (const dish of dishes) {
            dishMap.set(String(dish.id), dish);
          }
        }
      }

      const chi_tiet_thuc_don: any[] = [];
      for (const week of snapshotData.weeks) {
        for (const day of week.days || []) {
          for (const meal of day.meals || []) {
            chi_tiet_thuc_don.push({
              so_tuan: week.weekNo ?? 1,
              thu_trong_tuan: day.dayOfWeek ?? 1,
              bua_an: {
                id: meal.id,
                ten_bua_an: meal.mealName || null,
                gio_an: meal.time || null,
                chi_tiet_bua_an: (meal.dishes || []).map((d: any) => {
                  const dbDish = dishMap.get(String(d.id));
                  return {
                    mon_an_id: d.id,
                    he_so_song_chin: d.coefficient != null ? Number(d.coefficient) : 1.0,
                    mon_an: dbDish || {
                      id: d.id,
                      ten_mon: d.name || '',
                      chi_tiet_mon_an: (d.details || []).map((cd: any) => {
                        const netWeight = Number(cd.netWeight ?? cd.khoi_luong_song_sach ?? 0);
                        const per100gNutrients: Record<string, any> = {};
                        if (cd.nutrients && typeof cd.nutrients === 'object') {
                          for (const [k, v] of Object.entries(cd.nutrients)) {
                            const numVal = Number(v);
                            per100gNutrients[k] = !Number.isNaN(numVal)
                              ? netWeight > 0
                                ? (numVal * 100) / netWeight
                                : 0
                              : v;
                          }
                        }
                        return {
                          nguyen_lieu_id: cd.ingredientId,
                          khoi_luong_song_sach: cd.netWeight,
                          nguyen_lieu: cd.ingredient || {
                            id: cd.ingredientId,
                            ten_nguyen_lieu: cd.ingredientName || '',
                            edible: cd.edible ?? 100,
                            ...per100gNutrients,
                          },
                        };
                      }),
                    },
                  };
                }),
              },
            });
          }
        }
      }

      const transientMenu = {
        ...snapshotData,
        id: proposal.id,
        ten_thuc_don: proposal.ten_thuc_don || snapshotData.menuName,
        loai_thuc_don: proposal.loai_thuc_don || snapshotData.menuType,
        loai_doi_tuong: proposal.loai_doi_tuong || snapshotData.targetType,
        ngay_tao: proposal.ngay_tao,
        benh_nhan: (proposal as any).benh_nhan || null,
        nhom_benh_mo_rong: (proposal as any).nhom_benh_mo_rong || null,
        gioi_han_dinh_duong: (proposal as any).gioi_han_dinh_duong || null,
        chi_tiet_thuc_don,
      };

      return this.menuExcelService.exportMenuExcel({
        menuIdOrData: transientMenu,
        options: {
          exportType: MenuExportType.FULL,
          columns,
          servings: 1,
          userId: currentUser?.id,
        },
      });
    }

    const exportTarget = snapshotData || proposal.menu_goc_id;

    return this.menuExcelService.exportMenuExcel({
      menuIdOrData: exportTarget,
      options: {
        exportType: MenuExportType.FULL,
        columns,
        servings: 1,
        userId: currentUser?.id,
      },
    });
  }

  /**
   * 10. DELETE /api/menu-proposals/:id: Xóa mềm đề xuất thực đơn (Soft-delete)
   */
  async deleteProposal({
    idParam,
    currentUser,
  }: DeleteProposalParamsDto): Promise<{ success: boolean; message: string }> {
    const id = BigInt(idParam);
    const existing = await this.prisma.de_xuat_thuc_don.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!this.isAdmin(currentUser) && existing.nguoi_de_xuat_id !== currentUser.id) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'Không có quyền xóa đề xuất này' },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.de_xuat_thuc_don.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.cacheService.debouncedInvalidateTags([this.CACHE_TAG]);
    return { success: true, message: 'Xóa đề xuất thực đơn thành công' };
  }
}
