import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService, MealInput } from '../../../core/nutrition-engine';
import { MenuExcelService } from '../../menus/services/menu-excel.service';
import {
  RejectProposalDto,
  MenuProposalQueryDto,
  MenuProposalListDto,
  MenuProposalDetailDto,
} from '../dto';
import { MenuDetailResponseDto } from '../../menus/dto';
import { UserRole, isAdminRole } from '../../../config/enums/role.enum';
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

  /**
   * 1. POST /api/menu-proposals/:menuId: Nộp đề xuất thực đơn cho Admin duyệt
   * ĐÓNG BĂNG DEEP SELF-CONTAINED SNAPSHOT JSONB chứa đầy đủ tên món, nguyên liệu, 86 vi chất tĩnh
   */
  async proposeMenu(
    menuIdParam: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string; proposalId: string }> {
    const menuId = BigInt(menuIdParam);

    // 1. Kiểm tra tồn tại thực đơn gốc và quyền sở hữu
    const menu = await this.prisma.thuc_don.findFirst({
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
        { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (menu.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Chặn nếu đã có đề xuất đang chờ duyệt (CHO_DUYET)
    const existingPending = await this.prisma.de_xuat_thuc_don.findFirst({
      where: {
        menu_goc_id: menuId,
        trang_thai: MenuProposalStatus.CHO_DUYET,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new HttpException(
        {
          code: 'MENU_PENDING_PROPOSAL',
          message: 'Thực đơn đã có đề xuất đang chờ duyệt, vui lòng chờ quản trị viên phản hồi',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 3. Xây dựng DEEP SELF-CONTAINED SNAPSHOT JSONB
    // Đóng băng toàn bộ cấu trúc tuần -> ngày -> bữa -> món -> nguyên liệu và tính toán sẵn 86 vi chất tĩnh
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
            ingredientId: cd.nguyen_lieu_id.toString(),
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
        id: meal.id.toString(),
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
    const proposal = await this.prisma.de_xuat_thuc_don.create({
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

    await this.cacheService.invalidateTag(this.CACHE_TAG);

    return {
      success: true,
      message: 'Gửi đề xuất thực đơn thành công',
      proposalId: proposal.id.toString(),
    };
  }

  /**
   * 2. GET /api/menu-proposals: Danh sách đề xuất cho Admin (lọc theo statuses)
   */
  async getAdminProposals(
    query: MenuProposalQueryDto,
  ): Promise<{ items: MenuProposalListDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
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
      createdAt: r.ngay_tao,
      approvedAt: r.ngay_phe_duyet,
    }));

    return { items, total, page, limit };
  }

  /**
   * 3. GET /api/menu-proposals/my: Danh sách đề xuất của tôi
   */
  async getMyProposals(currentUser: { id: string; role?: string }): Promise<MenuProposalListDto[]> {
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
      take: 100,
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
      createdAt: r.ngay_tao,
      approvedAt: r.ngay_phe_duyet,
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
      take: 100,
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
      createdAt: r.ngay_tao,
      approvedAt: r.ngay_phe_duyet,
    }));
  }

  /**
   * 5. GET /api/menu-proposals/:id/full: Xem chi tiết toàn bộ cấu trúc đề xuất (Đọc snapshot)
   */
  async getDetail(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<MenuProposalDetailDto> {
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
      this.logger.error(`Lỗi parse snapshot_json cho proposal ID=${proposalId}: ${e.message}`);
    }

    return {
      proposalId: proposal.id.toString(),
      proposalStatus: proposal.trang_thai,
      rejectReason: proposal.ly_do_tu_choi || null,
      proposalCreatedBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      approvedBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_phe_duyet_idTonguoi_dung?.ten_dang_nhap || null,
      proposalCreatedAt: proposal.ngay_tao,
      approvedAt: proposal.ngay_phe_duyet,
      originalMenuId: proposal.menu_goc_id.toString(),
      menuName: proposal.ten_thuc_don,
      menuType: proposal.loai_thuc_don,
      targetType: proposal.loai_doi_tuong,
      patientId: proposal.benh_nhan_id ? proposal.benh_nhan_id.toString() : null,
      diseaseGroupId: proposal.nhom_benh_id || null,
      nutritionLimitSetId: proposal.gioi_han_dinh_duong_id
        ? proposal.gioi_han_dinh_duong_id.toString()
        : null,
      weeks: snapshotData.weeks || [],
    };
  }

  /**
   * 6. GET /api/menu-proposals/:id: Xem chi tiết ngày của đề xuất (Lazy load từ snapshot)
   */
  async getProposalDayDetail(
    id: string | number | bigint,
    weekNo?: number,
    dayOfWeek?: number,
    currentUser?: { id: string; role?: string },
  ): Promise<MenuDetailResponseDto> {
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

    const weeks = snapshotData.weeks || [];
    const mealResponses: any[] = [];
    const totalDayNutrients: Record<string, number> = {};

    for (const week of weeks) {
      if (weekNo != null && week.weekNo !== Number(weekNo)) continue;

      for (const day of week.days || []) {
        if (dayOfWeek != null && day.dayOfWeek !== Number(dayOfWeek)) continue;

        for (const meal of day.meals || []) {
          mealResponses.push({
            id: meal.id,
            mealName: meal.mealName,
            time: meal.time,
            dishes: meal.dishes || [],
            totalMealNutrients: meal.totalMealNutrients || {},
          });

          for (const [k, v] of Object.entries(meal.totalMealNutrients || {})) {
            totalDayNutrients[k] = Number(((totalDayNutrients[k] || 0) + (v as number)).toFixed(2));
          }
        }
      }
    }

    return {
      id: proposal.id.toString(),
      menuName: proposal.ten_thuc_don,
      menuType: proposal.loai_thuc_don,
      targetType: proposal.loai_doi_tuong,
      createdDate: proposal.ngay_tao,
      createdBy:
        proposal.nguoi_dung_de_xuat_thuc_don_nguoi_de_xuat_idTonguoi_dung?.ten_dang_nhap || null,
      patientId: proposal.benh_nhan_id ? proposal.benh_nhan_id.toString() : null,
      diseaseGroupId: proposal.nhom_benh_id || null,
      nutritionLimitSetId: proposal.gioi_han_dinh_duong_id
        ? proposal.gioi_han_dinh_duong_id.toString()
        : null,
      weekNo: weekNo || null,
      dayOfWeek: dayOfWeek || null,
      meals: mealResponses,
      totalDayNutrients,
    };
  }

  /**
   * 7. PUT /api/menu-proposals/:id/approve: Admin duyệt đề xuất thực đơn
   */
  async approve(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
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
      // 1. Cập nhật trạng thái đề xuất
      await tx.de_xuat_thuc_don.update({
        where: { id: proposalId },
        data: {
          trang_thai: MenuProposalStatus.DA_DUYET,
          ngay_phe_duyet: new Date(),
          nguoi_phe_duyet_id: currentUser.id,
        },
      });

      // 2. Chuyển thực đơn gốc thành mẫu công khai (CONG_KHAI)
      await tx.thuc_don.update({
        where: { id: proposal.menu_goc_id },
        data: {
          loai_thuc_don: MenuType.CONG_KHAI,
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
  async reject(
    id: string | number | bigint,
    dto: RejectProposalDto,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
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
   * 9. Xuất file Excel đề xuất thực đơn từ Snapshot
   */
  async exportProposalExcel(
    id: string | number | bigint,
    columns?: string[],
    currentUser?: { id: string; role?: string },
  ): Promise<Buffer> {
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

    // Đọc trực tiếp từ snapshot_json đóng băng (TC-S4-04), chống lỗi 404 khi menu gốc bị xóa/sửa
    let snapshotData: any = null;
    if (proposal.snapshot_json) {
      try {
        snapshotData = JSON.parse(proposal.snapshot_json);
      } catch (err: any) {
        this.logger.error(`Lỗi parse snapshot_json cho proposal ID=${proposalId}: ${err.message}`);
      }
    }

    const exportTarget = snapshotData || proposal.menu_goc_id;

    return this.menuExcelService.exportMenuExcel(exportTarget, {
      exportType: MenuExportType.FULL,
      columns,
      servings: 1,
      userId: currentUser?.id,
    });
  }

  /**
   * 10. DELETE /api/menu-proposals/:id: Xóa mềm đề xuất thực đơn (Soft-delete)
   */
  async deleteProposal(
    idParam: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
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
