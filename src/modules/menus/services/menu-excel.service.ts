import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../core/database/prisma.service';
import { NutritionCalculatorService } from '../../../core/nutrition-engine/nutrition-calculator.service';
import {
  NUTRIENT_CODES,
  NUTRIENT_METADATA_MAP,
} from '../../../core/nutrition-engine/nutrition.constants';
import { CacheService } from '../../../core/cache/cache.service';
import { MenuExportType, MenuType } from '../../../config/enums/domain.enum';
import { EXCEL_FONT_FAMILY, EXCEL_STYLES } from '../../../config/constants/excel.constants';
import { Response } from 'express';
import { setExcelResponseHeaders } from '../../../core/excel-engine';
import {
  MenuMarketPlanStreamer,
  MarketPlanIngredient,
  MarketPlanMenuContext,
  MOH_14_FOOD_GROUPS,
} from './menu-market-plan.streamer';
import {
  ExportMenuExcelParamsDto,
  StreamMenuExcelParamsDto,
  StreamMarketPlanExcelParamsDto,
} from '../dto/menu-params.dto';

export interface MenuExportOptions {
  exportType?: MenuExportType;
  columns?: string[];
  servings?: number;
  userId?: string;
}

export interface ResolvedExportColumn {
  key: string;
  header: string;
  unit: string;
}

@Injectable()
export class MenuExcelService {
  private readonly logger = new Logger(MenuExcelService.name);

  private static readonly MAIN_SHEET = 'THUC_DON';
  private static readonly SHOPPING_SHEET = 'Tong_hop_di_cho';
  private static readonly COOKING_SHEET = 'Dinh_luong_nha_bep';

  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionCalculator: NutritionCalculatorService = new NutritionCalculatorService(),
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Xuất Excel thực đơn đa chế độ (FULL, NET, NET_NUTRITION, RAW, COOKED)
   * Tích hợp bộ đệm CacheService phản hồi tức thì 0ms cho các yêu cầu cùng tham số
   */
  async exportMenuExcel({ menuIdOrData, options = {} }: ExportMenuExcelParamsDto): Promise<Buffer> {
    const exportType = options.exportType || MenuExportType.FULL;
    const servings = options.servings && options.servings > 0 ? options.servings : 1;

    const isIdQuery =
      typeof menuIdOrData === 'string' ||
      typeof menuIdOrData === 'number' ||
      typeof menuIdOrData === 'bigint';

    // 1. Kiểm tra CacheService có gắn userId (cô lập tuyệt đối giữa các tài khoản - 0ms cache hit)
    let cacheKey = '';
    if (isIdQuery && this.cacheService) {
      cacheKey = this.cacheService.generateKey({
        prefix: 'menu:export',
        params: {
          menuId: String(menuIdOrData),
          exportType,
          servings,
          cols: options.columns ? options.columns.sort().join(',') : 'all',
          userId: options.userId || 'anonymous',
        },
      });

      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug(`🚀 [Cache Hit] Trả về Excel thực đơn #${menuIdOrData} tức thì (0ms)`);
        return Buffer.from(cached, 'base64');
      }
    }

    // 2. Nạp dữ liệu thực đơn & phân quyền sở hữu khi cache miss
    const menu = isIdQuery
      ? await this.fetchMenuWithFullRelations(menuIdOrData, options.userId)
      : menuIdOrData;

    if (!menu) {
      throw new HttpException(
        {
          code: 'MENU_NOT_FOUND',
          message: 'Không tìm thấy thực đơn yêu cầu xuất Excel',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 3. Xây dựng Workbook hoàn chỉnh
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nutri Clinical Intelligence';
    workbook.created = new Date();

    const selectedColumns = this.resolveExportColumns(options.columns);

    // Ghi sheet chính THUC_DON
    await this.buildMenuSheet(workbook, menu, exportType, selectedColumns, servings);

    // Nếu là RAW -> Thêm sheet Tổng hợp đi chợ toàn chu kỳ
    if (exportType === MenuExportType.RAW) {
      await this.buildRawShoppingSummarySheet(workbook, menu, servings);
    }

    // Nếu là COOKED -> Thêm sheet Hướng dẫn định lượng nhà bếp
    if (exportType === MenuExportType.COOKED) {
      await this.buildCookedKitchenSummarySheet(workbook, menu, servings);
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // 4. Lưu Cache nếu hợp lệ và dung lượng an toàn (< 2MB chống OOM VPS 2GB)
    if (cacheKey && this.cacheService && buffer.length <= 2 * 1024 * 1024) {
      await this.cacheService.set(
        cacheKey,
        buffer.toString('base64'),
        1800,
        `menu_${menuIdOrData}`,
      );
      this.logger.debug(
        `💾 Đã lưu Excel thực đơn #${menuIdOrData} vào bộ nhớ đệm (tag=menu_${menuIdOrData})`,
      );
    }

    return buffer;
  }

  /**
   * Stream Excel trực tiếp ra HTTP response stream chống tràn RAM (Anti-OOM)
   * Sử dụng exceljs.stream.xlsx.WorkbookWriter với useSharedStrings: false
   * Tuân thủ Task 6.3 [T9.3] & Pillar III Memory Protection
   */
  async streamMenuExcel({
    menuIdOrData,
    outputStream,
    options = {},
  }: StreamMenuExcelParamsDto): Promise<void> {
    const exportType = options.exportType || MenuExportType.FULL;
    const servings = options.servings && options.servings > 0 ? options.servings : 1;

    const isIdQuery =
      typeof menuIdOrData === 'string' ||
      typeof menuIdOrData === 'number' ||
      typeof menuIdOrData === 'bigint';

    // 1. Nạp dữ liệu thực đơn & phân quyền
    const menu = isIdQuery
      ? await this.fetchMenuWithFullRelations(menuIdOrData, options.userId)
      : menuIdOrData;

    if (!menu) {
      throw new HttpException(
        {
          code: 'MENU_NOT_FOUND',
          message: 'Không tìm thấy thực đơn yêu cầu xuất Excel',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Thiết lập HTTP Response Headers nếu outputStream là Express Response
    if (outputStream && typeof (outputStream as any).setHeader === 'function') {
      const res = outputStream as Response;
      setExcelResponseHeaders({
        res,
        filename: `thuc_don_${String(menu.id || menuIdOrData)}_${exportType.toLowerCase()}.xlsx`,
      });
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Accel-Buffering', 'no');
    }

    // 3. Khởi tạo WorkbookWriter O(1) RAM với useSharedStrings = false
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: outputStream,
      useStyles: true,
      useSharedStrings: false,
    });

    const selectedColumns = this.resolveExportColumns(options.columns);

    // Ghi sheet chính THUC_DON
    await this.buildMenuSheet(workbook as any, menu, exportType, selectedColumns, servings);

    // Nếu là RAW -> Thêm sheet Tổng hợp đi chợ toàn chu kỳ
    if (exportType === MenuExportType.RAW) {
      await this.buildRawShoppingSummarySheet(workbook as any, menu, servings);
    }

    // Nếu là COOKED -> Thêm sheet Hướng dẫn định lượng nhà bếp
    if (exportType === MenuExportType.COOKED) {
      await this.buildCookedKitchenSummarySheet(workbook as any, menu, servings);
    }

    // Cam kết toàn bộ workbook ra stream
    await workbook.commit();
  }

  /**
   * Xuất Kế Hoạch Đi Chợ chuẩn 14 nhóm thực phẩm Bộ Y Tế dạng Stream O(1) RAM
   * Quy đổi ngược khối lượng sạch sang sống thô: W_thô = W_sạch / (edible / 100) * servings
   * Tính toán hao hụt sơ chế và nhiệt chế biến (Task 6.3 [T9.3])
   */
  async streamMarketPlanExcel({
    menuIdOrData,
    outputStream,
    options = {},
  }: StreamMarketPlanExcelParamsDto): Promise<void> {
    const isIdQuery =
      typeof menuIdOrData === 'string' ||
      typeof menuIdOrData === 'number' ||
      typeof menuIdOrData === 'bigint';

    const menu = isIdQuery
      ? await this.fetchMenuWithFullRelations(menuIdOrData, options.userId)
      : menuIdOrData;

    if (!menu) {
      throw new HttpException(
        { code: 'MENU_NOT_FOUND', message: 'Không tìm thấy thực đơn yêu cầu xuất kế hoạch đi chợ' },
        HttpStatus.NOT_FOUND,
      );
    }

    const servings = options.servings && options.servings > 0 ? options.servings : 1;
    const allDetails = menu.chi_tiet_thuc_don || menu.menuDetails || [];
    let filteredDetails = allDetails;
    if (options.week) {
      filteredDetails = filteredDetails.filter(
        (d: any) => (d.so_tuan ?? d.weekNo ?? 1) === Number(options.week),
      );
    }
    if (options.day) {
      filteredDetails = filteredDetails.filter(
        (d: any) => (d.thu_trong_tuan ?? d.dayOfWeek ?? 1) === Number(options.day),
      );
    }

    // Gom nguyên liệu toàn chu kỳ/bộ lọc
    const ingMap = new Map<string, MarketPlanIngredient>();
    for (const md of filteredDetails) {
      const meal = md.bua_an || md.meal;
      if (!meal) continue;
      const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];
      for (const mItem of mealDetails) {
        const dish = mItem.mon_an || mItem.dish;
        if (!dish) continue;
        const dishDetails = dish.chi_tiet_mon_an || dish.details || [];
        for (const dd of dishDetails) {
          const ing = dd.nguyen_lieu || dd.ingredient;
          if (!ing) continue;
          const net = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
          const edible = Number(ing.ty_le_an_duoc ?? ing.edible ?? 100);
          const name =
            ing.ten_nguyen_lieu || ing.material || `NL #${dd.nguyen_lieu_id || dd.ingredientId}`;
          const catId = Number(ing.danh_muc || 15);
          const catName = MOH_14_FOOD_GROUPS[catId] || 'Nhóm khác';
          const coef = Number(mItem.he_so_song_chin ?? dish.he_so_song_chin ?? 1.0);
          const key = `${ing.id || name}`.trim().toLowerCase();

          if (!ingMap.has(key)) {
            ingMap.set(key, {
              id: ing.id,
              name,
              categoryId: catId,
              categoryName: catName,
              edible,
              netWeight1: 0,
              rawWeight1: 0,
              lossPercent: 100 - edible,
              lossWeight1: 0,
              cookedWeight1: 0,
              notes: coef !== 1 ? `Hệ số nở/hao: ${coef}` : undefined,
            });
          }
          const item = ingMap.get(key)!;
          item.netWeight1 += net;
          const raw = edible > 0 ? net / (edible / 100) : net;
          item.rawWeight1 += raw;
          item.lossWeight1 += raw - net;
          item.cookedWeight1 = (item.cookedWeight1 || 0) + net * coef;
        }
      }
    }

    // Tính toán năng lượng P:L:G cho menu
    const dayGroups = this.groupMenuDetailsByDay(filteredDetails);
    const dayCount = dayGroups.size > 0 ? dayGroups.size : 1;
    let totalE = 0;
    let totalP = 0;
    let totalF = 0;
    let totalC = 0;
    for (const [, dList] of dayGroups.entries()) {
      const dTotals = this.calculateDayNutrientTotals(dList);
      const p = dTotals['protein'] || 0;
      const f = dTotals['fat'] || 0;
      const c = dTotals['carbohydrate'] || 0;
      totalE += dTotals['energy'] || p * 4 + f * 9 + c * 4;
      totalP += p;
      totalF += f;
      totalC += c;
    }
    const avgE = Math.round(totalE / dayCount);
    const eP = Math.round((totalP / dayCount) * 4);
    const eF = Math.round((totalF / dayCount) * 9);
    const eC = Math.round((totalC / dayCount) * 4);
    const eSum = eP + eF + eC > 0 ? eP + eF + eC : avgE > 0 ? avgE : 1;

    const patient = menu.benh_nhan || menu.patient;
    const diseaseGroup = menu.nhom_benh_mo_rong || menu.diseaseGroup;

    let cycleText = 'Toàn bộ chu kỳ thực đơn';
    if (options.week && options.day) {
      cycleText = `Tuần ${options.week} - Thứ ${options.day}`;
    } else if (options.week) {
      cycleText = `Tuần ${options.week}`;
    } else if (options.day) {
      cycleText = `Thứ ${options.day}`;
    }

    const context: MarketPlanMenuContext = {
      id: menu.id,
      menuName: menu.ten_thuc_don || menu.menuName || 'Thực đơn',
      menuType: menu.loai_thuc_don || menu.menuType,
      servings,
      cycleText,
      createdDate: menu.ngay_tao ? new Date(menu.ngay_tao).toLocaleDateString('vi-VN') : undefined,
      diseaseGroupName:
        diseaseGroup?.ten_hien_thi || diseaseGroup?.displayName || diseaseGroup?.ten_nhom,
      patient: patient
        ? {
            fullName: patient.ho_ten || patient.fullName,
            patientCode: patient.ma_benh_nhan_bv || patient.patientCode,
            gender:
              String(patient.gioi_tinh ?? patient.gender).toUpperCase() === 'NAM' ? 'Nam' : 'Nữ',
            weight: Number(patient.can_nang ?? patient.weight ?? 0),
            height: Number(patient.chieu_cao ?? patient.height ?? 0),
          }
        : undefined,
      energyKcal: avgE,
      proteinGrams: Math.round((totalP / dayCount) * 10) / 10,
      lipidGrams: Math.round((totalF / dayCount) * 10) / 10,
      glucidGrams: Math.round((totalC / dayCount) * 10) / 10,
      pRatio: Math.round((eP / eSum) * 1000) / 10,
      lRatio: Math.round((eF / eSum) * 1000) / 10,
      gRatio: Math.round((eC / eSum) * 1000) / 10,
    };

    const streamer = new MenuMarketPlanStreamer(outputStream);
    await streamer.streamMarketPlan({ context, ingredients: Array.from(ingMap.values()) });
  }

  /**
   * Nạp đầy đủ cây thực đơn 5 cấp từ CSDL:
   * Menu -> Ngày (so_tuan, thu_trong_tuan) -> Bữa ăn -> Món ăn -> Nguyên liệu + Dinh dưỡng
   */
  private async fetchMenuWithFullRelations(
    menuId: bigint | number | string,
    userId?: string,
  ): Promise<any> {
    const where: any = {
      id: BigInt(String(menuId)),
      deleted_at: null,
    };

    if (userId) {
      const user = await this.prisma.nguoi_dung.findUnique({
        where: { id: userId },
        select: { vai_tro: true },
      });
      const isAdmin = user && (user.vai_tro === 'ADMIN' || user.vai_tro === 'SUPERADMIN');
      if (!isAdmin) {
        where.OR = [
          { nguoi_dung_id: userId },
          { loai_thuc_don: { in: ['CONG_KHAI', 'MAU_HE_THONG'] } },
        ];
      }
    }

    return this.prisma.thuc_don.findFirst({
      where,
      include: {
        benh_nhan: true,
        nhom_benh_mo_rong: {
          include: {
            nhom_benh: true,
          },
        },
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
          orderBy: [{ so_tuan: 'asc' }, { thu_trong_tuan: 'asc' }, { bua_an_id: 'asc' }],
        },
      },
    });
  }

  // ==========================================
  // XÂY DỰNG SHEET CHÍNH (THUC_DON)
  // ==========================================

  private async buildMenuSheet(
    workbook: ExcelJS.Workbook,
    menu: any,
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
    servings: number,
  ): Promise<void> {
    const sheet = workbook.addWorksheet(MenuExcelService.MAIN_SHEET, {
      views: [{ showGridLines: true }],
    });

    let rowIdx = 1;

    // 1. Khối thông tin thực đơn & bệnh nhân (Metadata Block)
    rowIdx = this.writeMenuInfoHeader(sheet, menu, rowIdx);
    rowIdx += 2; // Cách 2 dòng trống

    // 2. Nhóm chi tiết theo Ngày (Tuần - Thứ)
    const details = menu.chi_tiet_thuc_don || menu.menuDetails || [];
    const dayGroups = this.groupMenuDetailsByDay(details);

    for (const [, dayDetails] of dayGroups.entries()) {
      const firstDetail = dayDetails[0];

      // 2.1 Tiêu đề Ngày
      rowIdx = this.writeDayTitleRow(
        sheet,
        rowIdx,
        firstDetail,
        menu.loai_thuc_don || menu.menuType,
        exportType,
        columns,
      );

      // 2.2 Bảng đối chiếu Giới hạn / Thực tế ngày / Độ lệch (cho FULL và NET_NUTRITION)
      if (exportType === MenuExportType.FULL || exportType === MenuExportType.NET_NUTRITION) {
        rowIdx = this.writeDayNutritionSummary(sheet, rowIdx, dayDetails, menu, columns);
      }

      // 2.3 Các bữa ăn trong ngày
      for (const md of dayDetails) {
        const meal = md.bua_an || md.meal;
        if (!meal) continue;

        rowIdx = this.writeMealBlock(sheet, rowIdx, meal, exportType, columns, servings);
      }

      // 2.4 Bảng tổng hợp nguyên liệu sống thô trong ngày (cho RAW)
      if (exportType === MenuExportType.RAW) {
        rowIdx = this.writeDailyRawIngredientSummary(sheet, rowIdx, dayDetails, servings);
      }

      // Dòng trống giữa các ngày
      rowIdx += 2;
    }

    // Tự động căn chỉnh độ rộng cột chuẩn mực
    this.autoFitColumnWidths(sheet, exportType, columns);

    if (typeof (sheet as any).commit === 'function') {
      await (sheet as any).commit();
    }
  }

  /**
   * Ghi khối thông tin chung của Thực đơn và Bệnh nhân
   */
  private writeMenuInfoHeader(sheet: ExcelJS.Worksheet, menu: any, startRow: number): number {
    let r = startRow;

    // Tiêu đề lớn
    const titleRow = sheet.getRow(r++);
    titleRow.height = 28;
    titleRow.getCell(1).value = 'BẢNG CHI TIẾT THỰC ĐƠN DINH DƯỠNG LÂM SÀNG';
    titleRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 14,
      bold: true,
      color: { argb: 'FF1F497D' },
    };

    r++; // Dòng trống

    r = this.writeKeyValueRow(
      sheet,
      r,
      'Tên thực đơn:',
      menu.ten_thuc_don || menu.menuName || 'Thực đơn',
    );
    r = this.writeKeyValueRow(
      sheet,
      r,
      'Loại thực đơn:',
      this.formatMenuType(menu.loai_thuc_don || menu.menuType),
    );
    r = this.writeKeyValueRow(
      sheet,
      r,
      'Ngày tạo:',
      menu.ngay_tao
        ? new Date(menu.ngay_tao).toLocaleDateString('vi-VN')
        : new Date().toLocaleDateString('vi-VN'),
    );

    // Nhóm bệnh
    const diseaseGroup = menu.nhom_benh_mo_rong || menu.diseaseGroup;
    if (diseaseGroup) {
      const dgName = diseaseGroup.ten_hien_thi || diseaseGroup.displayName || diseaseGroup.ten_nhom;
      r = this.writeKeyValueRow(sheet, r, 'Nhóm bệnh:', dgName);
    }

    // Bệnh nhân
    const patient = menu.benh_nhan || menu.patient;
    if (patient) {
      r++; // Cách 1 dòng
      const weight = Number(patient.can_nang ?? patient.weight ?? 0);
      const height = Number(patient.chieu_cao ?? patient.height ?? 0);
      const dob = patient.ngay_sinh
        ? new Date(patient.ngay_sinh)
        : patient.dateOfBirth
          ? new Date(patient.dateOfBirth)
          : null;
      const age = dob
        ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
        : patient.age || 0;
      const isMale = String(patient.gioi_tinh ?? patient.gender).toUpperCase() === 'NAM';

      // Tính BMI & TDEE
      const heightM = height > 0 ? height / 100 : 0;
      const bmi =
        heightM > 0 && weight > 0 ? Math.round((weight / (heightM * heightM)) * 10) / 10 : 0;
      const pal = Number(patient.he_so_hoat_dong ?? patient.activityFactor ?? 1.2);
      const bmr = isMale
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
      const tdee = Math.round(bmr * (pal > 0 ? pal : 1.2));

      r = this.writeKeyValueRow(
        sheet,
        r,
        'Họ tên bệnh nhân:',
        patient.ho_ten || patient.fullName || '',
      );
      r = this.writeKeyValueRow(
        sheet,
        r,
        'Mã bệnh nhân:',
        patient.ma_benh_nhan_bv || patient.patientCode || '',
      );
      r = this.writeKeyValueRow(sheet, r, 'Giới tính:', isMale ? 'Nam' : 'Nữ');
      r = this.writeKeyValueRow(sheet, r, 'Tuổi:', age > 0 ? `${age} tuổi` : 'Không xác định');
      r = this.writeKeyValueRow(sheet, r, 'Cân nặng (kg):', weight > 0 ? weight : '');
      r = this.writeKeyValueRow(sheet, r, 'Chiều cao (cm):', height > 0 ? height : '');
      r = this.writeKeyValueRow(
        sheet,
        r,
        'Chỉ số BMI:',
        bmi > 0 ? `${bmi} (${this.classifyBmi(bmi)})` : '',
      );
      r = this.writeKeyValueRow(sheet, r, 'Hệ số hoạt động (PAL):', pal);
      r = this.writeKeyValueRow(sheet, r, 'TDEE ước tính:', `${tdee} kcal/ngày`);
      if (patient.so_dien_thoai || patient.phoneNumber) {
        r = this.writeKeyValueRow(
          sheet,
          r,
          'Số điện thoại:',
          patient.so_dien_thoai || patient.phoneNumber,
        );
      }
    }

    // Khối Cơ cấu năng lượng P:L:G (13-20% : 20-25% : 55-65%) hiển thị rõ ràng trên Header chuẩn Bộ Y Tế
    const details = menu.chi_tiet_thuc_don || menu.menuDetails || [];
    const dayGroups = this.groupMenuDetailsByDay(details);
    const dayCount = dayGroups.size > 0 ? dayGroups.size : 1;

    let sumE = 0;
    let sumP = 0;
    let sumF = 0;
    let sumC = 0;

    for (const [, dayDetails] of dayGroups.entries()) {
      const dayTotals = this.calculateDayNutrientTotals(dayDetails);
      const p = dayTotals['protein'] || 0;
      const f = dayTotals['fat'] || 0;
      const c = dayTotals['carbohydrate'] || 0;
      const e = dayTotals['energy'] || p * 4 + f * 9 + c * 4;
      sumE += e;
      sumP += p;
      sumF += f;
      sumC += c;
    }

    const avgE = Math.round(sumE / dayCount);
    const avgP = this.round2(sumP / dayCount);
    const avgF = this.round2(sumF / dayCount);
    const avgC = this.round2(sumC / dayCount);

    const eP = Math.round(avgP * 4);
    const eF = Math.round(avgF * 9);
    const eC = Math.round(avgC * 4);
    const eSum = eP + eF + eC > 0 ? eP + eF + eC : avgE > 0 ? avgE : 1;

    const ratioP = Math.round((eP / eSum) * 1000) / 10;
    const ratioL = Math.round((eF / eSum) * 1000) / 10;
    const ratioG = Math.round((eC / eSum) * 1000) / 10;

    r++; // Cách 1 dòng
    r = this.writeKeyValueRow(
      sheet,
      r,
      'CƠ CẤU NĂNG LƯỢNG (P:L:G):',
      `${ratioP}% : ${ratioL}% : ${ratioG}% (Khuyến nghị BYT: 13-20% : 20-25% : 55-65%)`,
    );
    r = this.writeKeyValueRow(
      sheet,
      r,
      'Năng lượng trung bình/ngày:',
      `${avgE} kcal (Đạm: ${avgP}g [${ratioP}%] | Béo: ${avgF}g [${ratioL}%] | Glucid: ${avgC}g [${ratioG}%])`,
    );

    return r;
  }

  private writeKeyValueRow(sheet: ExcelJS.Worksheet, r: number, key: string, value: any): number {
    const row = sheet.getRow(r);
    row.height = 20;

    const cellKey = row.getCell(1);
    cellKey.value = key;
    cellKey.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF333333' } };
    cellKey.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellVal = row.getCell(2);
    cellVal.value = value != null ? value : '';
    cellVal.font = { name: EXCEL_FONT_FAMILY, size: 10, color: { argb: 'FF000000' } };
    cellVal.alignment = { vertical: 'middle', horizontal: 'left' };

    return r + 1;
  }

  /**
   * Ghi dòng Tiêu đề ngày (Light Green, merged cells)
   */
  private writeDayTitleRow(
    sheet: ExcelJS.Worksheet,
    rowIdx: number,
    dayDetail: any,
    menuType: string,
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
  ): number {
    const row = sheet.getRow(rowIdx);
    row.height = 26;

    const weekNo = dayDetail.so_tuan ?? dayDetail.weekNo ?? 1;
    const dayOfWeek = dayDetail.thu_trong_tuan ?? dayDetail.dayOfWeek ?? 1;

    let title = 'Thực đơn ngày';
    const typeUpper = String(menuType || '').toUpperCase();
    if (
      typeUpper === MenuType.TUAN ||
      typeUpper === 'WEEK' ||
      typeUpper === MenuType.THANG ||
      typeUpper === 'MONTH'
    ) {
      const thuText = dayOfWeek === 8 ? 'Chủ nhật' : `Thứ ${dayOfWeek}`;
      title = `${thuText} - Tuần ${weekNo}`;
    }

    const cell = row.getCell(1);
    cell.value = title;
    cell.font = EXCEL_STYLES.FONTS.DAY_TITLE;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.LIGHT_GREEN_DAY },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Tính tổng số cột cần merge
    const totalCols = this.getTotalColumnsCount(exportType, columns);
    sheet.mergeCells(rowIdx, 1, rowIdx, Math.max(totalCols, 3));
    this.applyBorderToRange(sheet, rowIdx, 1, rowIdx, Math.max(totalCols, 3), 'thin');

    return rowIdx + 1;
  }

  /**
   * Ghi bảng Chỉ tiêu / Giới hạn / Thực tế ngày / Độ lệch
   */
  private writeDayNutritionSummary(
    sheet: ExcelJS.Worksheet,
    rowIdx: number,
    dayDetails: any[],
    menu: any,
    columns: ResolvedExportColumn[],
  ): number {
    // 1. Header Chỉ tiêu
    const headerRow = sheet.getRow(rowIdx++);
    headerRow.height = 24;
    headerRow.getCell(1).value = 'Chỉ tiêu';
    headerRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
    };
    headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    let c = 2;
    for (const col of columns) {
      const cell = headerRow.getCell(c++);
      cell.value = col.header;
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'thin');

    // 2. Dòng Giới hạn (nếu có từ gioi_han_dinh_duong)
    const limitRow = sheet.getRow(rowIdx++);
    limitRow.height = 20;
    limitRow.getCell(1).value = 'Giới hạn';
    limitRow.getCell(1).font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true };
    limitRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const limitsMap = this.extractLimitsJson(menu);

    c = 2;
    for (const col of columns) {
      const limitVal = limitsMap[col.key];
      const cell = limitRow.getCell(c++);
      cell.value = limitVal !== undefined && limitVal !== null ? Number(limitVal) : '';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10 };
    }
    this.applyRowBorder(limitRow, 'thin');

    // 3. Dòng Thực tế (Tổng dinh dưỡng ngày)
    const totalRow = sheet.getRow(rowIdx++);
    totalRow.height = 22;
    totalRow.getCell(1).value = 'Thực tế';
    totalRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 10,
      bold: true,
      color: { argb: 'FF1F497D' },
    };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const dayTotals = this.calculateDayNutrientTotals(dayDetails);

    c = 2;
    for (const col of columns) {
      const cell = totalRow.getCell(c++);
      const val = dayTotals[col.key] || 0;
      cell.value = val;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1F497D' } };
    }
    this.applyRowBorder(totalRow, 'thin');

    // 4. Dòng Độ lệch (Thực tế - Giới hạn)
    const diffRow = sheet.getRow(rowIdx++);
    diffRow.height = 22;
    diffRow.getCell(1).value = 'Độ lệch';
    diffRow.getCell(1).font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true };
    diffRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    c = 2;
    for (const col of columns) {
      const cell = diffRow.getCell(c++);
      const limitVal = limitsMap[col.key];
      const actualVal = dayTotals[col.key] || 0;

      if (limitVal !== undefined && limitVal !== null && Number(limitVal) > 0) {
        const diff = actualVal - Number(limitVal);
        const percent = Math.round((diff / Number(limitVal)) * 1000) / 10;
        const sign = diff > 0 ? '+' : '';
        cell.value = `${sign}${Math.round(diff * 10) / 10} (${sign}${percent}%)`;
        cell.font = {
          name: EXCEL_FONT_FAMILY,
          size: 10,
          color: { argb: Math.abs(percent) > 10 ? 'FF9C0006' : 'FF006100' },
          bold: Math.abs(percent) > 10,
        };
      } else {
        cell.value = '';
      }
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
    this.applyRowBorder(diffRow, 'thin');

    return rowIdx + 1; // Cách 1 dòng
  }

  /**
   * Ghi khối một Bữa ăn trong ngày (Bữa sáng, Trưa, Tối...)
   */
  private writeMealBlock(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    meal: any,
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
    _servings: number,
  ): number {
    let r = startRow;

    // 1. Tiêu đề Bữa ăn (Light Yellow, Merged cells)
    const mealTitleRow = sheet.getRow(r++);
    mealTitleRow.height = 24;

    const mealName = meal.ten_bua_an || meal.mealName || 'Bữa ăn';
    const mealTime = meal.gio_an || meal.time ? ` (${meal.gio_an || meal.time})` : '';

    const titleCell = mealTitleRow.getCell(1);
    titleCell.value = `${mealName}${mealTime}`;
    titleCell.font = EXCEL_STYLES.FONTS.MEAL_TITLE;
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.LIGHT_YELLOW_MEAL },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const totalCols = this.getTotalColumnsCount(exportType, columns);
    sheet.mergeCells(r - 1, 1, r - 1, Math.max(totalCols, 3));
    this.applyBorderToRange(sheet, r - 1, 1, r - 1, Math.max(totalCols, 3), 'thin');

    // 2. Dòng Tiêu đề bảng của Bữa ăn
    const tableHeaderRow = sheet.getRow(r++);
    tableHeaderRow.height = 24;

    const tableHeaders = this.getMealTableHeaders(exportType, columns);
    for (let i = 0; i < tableHeaders.length; i++) {
      const cell = tableHeaderRow.getCell(i + 1);
      cell.value = tableHeaders[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(tableHeaderRow, 'thin');

    // 3. Danh sách Món ăn và Nguyên liệu
    const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];
    const mealNutrientSums: Record<string, number> = {};
    let mealNetWeightSum = 0;
    let mealCookedWeightSum = 0;

    for (const md of mealDetails) {
      const dish = md.mon_an || md.dish;
      if (!dish) continue;

      const dishCoef = Number(md.he_so_song_chin ?? dish.he_so_song_chin ?? 1.0);
      const dishDetails = dish.chi_tiet_mon_an || dish.details || [];
      const dishStartRow = r;
      let dishCookedTotal = 0;
      let dishNetTotal = 0;
      const dishNutrientSums: Record<string, number> = {};

      for (let i = 0; i < dishDetails.length; i++) {
        const dd = dishDetails[i];
        const ing = dd.nguyen_lieu || dd.ingredient;
        const netWeight = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
        const edible = Number(ing?.ty_le_an_duoc ?? ing?.edible ?? 100);
        const rawWeight = edible > 0 ? netWeight / (edible / 100) : netWeight;
        const cookedWeight = netWeight * dishCoef;

        dishNetTotal += netWeight;
        dishCookedTotal += cookedWeight;

        const row = sheet.getRow(r++);
        row.height = 20;

        let colIdx = 1;
        // Ô Tên món: Chỉ ghi ở dòng đầu của món
        row.getCell(colIdx++).value = i === 0 ? dish.ten_mon || dish.name || '' : '';
        // Ô Tên nguyên liệu
        row.getCell(colIdx++).value =
          ing?.ten_nguyen_lieu || ing?.material || `NL #${dd.nguyen_lieu_id || dd.ingredientId}`;

        // Cột khối lượng theo chế độ xuất
        switch (exportType) {
          case MenuExportType.RAW:
            row.getCell(colIdx++).value = this.round2(rawWeight);
            break;
          case MenuExportType.COOKED:
            row.getCell(colIdx++).value = this.round2(cookedWeight);
            break;
          default:
            row.getCell(colIdx++).value = this.round2(netWeight);
            break;
        }

        if (exportType === MenuExportType.FULL) {
          row.getCell(colIdx++).value = this.round2(rawWeight);
          row.getCell(colIdx++).value = this.round2(edible);
          row.getCell(colIdx++).value = this.round2(dishCoef);
          row.getCell(colIdx++).value = this.round2(cookedWeight);
        }

        // Tính vi chất nếu là FULL hoặc NET_NUTRITION
        if (exportType === MenuExportType.FULL || exportType === MenuExportType.NET_NUTRITION) {
          const ingNutrients = this.calculateIngredientNutrientValues(ing, netWeight);
          for (const col of columns) {
            const nutVal = ingNutrients[col.key] || 0;
            row.getCell(colIdx++).value = nutVal;
            dishNutrientSums[col.key] = (dishNutrientSums[col.key] || 0) + nutVal;
          }
        }

        // Căn lề & border dòng dữ liệu
        this.formatDataRowCells(row, colIdx - 1);
      }

      // Merge cột Tên món ăn theo chiều dọc nếu món có từ 2 nguyên liệu trở lên
      const dishEndRow = r - 1;
      if (dishEndRow > dishStartRow) {
        sheet.mergeCells(dishStartRow, 1, dishEndRow, 1);
        sheet.getCell(dishStartRow, 1).alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // 4. Dòng TỔNG MÓN
      if (
        exportType === MenuExportType.FULL ||
        exportType === MenuExportType.NET_NUTRITION ||
        exportType === MenuExportType.NET
      ) {
        const dishTotalRow = sheet.getRow(r++);
        dishTotalRow.height = 22;
        let tCol = 1;

        dishTotalRow.getCell(tCol++).value = 'Tổng món';
        dishTotalRow.getCell(tCol++).value = ''; // Tên TP rỗng

        if (exportType === MenuExportType.NET) {
          dishTotalRow.getCell(tCol++).value = this.round2(dishNetTotal);
        } else if (exportType === MenuExportType.FULL) {
          dishTotalRow.getCell(tCol++).value = this.round2(dishNetTotal); // Sống sạch
          dishTotalRow.getCell(tCol++).value = ''; // Sống thô
          dishTotalRow.getCell(tCol++).value = ''; // Edible
          dishTotalRow.getCell(tCol++).value = this.round2(dishCoef);
          dishTotalRow.getCell(tCol++).value = this.round2(dishCookedTotal);
        } else {
          dishTotalRow.getCell(tCol++).value = this.round2(dishNetTotal);
        }

        if (exportType === MenuExportType.FULL || exportType === MenuExportType.NET_NUTRITION) {
          for (const col of columns) {
            const sumVal = this.round2(dishNutrientSums[col.key] || 0);
            dishTotalRow.getCell(tCol++).value = sumVal;
            mealNutrientSums[col.key] = (mealNutrientSums[col.key] || 0) + sumVal;
          }
        }

        mealNetWeightSum += dishNetTotal;
        mealCookedWeightSum += dishCookedTotal;

        this.formatTotalRowCells(dishTotalRow, tCol - 1, 'FF1A73E8', 'FFE8F0FE');
      }
    }

    // 5. Dòng TỔNG BỮA
    if (
      exportType === MenuExportType.FULL ||
      exportType === MenuExportType.NET_NUTRITION ||
      exportType === MenuExportType.NET
    ) {
      const mealTotalRow = sheet.getRow(r++);
      mealTotalRow.height = 24;
      let mCol = 1;

      mealTotalRow.getCell(mCol++).value = 'Tổng bữa';
      mealTotalRow.getCell(mCol++).value = '';

      if (exportType === MenuExportType.NET) {
        mealTotalRow.getCell(mCol++).value = this.round2(mealNetWeightSum);
      } else if (exportType === MenuExportType.FULL) {
        mealTotalRow.getCell(mCol++).value = this.round2(mealNetWeightSum);
        mealTotalRow.getCell(mCol++).value = '';
        mealTotalRow.getCell(mCol++).value = '';
        mealTotalRow.getCell(mCol++).value = '';
        mealTotalRow.getCell(mCol++).value = this.round2(mealCookedWeightSum);
      } else {
        mealTotalRow.getCell(mCol++).value = this.round2(mealNetWeightSum);
      }

      if (exportType === MenuExportType.FULL || exportType === MenuExportType.NET_NUTRITION) {
        for (const col of columns) {
          mealTotalRow.getCell(mCol++).value = this.round2(mealNutrientSums[col.key] || 0);
        }
      }

      this.formatTotalRowCells(mealTotalRow, mCol - 1, 'FF2E7D32', 'FFE2F0D9');
    }

    return r + 1; // Cách 1 dòng giữa các bữa
  }

  /**
   * Ghi Bảng tổng hợp nguyên liệu sống thô theo ngày (cho RAW export)
   */
  private writeDailyRawIngredientSummary(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    dayDetails: any[],
    servings: number,
  ): number {
    let r = startRow;

    // Gom nhóm nguyên liệu trong ngày
    const ingredientMap = new Map<string, { name: string; rawWeight: number }>();

    for (const md of dayDetails) {
      const meal = md.bua_an || md.meal;
      if (!meal) continue;

      const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];
      for (const mItem of mealDetails) {
        const dish = mItem.mon_an || mItem.dish;
        if (!dish) continue;

        const dishDetails = dish.chi_tiet_mon_an || dish.details || [];
        for (const dd of dishDetails) {
          const ing = dd.nguyen_lieu || dd.ingredient;
          const net = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
          const edible = Number(ing?.ty_le_an_duoc ?? ing?.edible ?? 100);
          const raw = edible > 0 ? net / (edible / 100) : net;

          const name =
            ing?.ten_nguyen_lieu || ing?.material || `NL #${dd.nguyen_lieu_id || dd.ingredientId}`;
          const key = name.trim().toLowerCase();

          if (!ingredientMap.has(key)) {
            ingredientMap.set(key, { name, rawWeight: 0 });
          }
          ingredientMap.get(key)!.rawWeight += raw;
        }
      }
    }

    // Tiêu đề
    const titleRow = sheet.getRow(r++);
    titleRow.height = 22;
    titleRow.getCell(1).value = 'Tổng nguyên liệu đi chợ trong ngày';
    titleRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 11,
      bold: true,
      color: { argb: 'FF1F497D' },
    };
    sheet.mergeCells(r - 1, 1, r - 1, 4);

    // Header
    const headerRow = sheet.getRow(r++);
    headerRow.height = 22;
    const headers = ['STT', 'Nguyên liệu', 'Sống thô 1 suất (g)', `Tổng mua ${servings} suất (g)`];
    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'thin');

    let idx = 1;
    let totalDayRaw1 = 0;
    let totalDayRawN = 0;

    for (const item of ingredientMap.values()) {
      const row = sheet.getRow(r++);
      row.height = 20;

      const raw1 = this.round2(item.rawWeight);
      const rawN = this.round2(item.rawWeight * servings);
      totalDayRaw1 += raw1;
      totalDayRawN += rawN;

      row.getCell(1).value = idx++;
      row.getCell(2).value = item.name;
      row.getCell(3).value = raw1;
      row.getCell(4).value = rawN;

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      this.applyRowBorder(row, 'thin');
    }

    // Dòng tổng cộng
    const sumRow = sheet.getRow(r++);
    sumRow.height = 22;
    sumRow.getCell(1).value = 'TỔNG CỘNG';
    sumRow.getCell(2).value = '';
    sumRow.getCell(3).value = this.round2(totalDayRaw1);
    sumRow.getCell(4).value = this.round2(totalDayRawN);
    sheet.mergeCells(r - 1, 1, r - 1, 2);
    this.formatTotalRowCells(sumRow, 4, 'FF1F497D', 'FFE8F0FE');

    return r + 1;
  }

  // ==========================================
  // SHEET PHỤ CHO CHẾ ĐỘ RAW & COOKED
  // ==========================================

  /**
   * Tạo Sheet Tổng hợp đi chợ cho CẢ CHU KỲ thực đơn (Tuần / Tháng)
   */
  private async buildRawShoppingSummarySheet(
    workbook: ExcelJS.Workbook,
    menu: any,
    servings: number,
  ): Promise<void> {
    const sheet = workbook.addWorksheet(MenuExcelService.SHOPPING_SHEET, {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    const titleRow = sheet.getRow(r++);
    titleRow.height = 28;
    titleRow.getCell(1).value =
      `BẢNG TỔNG HỢP NGUYÊN LIỆU ĐI CHỢ (${servings} SUẤT ĂN - CẢ CHU KỲ)`;
    titleRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 13,
      bold: true,
      color: { argb: 'FF1F497D' },
    };

    r++; // Dòng trống

    // Header bảng
    const headerRow = sheet.getRow(r++);
    headerRow.height = 24;
    const headers = [
      'STT',
      'Tên nguyên liệu thực phẩm',
      'Tỷ lệ ăn được (%)',
      'Sống sạch 1 suất (g)',
      'Sống thô 1 suất (g)',
      `Tổng mua ${servings} suất (g)`,
      `Quy đổi sang kg (kg)`,
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.MEDICAL_GREEN },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'thin');

    // Gom nhóm toàn bộ nguyên liệu của tất cả các ngày trong thực đơn
    const cycleIngMap = new Map<
      string,
      { name: string; edible: number; netWeight: number; rawWeight: number }
    >();
    const details = menu.chi_tiet_thuc_don || menu.menuDetails || [];

    for (const md of details) {
      const meal = md.bua_an || md.meal;
      if (!meal) continue;

      const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];
      for (const mItem of mealDetails) {
        const dish = mItem.mon_an || mItem.dish;
        if (!dish) continue;

        const dishDetails = dish.chi_tiet_mon_an || dish.details || [];
        for (const dd of dishDetails) {
          const ing = dd.nguyen_lieu || dd.ingredient;
          const net = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
          const edible = Number(ing?.ty_le_an_duoc ?? ing?.edible ?? 100);
          const raw = edible > 0 ? net / (edible / 100) : net;

          const name =
            ing?.ten_nguyen_lieu || ing?.material || `NL #${dd.nguyen_lieu_id || dd.ingredientId}`;
          const key = name.trim().toLowerCase();

          if (!cycleIngMap.has(key)) {
            cycleIngMap.set(key, { name, edible, netWeight: 0, rawWeight: 0 });
          }
          const item = cycleIngMap.get(key)!;
          item.netWeight += net;
          item.rawWeight += raw;
        }
      }
    }

    let stt = 1;
    let totalCycleRawGrams = 0;

    for (const item of cycleIngMap.values()) {
      const row = sheet.getRow(r++);
      row.height = 20;

      const rawGramsN = item.rawWeight * servings;
      const rawKgN = rawGramsN / 1000;
      totalCycleRawGrams += rawGramsN;

      row.getCell(1).value = stt++;
      row.getCell(2).value = item.name;
      row.getCell(3).value = this.round2(item.edible);
      row.getCell(4).value = this.round2(item.netWeight);
      row.getCell(5).value = this.round2(item.rawWeight);
      row.getCell(6).value = this.round2(rawGramsN);
      row.getCell(7).value = this.round2(rawKgN);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      for (let c = 3; c <= 7; c++) {
        row.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' };
      }
      this.applyRowBorder(row, 'thin');
    }

    // Dòng Tổng cộng
    const sumRow = sheet.getRow(r++);
    sumRow.height = 24;
    sumRow.getCell(1).value = 'TỔNG CỘNG ĐI CHỢ';
    sumRow.getCell(6).value = this.round2(totalCycleRawGrams);
    sumRow.getCell(7).value = this.round2(totalCycleRawGrams / 1000);
    sheet.mergeCells(r - 1, 1, r - 1, 5);
    this.formatTotalRowCells(sumRow, 7, 'FF2E7D32', 'FFE2F0D9');

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 22;
    sheet.getColumn(7).width = 22;

    if (typeof (sheet as any).commit === 'function') {
      await (sheet as any).commit();
    }
  }

  /**
   * Tạo Sheet Hướng dẫn định lượng nhà bếp (COOKED mode)
   */
  private async buildCookedKitchenSummarySheet(
    workbook: ExcelJS.Workbook,
    menu: any,
    servings: number,
  ): Promise<void> {
    const sheet = workbook.addWorksheet(MenuExcelService.COOKING_SHEET, {
      views: [{ showGridLines: true }],
    });

    let r = 1;
    const titleRow = sheet.getRow(r++);
    titleRow.height = 28;
    titleRow.getCell(1).value = `BẢNG HƯỚNG DẪN ĐỊNH LƯỢNG CHẾ BIẾN NHÀ BẾP (${servings} SUẤT ĂN)`;
    titleRow.getCell(1).font = {
      name: EXCEL_FONT_FAMILY,
      size: 13,
      bold: true,
      color: { argb: 'FF1F497D' },
    };

    r++;

    const headerRow = sheet.getRow(r++);
    headerRow.height = 24;
    const headers = [
      'STT',
      'Bữa ăn',
      'Tên món ăn thành phẩm',
      'Hệ số nở/hao (sống→chín)',
      'Định lượng 1 suất chín (g)',
      `Tổng thành phẩm nấu ${servings} suất (kg)`,
      'Hướng dẫn chia suất',
    ];

    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = EXCEL_STYLES.FONTS.HEADER;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    this.applyRowBorder(headerRow, 'thin');

    const details = menu.chi_tiet_thuc_don || menu.menuDetails || [];
    let stt = 1;

    for (const md of details) {
      const meal = md.bua_an || md.meal;
      if (!meal) continue;

      const mealName = meal.ten_bua_an || meal.mealName || 'Bữa ăn';
      const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];

      for (const mItem of mealDetails) {
        const dish = mItem.mon_an || mItem.dish;
        if (!dish) continue;

        const dishCoef = Number(mItem.he_so_song_chin ?? dish.he_so_song_chin ?? 1.0);
        const dishDetails = dish.chi_tiet_mon_an || dish.details || [];

        let dishCookedOne = 0;
        for (const dd of dishDetails) {
          const net = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
          dishCookedOne += net * dishCoef;
        }

        const dishCookedTotalKg = (dishCookedOne * servings) / 1000;

        const row = sheet.getRow(r++);
        row.height = 22;

        row.getCell(1).value = stt++;
        row.getCell(2).value = mealName;
        row.getCell(3).value = dish.ten_mon || dish.name || '';
        row.getCell(4).value = this.round2(dishCoef);
        row.getCell(5).value = this.round2(dishCookedOne);
        row.getCell(6).value = this.round2(dishCookedTotalKg);
        row.getCell(7).value = `Mỗi suất múc khoảng ${Math.round(dishCookedOne)}g`;

        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

        this.applyRowBorder(row, 'thin');
      }
    }

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 24;
    sheet.getColumn(5).width = 24;
    sheet.getColumn(6).width = 28;
    sheet.getColumn(7).width = 30;

    if (typeof (sheet as any).commit === 'function') {
      await (sheet as any).commit();
    }
  }

  // ==========================================
  // CÁC HÀM TRỢ GIÚP TÍNH TOÁN & ĐỊNH DẠNG
  // ==========================================

  private resolveExportColumns(selectedCodes?: string[]): ResolvedExportColumn[] {
    const allColumns: ResolvedExportColumn[] = NUTRIENT_CODES.map((code) => {
      const meta = NUTRIENT_METADATA_MAP[code];
      return {
        key: code,
        header: meta ? `${meta.nameVi} (${meta.unit})` : code,
        unit: meta ? meta.unit : '',
      };
    });

    if (!selectedCodes || selectedCodes.length === 0) {
      return allColumns;
    }

    const lowerCodes = selectedCodes.map((c) => c.trim().toLowerCase());
    const filtered = allColumns.filter((c) => lowerCodes.includes(c.key.toLowerCase()));
    return filtered.length > 0 ? filtered : allColumns;
  }

  private calculateIngredientNutrientValues(
    ing: any,
    netWeightGrams: number,
  ): Record<string, number> {
    if (!ing || netWeightGrams <= 0) return {};
    const ratio = netWeightGrams / 100.0;
    const result: Record<string, number> = {};

    for (const code of NUTRIENT_CODES) {
      const rawVal = Number(ing[code] ?? 0);
      result[code] = this.round2(rawVal * ratio);
    }

    return result;
  }

  private calculateDayNutrientTotals(dayDetails: any[]): Record<string, number> {
    const totals: Record<string, number> = {};

    for (const md of dayDetails) {
      const meal = md.bua_an || md.meal;
      if (!meal) continue;

      const mealDetails = meal.chi_tiet_bua_an || meal.mealDetails || [];
      for (const mItem of mealDetails) {
        const dish = mItem.mon_an || mItem.dish;
        if (!dish) continue;

        const dishDetails = dish.chi_tiet_mon_an || dish.details || [];
        for (const dd of dishDetails) {
          const ing = dd.nguyen_lieu || dd.ingredient;
          const net = Number(dd.khoi_luong_song_sach ?? dd.netWeight ?? 0);
          if (!ing || net <= 0) continue;

          const ratio = net / 100.0;
          for (const code of NUTRIENT_CODES) {
            const rawVal = Number(ing[code] ?? 0);
            totals[code] = (totals[code] || 0) + rawVal * ratio;
          }
        }
      }
    }

    for (const k of Object.keys(totals)) {
      totals[k] = this.round2(totals[k]);
    }

    return totals;
  }

  private extractLimitsJson(menu: any): Record<string, number> {
    const limitSet = menu.gioi_han_dinh_duong || menu.nutritionLimitSet;
    if (!limitSet) return {};

    const rawJson = limitSet.gioi_han_json || limitSet.limitsJson;
    if (!rawJson) return {};

    if (typeof rawJson === 'object') {
      return rawJson as Record<string, number>;
    }

    try {
      return JSON.parse(rawJson);
    } catch {
      return {};
    }
  }

  private groupMenuDetailsByDay(details: any[]): Map<string, any[]> {
    const dayMap = new Map<string, any[]>();

    for (const item of details) {
      const week = item.so_tuan ?? item.weekNo ?? 1;
      const day = item.thu_trong_tuan ?? item.dayOfWeek ?? 1;
      const key = `${week}-${day}`;

      if (!dayMap.has(key)) {
        dayMap.set(key, []);
      }
      dayMap.get(key)!.push(item);
    }

    return dayMap;
  }

  private getMealTableHeaders(
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
  ): string[] {
    const headers: string[] = ['Món ăn', 'Tên TP'];

    const weightHeader =
      exportType === MenuExportType.RAW
        ? 'Sống thô (g)'
        : exportType === MenuExportType.COOKED
          ? 'Khối lượng chín (g)'
          : 'Sống sạch (g)';

    headers.push(weightHeader);

    if (exportType === MenuExportType.FULL) {
      headers.push('Sống thô (g)', 'Ăn được (%)', 'Hệ số sống chín', 'Khối lượng chín (g)');
    }

    if (exportType === MenuExportType.FULL || exportType === MenuExportType.NET_NUTRITION) {
      for (const col of columns) {
        headers.push(col.header);
      }
    }

    return headers;
  }

  private getTotalColumnsCount(
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
  ): number {
    switch (exportType) {
      case MenuExportType.FULL:
        return 7 + columns.length;
      case MenuExportType.NET_NUTRITION:
        return 3 + columns.length;
      case MenuExportType.RAW:
      case MenuExportType.COOKED:
      case MenuExportType.NET:
      default:
        return 3;
    }
  }

  private autoFitColumnWidths(
    sheet: ExcelJS.Worksheet,
    exportType: MenuExportType,
    columns: ResolvedExportColumn[],
  ): void {
    sheet.getColumn(1).width = 30; // Món ăn
    sheet.getColumn(2).width = 36; // Tên TP
    sheet.getColumn(3).width = 16; // Khối lượng

    if (exportType === MenuExportType.FULL) {
      sheet.getColumn(4).width = 16; // Sống thô
      sheet.getColumn(5).width = 14; // Ăn được
      sheet.getColumn(6).width = 16; // Hệ số
      sheet.getColumn(7).width = 18; // Khối lượng chín

      for (let c = 8; c <= 7 + columns.length; c++) {
        sheet.getColumn(c).width = 18;
      }
    } else if (exportType === MenuExportType.NET_NUTRITION) {
      for (let c = 4; c <= 3 + columns.length; c++) {
        sheet.getColumn(c).width = 18;
      }
    }
  }

  private formatDataRowCells(row: ExcelJS.Row, totalCols: number): void {
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    for (let c = 3; c <= totalCols; c++) {
      row.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(c).font = EXCEL_STYLES.FONTS.DATA;
    }
    this.applyRowBorder(row, 'thin');
  }

  private formatTotalRowCells(
    row: ExcelJS.Row,
    totalCols: number,
    textArgb: string,
    fillArgb: string,
  ): void {
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: textArgb } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillArgb },
      };
      if (c >= 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
    }
    this.applyRowBorder(row, 'medium');
  }

  private applyRowBorder(row: ExcelJS.Row, borderStyle: 'thin' | 'medium'): void {
    const totalCells = row.cellCount || 10;
    for (let c = 1; c <= totalCells; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        bottom: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        left: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        right: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      };
    }
  }

  private applyBorderToRange(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    borderStyle: 'thin' | 'medium',
  ): void {
    for (let r = startRow; r <= endRow; r++) {
      const row = sheet.getRow(r);
      for (let c = startCol; c <= endCol; c++) {
        row.getCell(c).border = {
          top: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
          bottom: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
          left: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
          right: { style: borderStyle, color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        };
      }
    }
  }

  private formatMenuType(type?: string): string {
    switch (String(type || '').toUpperCase()) {
      case MenuType.NGAY:
      case 'DAY':
        return 'Thực đơn ngày';
      case MenuType.TUAN:
      case 'WEEK':
        return 'Thực đơn tuần';
      case MenuType.THANG:
      case 'MONTH':
        return 'Thực đơn tháng';
      default:
        return type || 'Thực đơn tiêu chuẩn';
    }
  }

  private classifyBmi(bmi: number): string {
    if (bmi <= 0) return '';
    if (bmi < 18.5) return 'Thiếu cân / Gầy';
    if (bmi <= 22.9) return 'Bình thường (WHO Châu Á)';
    if (bmi <= 24.9) return 'Tiền béo phì / Thừa cân';
    if (bmi <= 29.9) return 'Béo phì độ I';
    return 'Béo phì độ II';
  }

  private round2(val: number): number {
    return Math.round((Number(val) || 0) * 100) / 100;
  }
}
