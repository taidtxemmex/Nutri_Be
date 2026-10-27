import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseExcelStreamer, ExcelStreamOptions } from '../../../core/excel-engine';
import { ExcelSecurityUtil } from '../../../security/excel/excel-security.util';
import {
  EXCEL_FONT_FAMILY,
  EXCEL_STYLES,
  DAILY_INTAKE_EXPORT_COLUMNS,
} from '../../../config/constants/excel.constants';
import {
  DailyIntakeExportRequestDto,
  DailyIntakeExportTemplateType,
} from '../dto/daily-intake-export-request.dto';
import { UserRole } from '../../../config/enums/role.enum';
import * as ExcelJS from 'exceljs';

/**
 * Lớp Streamer chuyên dụng cho Báo cáo Khẩu phần ăn 24h
 * Kế thừa BaseExcelStreamer đảm bảo bộ nhớ đệm O(1) < 35MB RAM, chống Formula Injection (CWE-1236)
 */
class DailyIntakeExcelStreamer extends BaseExcelStreamer {
  constructor(outputStream: Response, options: ExcelStreamOptions = {}) {
    super(outputStream, {
      sheetName: options.sheetName || 'Data',
      freezeHeader: options.freezeHeader ?? true,
      defaultColWidth: options.defaultColWidth ?? 16,
    });
  }

  /**
   * Xuất khối thông tin bệnh nhân ở đầu báo cáo Mẫu 3
   */
  public async writePatientHeaderBlock(
    patient: { ho_ten: string; ma_benh_nhan_bv?: string | null; id: bigint; gioi_tinh: string; age?: number },
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    const boldFont = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1F497D' } };
    const labelStyle = { vertical: 'middle' as const, horizontal: 'left' as const };

    const r1 = this.worksheet.addRow([
      'Họ tên bệnh nhân:',
      patient.ho_ten,
      '',
      'Từ ngày:',
      fromDate,
    ]);
    r1.getCell(1).font = boldFont;
    r1.getCell(4).font = boldFont;
    r1.commit();
    this.rowCount++;

    const r2 = this.worksheet.addRow([
      'Mã bệnh nhân:',
      patient.ma_benh_nhan_bv || patient.id.toString(),
      '',
      'Đến ngày:',
      toDate,
    ]);
    r2.getCell(1).font = boldFont;
    r2.getCell(4).font = boldFont;
    r2.commit();
    this.rowCount++;

    const r3 = this.worksheet.addRow(['Giới tính:', patient.gioi_tinh, '', '', '']);
    r3.getCell(1).font = boldFont;
    r3.commit();
    this.rowCount++;

    const r4 = this.worksheet.addRow(['Tuổi:', patient.age ?? '', '', '', '']);
    r4.getCell(1).font = boldFont;
    r4.commit();
    this.rowCount++;

    await this.writeEmptyRow();
  }

  /**
   * Xuất dòng tiêu đề ngày ăn (Day Title) gom ô ngang
   */
  public async writeDayTitleRow(dateStr: string, totalCols: number, labelPrefix = 'NGÀY: '): Promise<void> {
    const rowNum = this.rowCount + 1;
    const row = this.worksheet.getRow(rowNum);
    const cell = row.getCell(1);
    cell.value = ExcelSecurityUtil.sanitizeCellValue(`${labelPrefix}${dateStr}`);
    cell.font = { name: EXCEL_FONT_FAMILY, size: 11, bold: true, color: { argb: 'FF276A3C' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2F0D9' }, // Light Green y tế
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    row.height = 24;

    if (totalCols > 1) {
      this.worksheet.mergeCells(rowNum, 1, rowNum, totalCols);
    }

    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  /**
   * Xuất dòng tiêu đề bảng (Header Row) chuẩn Navy #1F497D
   */
  public async writeTableHeaderRow(headers: string[]): Promise<void> {
    const sanitized = ExcelSecurityUtil.sanitizeRow(headers);
    const row = this.worksheet.addRow(sanitized);
    row.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.PRIMARY_NAVY },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 26;
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  /**
   * Xuất dòng dữ liệu thông thường với viền mỏng (Thin border)
   */
  public async writeDataRow(data: any[]): Promise<void> {
    const sanitized = ExcelSecurityUtil.sanitizeRow(data);
    const row = this.worksheet.addRow(sanitized);
    row.font = EXCEL_STYLES.FONTS.DATA;
    row.alignment = { vertical: 'middle', horizontal: 'left' };
    row.height = 20;

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
    };
    row.border = thinBorder;

    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  /**
   * Xuất dòng tổng kết bữa ăn (Meal Total Row)
   */
  public async writeMealTotalRow(mealName: string, totals: any[]): Promise<void> {
    const rowData = [`Tổng bữa: ${mealName}`, '', '', ...totals];
    const sanitized = ExcelSecurityUtil.sanitizeRow(rowData);
    const row = this.worksheet.addRow(sanitized);
    row.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF8A6D3B' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.LIGHT_YELLOW_MEAL },
    };
    row.height = 22;
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  /**
   * Xuất dòng tổng kết ngày ăn (Day Total Row)
   */
  public async writeDayTotalRow(totals: any[]): Promise<void> {
    const rowData = ['TỔNG NGÀY', '', '', ...totals];
    const sanitized = ExcelSecurityUtil.sanitizeRow(rowData);
    const row = this.worksheet.addRow(sanitized);
    row.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1A73E8' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_STYLES.COLORS.LIGHT_BLUE_TOTAL },
    };
    row.border = {
      top: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      bottom: { style: 'double', color: { argb: EXCEL_STYLES.COLORS.BORDER_MEDIUM } },
    };
    row.height = 24;
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  /**
   * Xuất dòng trống giữa các ngày
   */
  public async writeEmptyRow(): Promise<void> {
    const row = this.worksheet.addRow([]);
    row.height = 12;
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }
}

@Injectable()
export class DailyIntakeReportStreamService {
  private readonly logger = new Logger(DailyIntakeReportStreamService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  /**
   * Tính tuổi dựa trên ngày sinh
   */
  private calculateAge(dateOfBirth?: Date | null): number {
    if (!dateOfBirth) return 30;
    const now = new Date();
    const birth = new Date(dateOfBirth);
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }

  /**
   * Router trung tâm điều hướng xuất báo cáo theo templateType (1..4)
   */
  async export(
    dto: DailyIntakeExportRequestDto,
    res: Response,
    user: any,
  ): Promise<void> {
    if (dto.templateType == null) {
      throw new HttpException(
        { code: 'EXPORT_TEMPLATE_REQUIRED', message: 'Vui lòng chọn mẫu xuất báo cáo (1..4)' },
        HttpStatus.BAD_REQUEST,
      );
    }

    dto.validateDateRange();

    switch (dto.templateType) {
      case DailyIntakeExportTemplateType.TOTAL_FOOD_GROUP_MULTI_PATIENTS:
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="tong_hop_nhom_thuc_pham.xlsx"',
        );
        return this.streamTotalFoodGroupMultiPatients(dto, res, user);

      case DailyIntakeExportTemplateType.AVG_GROUP_WEIGHT_PER_PATIENT:
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="trung_binh_nhom_thuc_pham_tren_nguoi.xlsx"',
        );
        return this.streamAvgGroupWeightPerPatient(dto, res, user);

      case DailyIntakeExportTemplateType.DAILY_NUTRIENT_INTAKE_PATIENT:
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="dinh_duong_24h_benh_nhan.xlsx"',
        );
        return this.streamPatientDailyNutrition(dto, res, user);

      case DailyIntakeExportTemplateType.TOTAL_WEIGHT_FOOD_GROUP_MULTI_PATIENTS:
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="tong_khoi_luong_nhom_thuc_pham.xlsx"',
        );
        return this.streamTotalWeightFoodGroupMultiPatients(dto, res, user);

      default:
        throw new HttpException(
          {
            code: 'EXPORT_TEMPLATE_INVALID',
            message: 'Mẫu xuất báo cáo không hợp lệ (chỉ nhận 1..4)',
          },
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  /**
   * Tính toán dinh dưỡng 1 nguyên liệu theo tỷ lệ khối lượng (chuẩn 100g)
   */
  private calculateIngredientNutrients(ing: any, ratio: number): Record<string, number> {
    const water = (ing.water ?? 0) * ratio;
    const protein = (ing.protein ?? 0) * ratio;
    const fat = (ing.fat ?? 0) * ratio;
    const ash = (ing.ash ?? 0) * ratio;
    const fiber = (ing.fiber ?? 0) * ratio;

    // Carb tính theo chênh lệch (by difference) chuẩn FAO
    const carbPer100 = Math.max(0, 100 - (ing.water ?? 0) - (ing.protein ?? 0) - (ing.fat ?? 0) - (ing.ash ?? 0));
    const carbohydrate = carbPer100 * ratio;

    // Năng lượng Atwater (4-9-4)
    const energy = protein * 4 + fat * 9 + carbohydrate * 4;

    // Vitamin A - RAE
    const retinol = (ing.retinol ?? 0) * ratio;
    const betaCarotene = (ing.betaCarotene ?? 0) * ratio;
    const alphaCarotene = (ing.alphaCarotene ?? 0) * ratio;
    const betaCryptoxanthin = (ing.betaCryptoxanthin ?? 0) * ratio;
    const vitaminARae = retinol + betaCarotene / 12 + alphaCarotene / 24 + betaCryptoxanthin / 24;

    const result: Record<string, number> = {
      energy: Number(energy.toFixed(2)),
      water: Number(water.toFixed(2)),
      carbohydrate: Number(carbohydrate.toFixed(2)),
      fiber: Number(fiber.toFixed(2)),
      ash: Number(ash.toFixed(2)),
      vitaminARae: Number(vitaminARae.toFixed(2)),
    };

    for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
      if (['energy', 'water', 'carbohydrate', 'fiber', 'ash', 'vitaminARae'].includes(col.field)) {
        continue;
      }
      const rawVal = ing[col.field];
      const val = (rawVal != null ? Number(rawVal) : 0) * ratio;
      result[col.field] = Number(val.toFixed(2));
    }

    return result;
  }

  // =========================================================================
  // MẪU 1: TOTAL_FOOD_GROUP_MULTI_PATIENTS
  // Tổng hợp nhóm thực phẩm nhiều bệnh nhân theo ngày ăn, số nhóm TP tiêu thụ,
  // tổng vi chất, tách Protein ĐV/TV và Lipid ĐV/TV.
  // =========================================================================
  async streamTotalFoodGroupMultiPatients(
    dto: DailyIntakeExportRequestDto,
    res: Response,
    user: any,
  ): Promise<void> {
    const where: any = {
      ngay_an: {
        gte: new Date(`${dto.fromDate}T00:00:00.000Z`),
        lte: new Date(`${dto.toDate}T23:59:59.999Z`),
      },
    };

    if (!this.isAdmin(user)) {
      where.benh_nhan = { nguoi_dung_id: user.id, deleted_at: null };
    }

    // Lean Query Projection: Chỉ lấy đúng các trường cần thiết (Rule 11)
    const intakes = await this.prisma.khau_phan_24h.findMany({
      where,
      select: {
        id: true,
        ngay_an: true,
        benh_nhan: {
          select: {
            id: true,
            ma_benh_nhan_bv: true,
            ho_ten: true,
            gioi_tinh: true,
            ngay_sinh: true,
          },
        },
        khau_phan_24h_bua_an: {
          select: {
            khau_phan_24h_nguyen_lieu: {
              select: {
                khoi_luong_song_sach: true,
                nguyen_lieu: {
                  select: {
                    id: true,
                    ten_nguyen_lieu: true,
                    danh_muc: true,
                    loai_protein: true,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      select: { ten_danh_muc: true },
                    },
                    water: true,
                    protein: true,
                    fat: true,
                    fiber: true,
                    ash: true,
                    calci: true,
                    phosphorous: true,
                    iron: true,
                    zinc: true,
                    sodium: true,
                    potassium: true,
                    magnesium: true,
                    manganese: true,
                    copper: true,
                    selenium: true,
                    vitaminC: true,
                    thiamine: true,
                    riboflavin: true,
                    niacin: true,
                    pantothenicAcid: true,
                    vitaminB6: true,
                    folate: true,
                    folicAcid: true,
                    biotin: true,
                    vitaminB12: true,
                    retinol: true,
                    vitaminD: true,
                    vitaminE: true,
                    vitaminK: true,
                    betaCarotene: true,
                    alphaCarotene: true,
                    betaCryptoxanthin: true,
                    lycopene: true,
                    luteinZeaxanthin: true,
                    isoflavoneTongSo: true,
                    daidzein: true,
                    genistein: true,
                    glycetin: true,
                    purine: true,
                    tsAxitBeoNo: true,
                    palmitic: true,
                    margaric: true,
                    stearic: true,
                    arachidic: true,
                    behenic: true,
                    lignoceric: true,
                    tsAxitBeoKhongNo1NoiDoi: true,
                    myristoleic: true,
                    palmitoleic: true,
                    oleic: true,
                    tsAxitBeoKhongNoNhieuNoiDoi: true,
                    linoleic: true,
                    linolenic: true,
                    arachidonic: true,
                    epa: true,
                    dha: true,
                    tsAxitBeoTrans: true,
                    cholesterol: true,
                    phytosterol: true,
                    lysin: true,
                    methionin: true,
                    tryptophan: true,
                    phenylalanin: true,
                    threonin: true,
                    valine: true,
                    leucine: true,
                    isoleucine: true,
                    arginine: true,
                    histidine: true,
                    cystine: true,
                    tyrosine: true,
                    alanine: true,
                    asparticAcid: true,
                    glutamicAcid: true,
                    glycine: true,
                    proline: true,
                    serine: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { ngay_an: 'asc' },
    });

    if (!intakes || intakes.length === 0) {
      throw new HttpException(
        { code: 'EXPORT_NO_DATA', message: 'Không có dữ liệu khẩu phần trong khoảng thời gian đã chọn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const streamer = new DailyIntakeExcelStreamer(res, {
      sheetName: 'Nhóm thực phẩm 24h',
      freezeHeader: false,
    });

    // Gom cụm theo ngày ăn
    const byDate = new Map<string, typeof intakes>();
    for (const intake of intakes) {
      const dateKey = intake.ngay_an.toISOString().substring(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(intake);
    }

    // Xây dựng danh sách tiêu đề cột chuẩn Java POI
    const tableHeaders: string[] = [
      'Mã BN',
      'Họ tên',
      'Giới tính',
      'Tuổi',
      'Số nhóm TP',
      'Energy (Kcal)',
      'Water (g)',
      'Protein ĐV (g)',
      'Protein TV (g)',
      'Protein ĐV / Tổng',
      'Fat ĐV (g)',
      'Fat TV (g)',
      'Lipid TV / Tổng',
    ];

    for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
      if (['energy', 'water'].includes(col.field)) continue;
      tableHeaders.push(col.header);
    }

    const totalCols = tableHeaders.length;

    // Duyệt từng ngày
    for (const [dateStr, dayIntakes] of byDate.entries()) {
      await streamer.writeDayTitleRow(dateStr, totalCols, 'NGÀY: ');
      await streamer.writeTableHeaderRow(tableHeaders);

      for (const intake of dayIntakes) {
        const patient = intake.benh_nhan;
        const patientCode = patient.ma_benh_nhan_bv || patient.id.toString();
        const patientName = patient.ho_ten;
        const gender = patient.gioi_tinh;
        const age = this.calculateAge(patient.ngay_sinh);

        const distinctCategories = new Set<string>();
        const totalNutrients: Record<string, number> = {};
        let proteinAnimal = 0;
        let proteinPlant = 0;
        let fatAnimal = 0;
        let fatPlant = 0;

        for (const meal of intake.khau_phan_24h_bua_an || []) {
          for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
            const ing = item.nguyen_lieu;
            if (!ing) continue;

            const categoryName =
              ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
            distinctCategories.add(categoryName);

            const rawWeight = Number(item.khoi_luong_song_sach) || 0;
            const ratio = rawWeight / 100;
            const nutrients = this.calculateIngredientNutrients(ing, ratio);

            for (const [k, v] of Object.entries(nutrients)) {
              totalNutrients[k] = (totalNutrients[k] || 0) + v;
            }

            const p = (ing.protein ?? 0) * ratio;
            const f = (ing.fat ?? 0) * ratio;
            if (ing.loai_protein === 'DONG_VAT') {
              proteinAnimal += p;
              fatAnimal += f;
            } else if (ing.loai_protein === 'THUC_VAT') {
              proteinPlant += p;
              fatPlant += f;
            }
          }
        }

        const categoryCount = distinctCategories.size;
        const totalProtein = proteinAnimal + proteinPlant;
        const totalFat = fatAnimal + fatPlant;

        const proteinAnimalRatio =
          totalProtein === 0 ? 0 : Number((proteinAnimal / totalProtein).toFixed(4));
        const lipidPlantRatio =
          totalFat === 0 ? 0 : Number((fatPlant / totalFat).toFixed(4));

        const rowValues: any[] = [
          patientCode,
          patientName,
          gender,
          age,
          categoryCount,
          Number((totalNutrients.energy || 0).toFixed(2)),
          Number((totalNutrients.water || 0).toFixed(2)),
          Number(proteinAnimal.toFixed(2)),
          Number(proteinPlant.toFixed(2)),
          proteinAnimalRatio,
          Number(fatAnimal.toFixed(2)),
          Number(fatPlant.toFixed(2)),
          lipidPlantRatio,
        ];

        for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
          if (['energy', 'water'].includes(col.field)) continue;
          rowValues.push(Number((totalNutrients[col.field] || 0).toFixed(2)));
        }

        await streamer.writeDataRow(rowValues);
      }

      await streamer.writeEmptyRow();
    }

    await streamer.finalize();
  }

  // =========================================================================
  // MẪU 2: AVG_GROUP_WEIGHT_PER_PATIENT
  // Thống kê khối lượng trung bình từng nhóm thực phẩm / đầu người
  // =========================================================================
  async streamAvgGroupWeightPerPatient(
    dto: DailyIntakeExportRequestDto,
    res: Response,
    user: any,
  ): Promise<void> {
    const categories = await this.prisma.danh_muc.findMany({
      select: { id: true, ten_danh_muc: true },
      orderBy: { id: 'asc' },
    });

    const where: any = {
      ngay_an: {
        gte: new Date(`${dto.fromDate}T00:00:00.000Z`),
        lte: new Date(`${dto.toDate}T23:59:59.999Z`),
      },
    };

    if (!this.isAdmin(user)) {
      where.benh_nhan = { nguoi_dung_id: user.id, deleted_at: null };
    }

    const intakes = await this.prisma.khau_phan_24h.findMany({
      where,
      select: {
        id: true,
        ngay_an: true,
        benh_nhan_id: true,
        khau_phan_24h_bua_an: {
          select: {
            khau_phan_24h_nguyen_lieu: {
              select: {
                khoi_luong_song_sach: true,
                nguyen_lieu: {
                  select: {
                    danh_muc: true,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      select: { ten_danh_muc: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { ngay_an: 'asc' },
    });

    if (!intakes || intakes.length === 0) {
      throw new HttpException(
        { code: 'EXPORT_NO_DATA', message: 'Không có dữ liệu khẩu phần trong khoảng thời gian đã chọn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const streamer = new DailyIntakeExcelStreamer(res, {
      sheetName: 'Khoi_luong_tb_theo_dau_nguoi',
      freezeHeader: false,
    });

    const byDate = new Map<string, typeof intakes>();
    for (const intake of intakes) {
      const dateKey = intake.ngay_an.toISOString().substring(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(intake);
    }

    for (const [dateStr, dayIntakes] of byDate.entries()) {
      // Đếm số bệnh nhân duy nhất trong ngày
      const patientIds = new Set(dayIntakes.map((i) => i.benh_nhan_id.toString()));
      const patientCount = patientIds.size;

      // Tính tổng khối lượng theo nhóm thực phẩm
      const totalWeightByCategory = new Map<string, number>();

      for (const intake of dayIntakes) {
        for (const meal of intake.khau_phan_24h_bua_an || []) {
          for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
            const ing = item.nguyen_lieu;
            if (!ing) continue;
            const categoryName =
              ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
            const weight = Number(item.khoi_luong_song_sach) || 0;
            totalWeightByCategory.set(
              categoryName,
              (totalWeightByCategory.get(categoryName) || 0) + weight,
            );
          }
        }
      }

      await streamer.writeDayTitleRow(dateStr, 4, 'Ngày: ');

      const headerAvgCol = `Khối lượng trung bình / đầu người (${patientCount} bệnh nhân)`;
      await streamer.writeTableHeaderRow([
        'STT',
        'Nhóm thực phẩm',
        'Khối lượng tổng (gram)',
        headerAvgCol,
      ]);

      let order = 1;
      for (const c of categories) {
        const catName = c.ten_danh_muc;
        const totalWeight = totalWeightByCategory.get(catName) || 0;
        const avgWeight = patientCount === 0 ? 0 : Number((totalWeight / patientCount).toFixed(2));

        await streamer.writeDataRow([
          order++,
          catName,
          Number(totalWeight.toFixed(2)),
          avgWeight,
        ]);
      }

      await streamer.writeEmptyRow();
    }

    await streamer.finalize();
  }

  // =========================================================================
  // MẪU 3: DAILY_NUTRIENT_INTAKE_PATIENT
  // Báo cáo khẩu phần chi tiết cá nhân theo dải ngày (phân rã từng bữa & dòng TỔNG NGÀY)
  // =========================================================================
  async streamPatientDailyNutrition(
    dto: DailyIntakeExportRequestDto,
    res: Response,
    user: any,
  ): Promise<void> {
    const patientWhere: any = {
      id: BigInt(dto.patientId!),
      deleted_at: null,
    };

    if (!this.isAdmin(user)) {
      patientWhere.nguoi_dung_id = user.id;
    }

    const patient = await this.prisma.benh_nhan.findFirst({
      where: patientWhere,
      select: {
        id: true,
        ma_benh_nhan_bv: true,
        ho_ten: true,
        gioi_tinh: true,
        ngay_sinh: true,
      },
    });

    if (!patient) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy thông tin bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    const isByMeal = !dto.mode || dto.mode.toUpperCase().includes('MEAL');

    const intakes = await this.prisma.khau_phan_24h.findMany({
      where: {
        benh_nhan_id: patient.id,
        ngay_an: {
          gte: new Date(`${dto.fromDate}T00:00:00.000Z`),
          lte: new Date(`${dto.toDate}T23:59:59.999Z`),
        },
      },
      select: {
        id: true,
        ngay_an: true,
        kieu_nhap: true,
        khau_phan_24h_bua_an: {
          orderBy: { thu_tu_bua: 'asc' },
          select: {
            id: true,
            thu_tu_bua: true,
            ten_bua: true,
            khau_phan_24h_nguyen_lieu: {
              select: {
                id: true,
                khoi_luong_song_sach: true,
                nguyen_lieu: {
                  select: {
                    id: true,
                    ten_nguyen_lieu: true,
                    danh_muc: true,
                    loai_protein: true,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      select: { ten_danh_muc: true },
                    },
                    water: true,
                    protein: true,
                    fat: true,
                    fiber: true,
                    ash: true,
                    calci: true,
                    phosphorous: true,
                    iron: true,
                    zinc: true,
                    sodium: true,
                    potassium: true,
                    magnesium: true,
                    manganese: true,
                    copper: true,
                    selenium: true,
                    vitaminC: true,
                    thiamine: true,
                    riboflavin: true,
                    niacin: true,
                    pantothenicAcid: true,
                    vitaminB6: true,
                    folate: true,
                    folicAcid: true,
                    biotin: true,
                    vitaminB12: true,
                    retinol: true,
                    vitaminD: true,
                    vitaminE: true,
                    vitaminK: true,
                    betaCarotene: true,
                    alphaCarotene: true,
                    betaCryptoxanthin: true,
                    lycopene: true,
                    luteinZeaxanthin: true,
                    isoflavoneTongSo: true,
                    daidzein: true,
                    genistein: true,
                    glycetin: true,
                    purine: true,
                    tsAxitBeoNo: true,
                    palmitic: true,
                    margaric: true,
                    stearic: true,
                    arachidic: true,
                    behenic: true,
                    lignoceric: true,
                    tsAxitBeoKhongNo1NoiDoi: true,
                    myristoleic: true,
                    palmitoleic: true,
                    oleic: true,
                    tsAxitBeoKhongNoNhieuNoiDoi: true,
                    linoleic: true,
                    linolenic: true,
                    arachidonic: true,
                    epa: true,
                    dha: true,
                    tsAxitBeoTrans: true,
                    cholesterol: true,
                    phytosterol: true,
                    lysin: true,
                    methionin: true,
                    tryptophan: true,
                    phenylalanin: true,
                    threonin: true,
                    valine: true,
                    leucine: true,
                    isoleucine: true,
                    arginine: true,
                    histidine: true,
                    cystine: true,
                    tyrosine: true,
                    alanine: true,
                    asparticAcid: true,
                    glutamicAcid: true,
                    glycine: true,
                    proline: true,
                    serine: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { ngay_an: 'asc' },
    });

    if (!intakes || intakes.length === 0) {
      throw new HttpException(
        { code: 'EXPORT_NO_DATA', message: 'Không có dữ liệu khẩu phần trong khoảng thời gian đã chọn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const streamer = new DailyIntakeExcelStreamer(res, {
      sheetName: 'DINH_DUONG_24H',
      freezeHeader: false,
    });

    const age = this.calculateAge(patient.ngay_sinh);
    await streamer.writePatientHeaderBlock(
      { ...patient, age },
      dto.fromDate,
      dto.toDate,
    );

    const tableHeaders: string[] = [
      'Nguyên liệu',
      'Nhóm thực phẩm ',
      'Khối lượng (g)',
      'Energy (Kcal)',
      'Water (g)',
      'Protein ĐV (g)',
      'Protein TV (g)',
      'Fat ĐV (g)',
      'Fat TV (g)',
      'Lipid thực vật / Lipid tổng số',
    ];

    for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
      if (['energy', 'water'].includes(col.field)) continue;
      tableHeaders.push(col.header);
    }

    const totalCols = tableHeaders.length;

    // Duyệt từng ngày
    for (const intake of intakes) {
      const dateStr = intake.ngay_an.toISOString().substring(0, 10);
      await streamer.writeDayTitleRow(dateStr, totalCols, 'Ngày ăn: ');
      await streamer.writeTableHeaderRow(tableHeaders);

      const dayNutrients: Record<string, number> = {};
      let dayProteinAnimal = 0;
      let dayProteinPlant = 0;
      let dayFatAnimal = 0;
      let dayFatPlant = 0;

      if (isByMeal) {
        // Xuất phân rã theo bữa ăn
        for (const meal of intake.khau_phan_24h_bua_an || []) {
          const mealNutrients: Record<string, number> = {};
          let mealProteinAnimal = 0;
          let mealProteinPlant = 0;
          let mealFatAnimal = 0;
          let mealFatPlant = 0;

          for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
            const ing = item.nguyen_lieu;
            if (!ing) continue;

            const categoryName =
              ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
            const rawWeight = Number(item.khoi_luong_song_sach) || 0;
            const ratio = rawWeight / 100;
            const nutrients = this.calculateIngredientNutrients(ing, ratio);

            let itemProteinAnimal = 0;
            let itemProteinPlant = 0;
            let itemFatAnimal = 0;
            let itemFatPlant = 0;

            const p = (ing.protein ?? 0) * ratio;
            const f = (ing.fat ?? 0) * ratio;
            if (ing.loai_protein === 'DONG_VAT') {
              itemProteinAnimal = p;
              itemFatAnimal = f;
            } else if (ing.loai_protein === 'THUC_VAT') {
              itemProteinPlant = p;
              itemFatPlant = f;
            }

            const itemLipidTotal = itemFatAnimal + itemFatPlant;
            const itemLipidPlantRatio =
              itemLipidTotal === 0 ? 0 : Number((itemFatPlant / itemLipidTotal).toFixed(4));

            // Cộng dồn vào bữa và ngày
            mealProteinAnimal += itemProteinAnimal;
            mealProteinPlant += itemProteinPlant;
            mealFatAnimal += itemFatAnimal;
            mealFatPlant += itemFatPlant;

            dayProteinAnimal += itemProteinAnimal;
            dayProteinPlant += itemProteinPlant;
            dayFatAnimal += itemFatAnimal;
            dayFatPlant += itemFatPlant;

            for (const [k, v] of Object.entries(nutrients)) {
              mealNutrients[k] = (mealNutrients[k] || 0) + v;
              dayNutrients[k] = (dayNutrients[k] || 0) + v;
            }

            const rowValues: any[] = [
              ing.ten_nguyen_lieu,
              categoryName,
              rawWeight,
              nutrients.energy || 0,
              nutrients.water || 0,
              Number(itemProteinAnimal.toFixed(2)),
              Number(itemProteinPlant.toFixed(2)),
              Number(itemFatAnimal.toFixed(2)),
              Number(itemFatPlant.toFixed(2)),
              itemLipidPlantRatio,
            ];

            for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
              if (['energy', 'water'].includes(col.field)) continue;
              rowValues.push(nutrients[col.field] || 0);
            }

            await streamer.writeDataRow(rowValues);
          }

          // Dòng TỔNG BỮA
          const mealLipidTotal = mealFatAnimal + mealFatPlant;
          const mealLipidPlantRatio =
            mealLipidTotal === 0 ? 0 : Number((mealFatPlant / mealLipidTotal).toFixed(4));

          const mealTotalValues: any[] = [
            Number((mealNutrients.energy || 0).toFixed(2)),
            Number((mealNutrients.water || 0).toFixed(2)),
            Number(mealProteinAnimal.toFixed(2)),
            Number(mealProteinPlant.toFixed(2)),
            Number(mealFatAnimal.toFixed(2)),
            Number(mealFatPlant.toFixed(2)),
            mealLipidPlantRatio,
          ];

          for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
            if (['energy', 'water'].includes(col.field)) continue;
            mealTotalValues.push(Number((mealNutrients[col.field] || 0).toFixed(2)));
          }

          await streamer.writeMealTotalRow(meal.ten_bua || `Bữa ${meal.thu_tu_bua}`, mealTotalValues);
        }
      } else {
        // Xuất không chia bữa (INGREDIENT_ONLY)
        for (const meal of intake.khau_phan_24h_bua_an || []) {
          for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
            const ing = item.nguyen_lieu;
            if (!ing) continue;

            const categoryName =
              ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
            const rawWeight = Number(item.khoi_luong_song_sach) || 0;
            const ratio = rawWeight / 100;
            const nutrients = this.calculateIngredientNutrients(ing, ratio);

            let itemProteinAnimal = 0;
            let itemProteinPlant = 0;
            let itemFatAnimal = 0;
            let itemFatPlant = 0;

            const p = (ing.protein ?? 0) * ratio;
            const f = (ing.fat ?? 0) * ratio;
            if (ing.loai_protein === 'DONG_VAT') {
              itemProteinAnimal = p;
              itemFatAnimal = f;
            } else if (ing.loai_protein === 'THUC_VAT') {
              itemProteinPlant = p;
              itemFatPlant = f;
            }

            const itemLipidTotal = itemFatAnimal + itemFatPlant;
            const itemLipidPlantRatio =
              itemLipidTotal === 0 ? 0 : Number((itemFatPlant / itemLipidTotal).toFixed(4));

            dayProteinAnimal += itemProteinAnimal;
            dayProteinPlant += itemProteinPlant;
            dayFatAnimal += itemFatAnimal;
            dayFatPlant += itemFatPlant;

            for (const [k, v] of Object.entries(nutrients)) {
              dayNutrients[k] = (dayNutrients[k] || 0) + v;
            }

            const rowValues: any[] = [
              ing.ten_nguyen_lieu,
              categoryName,
              rawWeight,
              nutrients.energy || 0,
              nutrients.water || 0,
              Number(itemProteinAnimal.toFixed(2)),
              Number(itemProteinPlant.toFixed(2)),
              Number(itemFatAnimal.toFixed(2)),
              Number(itemFatPlant.toFixed(2)),
              itemLipidPlantRatio,
            ];

            for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
              if (['energy', 'water'].includes(col.field)) continue;
              rowValues.push(nutrients[col.field] || 0);
            }

            await streamer.writeDataRow(rowValues);
          }
        }
      }

      // Dòng TỔNG NGÀY
      const dayLipidTotal = dayFatAnimal + dayFatPlant;
      const dayLipidPlantRatio =
        dayLipidTotal === 0 ? 0 : Number((dayFatPlant / dayLipidTotal).toFixed(4));

      const dayTotalValues: any[] = [
        Number((dayNutrients.energy || 0).toFixed(2)),
        Number((dayNutrients.water || 0).toFixed(2)),
        Number(dayProteinAnimal.toFixed(2)),
        Number(dayProteinPlant.toFixed(2)),
        Number(dayFatAnimal.toFixed(2)),
        Number(dayFatPlant.toFixed(2)),
        dayLipidPlantRatio,
      ];

      for (const col of DAILY_INTAKE_EXPORT_COLUMNS) {
        if (['energy', 'water'].includes(col.field)) continue;
        dayTotalValues.push(Number((dayNutrients[col.field] || 0).toFixed(2)));
      }

      await streamer.writeDayTotalRow(dayTotalValues);
      await streamer.writeEmptyRow();
    }

    await streamer.finalize();
  }

  // =========================================================================
  // MẪU 4: TOTAL_WEIGHT_FOOD_GROUP_MULTI_PATIENTS
  // Xuất 2 Sheets: TONG_KL_NHOM_THUC_PHAM (ma trận BN x nhóm TP) và TRUNG_BINH (TB/ngày)
  // =========================================================================
  async streamTotalWeightFoodGroupMultiPatients(
    dto: DailyIntakeExportRequestDto,
    res: Response,
    user: any,
  ): Promise<void> {
    const categories = await this.prisma.danh_muc.findMany({
      select: { id: true, ten_danh_muc: true },
      orderBy: { id: 'asc' },
    });

    const categoryNames = categories.map((c) => c.ten_danh_muc);

    const where: any = {
      ngay_an: {
        gte: new Date(`${dto.fromDate}T00:00:00.000Z`),
        lte: new Date(`${dto.toDate}T23:59:59.999Z`),
      },
    };

    if (!this.isAdmin(user)) {
      where.benh_nhan = { nguoi_dung_id: user.id, deleted_at: null };
    }

    const intakes = await this.prisma.khau_phan_24h.findMany({
      where,
      select: {
        id: true,
        ngay_an: true,
        benh_nhan: {
          select: {
            id: true,
            ma_benh_nhan_bv: true,
            ho_ten: true,
            gioi_tinh: true,
            ngay_sinh: true,
          },
        },
        khau_phan_24h_bua_an: {
          select: {
            khau_phan_24h_nguyen_lieu: {
              select: {
                khoi_luong_song_sach: true,
                nguyen_lieu: {
                  select: {
                    danh_muc: true,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      select: { ten_danh_muc: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { ngay_an: 'asc' },
    });

    if (!intakes || intakes.length === 0) {
      throw new HttpException(
        { code: 'EXPORT_NO_DATA', message: 'Không có dữ liệu khẩu phần trong khoảng thời gian đã chọn' },
        HttpStatus.NOT_FOUND,
      );
    }

    const streamer = new DailyIntakeExcelStreamer(res, {
      sheetName: 'TONG_KL_NHOM_THUC_PHAM',
      freezeHeader: false,
    });

    // Gom cụm theo ngày ăn
    const byDate = new Map<string, typeof intakes>();
    for (const intake of intakes) {
      const dateKey = intake.ngay_an.toISOString().substring(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(intake);
    }

    // ====== SHEET 1: TONG_KL_NHOM_THUC_PHAM ======
    const sheet1Headers: string[] = [
      'STT',
      'Mã BN',
      'Họ tên bệnh nhân',
      'Giới tính',
      'Tuổi',
      ...categoryNames.map((cat) => `${cat} (g)`),
    ];
    const totalCols = sheet1Headers.length;

    for (const [dateStr, dayIntakes] of byDate.entries()) {
      await streamer.writeDayTitleRow(dateStr, totalCols, 'Ngày ăn: ');
      await streamer.writeTableHeaderRow(sheet1Headers);

      let stt = 1;
      for (const intake of dayIntakes) {
        const patient = intake.benh_nhan;
        const patientCode = patient.ma_benh_nhan_bv || patient.id.toString();
        const patientName = patient.ho_ten;
        const gender = patient.gioi_tinh;
        const age = this.calculateAge(patient.ngay_sinh);

        const groupWeights = new Map<string, number>();

        for (const meal of intake.khau_phan_24h_bua_an || []) {
          for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
            const ing = item.nguyen_lieu;
            if (!ing) continue;
            const categoryName =
              ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
            const weight = Number(item.khoi_luong_song_sach) || 0;
            groupWeights.set(categoryName, (groupWeights.get(categoryName) || 0) + weight);
          }
        }

        const rowValues: any[] = [
          stt++,
          patientCode,
          patientName,
          gender,
          age,
          ...categoryNames.map((cat) => Number((groupWeights.get(cat) || 0).toFixed(2))),
        ];

        await streamer.writeDataRow(rowValues);
      }

      await streamer.writeEmptyRow();
    }

    // ====== SHEET 2: TRUNG_BINH ======
    await streamer.addWorksheet('TRUNG_BINH', { freezeHeader: false });

    const sheet2Headers: string[] = [
      'STT',
      'Mã BN',
      'Họ tên bệnh nhân',
      'Giới tính',
      'Tuổi',
      'Số ngày',
      ...categoryNames.map((cat) => `${cat} TB (g)`),
    ];

    await streamer.writeTableHeaderRow(sheet2Headers);

    // Gom dữ liệu theo bệnh nhân trên toàn bộ dải ngày
    const byPatient = new Map<
      string,
      {
        patient: (typeof intakes)[0]['benh_nhan'];
        days: Set<string>;
        categoryTotals: Map<string, number>;
      }
    >();

    for (const intake of intakes) {
      const patientId = intake.benh_nhan.id.toString();
      const dateKey = intake.ngay_an.toISOString().substring(0, 10);

      if (!byPatient.has(patientId)) {
        byPatient.set(patientId, {
          patient: intake.benh_nhan,
          days: new Set<string>(),
          categoryTotals: new Map<string, number>(),
        });
      }

      const entry = byPatient.get(patientId)!;
      entry.days.add(dateKey);

      for (const meal of intake.khau_phan_24h_bua_an || []) {
        for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
          const ing = item.nguyen_lieu;
          if (!ing) continue;
          const categoryName =
            ing.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || 'Chưa phân loại';
          const weight = Number(item.khoi_luong_song_sach) || 0;
          entry.categoryTotals.set(
            categoryName,
            (entry.categoryTotals.get(categoryName) || 0) + weight,
          );
        }
      }
    }

    let pIndex = 1;
    for (const entry of byPatient.values()) {
      const patient = entry.patient;
      const patientCode = patient.ma_benh_nhan_bv || patient.id.toString();
      const patientName = patient.ho_ten;
      const gender = patient.gioi_tinh;
      const age = this.calculateAge(patient.ngay_sinh);
      const dayCount = entry.days.size;

      const avgWeights = categoryNames.map((cat) => {
        const total = entry.categoryTotals.get(cat) || 0;
        return dayCount === 0 ? 0 : Number((total / dayCount).toFixed(2));
      });

      const rowValues: any[] = [
        pIndex++,
        patientCode,
        patientName,
        gender,
        age,
        dayCount,
        ...avgWeights,
      ];

      await streamer.writeDataRow(rowValues);
    }

    await streamer.finalize();
  }
}
