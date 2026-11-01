import { Response } from 'express';
import { Writable } from 'stream';
import {
  BaseExcelStreamer,
  ExcelColumnDefinition,
} from '../../../core/excel-engine/base-excel.streamer';
import { ExcelSecurityUtil } from '../../../security/excel/excel-security.util';
import { EXCEL_FONT_FAMILY, EXCEL_STYLES } from '../../../config/constants/excel.constants';

export interface MarketPlanIngredient {
  id?: bigint | number | string | null;
  name: string;
  categoryId: number;
  categoryName: string;
  edible: number;
  netWeight1: number; // g / 1 suất
  rawWeight1: number; // g / 1 suất
  lossPercent: number; // %
  lossWeight1: number; // g / 1 suất
  cookedWeight1?: number; // g / 1 suất
  notes?: string;
}

export interface MarketPlanMenuContext {
  id: bigint | number | string;
  menuName: string;
  menuType?: string;
  servings: number;
  cycleText: string;
  createdDate?: string;
  patient?: {
    fullName?: string;
    patientCode?: string;
    gender?: string;
    age?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    tdee?: number;
  };
  diseaseGroupName?: string;
  energyKcal?: number;
  proteinGrams?: number;
  lipidGrams?: number;
  glucidGrams?: number;
  pRatio?: number;
  lRatio?: number;
  gRatio?: number;
}

export class StreamMarketPlanParamDto {
  context: MarketPlanMenuContext;
  ingredients: MarketPlanIngredient[];
}

/**
 * 14 nhóm thực phẩm chuẩn Viện Dinh Dưỡng Quốc Gia (NIN) / Bộ Y Tế Việt Nam
 */
export const MOH_14_FOOD_GROUPS: Record<number, string> = {
  1: 'Ngũ cốc và sản phẩm chế biến',
  2: 'Khoai củ và sản phẩm chế biến',
  3: 'Hạt, quả giàu đạm, béo và sản phẩm chế biến',
  4: 'Rau, quả, củ dùng làm rau',
  5: 'Quả chín (Trái cây)',
  6: 'Dầu, mỡ, bơ (Chất béo thực phẩm)',
  7: 'Thịt và sản phẩm chế biến',
  8: 'Thủy sản và sản phẩm chế biến',
  9: 'Trứng và sản phẩm chế biến',
  10: 'Sữa và sản phẩm chế biến',
  11: 'Đồ hộp và thực phẩm chế biến sẵn',
  12: 'Đồ ngọt (đường, bánh, mứt, kẹo)',
  13: 'Gia vị, nước chấm',
  14: 'Nước giải khát, đồ uống',
  15: 'Thực phẩm truyền thống / Nhóm khác',
};

/**
 * MenuMarketPlanStreamer
 * Xuất kế hoạch đi chợ chuẩn Bộ Y Tế dạng Stream O(1) RAM (< 35MB)
 * Tuân thủ Task 6.3 [T9.3] & Pillar III Anti-OOM
 */
export class MenuMarketPlanStreamer extends BaseExcelStreamer {
  private static readonly TOTAL_COLS = 11;

  constructor(outputStream: Response | Writable) {
    super(outputStream, {
      sheetName: 'KE_HOACH_DI_CHO',
      freezeHeader: false, // Sẽ thiết lập freeze tại dòng tiêu đề bảng sau metadata
    });
  }

  /**
   * Stream toàn bộ bảng kế hoạch đi chợ
   */
  public async streamMarketPlan(
    paramOrContext: StreamMarketPlanParamDto | MarketPlanMenuContext,
    legacyIngredients?: MarketPlanIngredient[],
  ): Promise<void> {
    let context: MarketPlanMenuContext;
    let ingredients: MarketPlanIngredient[];

    if (
      paramOrContext &&
      typeof paramOrContext === 'object' &&
      'context' in paramOrContext &&
      'ingredients' in paramOrContext
    ) {
      context = paramOrContext.context;
      ingredients = paramOrContext.ingredients;
    } else {
      context = paramOrContext as MarketPlanMenuContext;
      ingredients = legacyIngredients || [];
    }

    const servings = context.servings > 0 ? context.servings : 1;

    // 1. Tiêu đề lớn báo cáo (Merge 11 cột)
    this.addMarketPlanTitle(context);

    // 2. Khối thông tin thực đơn & bệnh nhân & P:L:G
    this.addMenuInfoBlock(context);

    // 3. Dòng tiêu đề bảng nguyên liệu
    this.addTableHeaders(servings);

    // 4. Nhóm nguyên liệu theo 14 nhóm thực phẩm Bộ Y Tế
    const groupedMap = this.groupByMohFoodGroups(ingredients);

    let globalStt = 1;
    let grandNet1 = 0;
    let grandLossN = 0;
    let grandRaw1 = 0;
    let grandRawN = 0;

    let groupRomanIdx = 1;
    const sortedGroupIds = Array.from(groupedMap.keys()).sort((a, b) => a - b);

    for (const groupId of sortedGroupIds) {
      const items = groupedMap.get(groupId)!;
      if (!items || items.length === 0) continue;

      const groupName = MOH_14_FOOD_GROUPS[groupId] || `Nhóm thực phẩm #${groupId}`;
      const romanNumeral = this.toRoman(groupRomanIdx++);

      // 4.1 Section header cho nhóm
      this.addSectionHeader(
        `${romanNumeral}. NHÓM ${groupId}: ${groupName.toUpperCase()} (${items.length} nguyên liệu)`,
        {
          spanCols: MenuMarketPlanStreamer.TOTAL_COLS,
          bgColor: 'FF2E7D32', // Xanh lá cây tươi chuẩn thực phẩm sạch
          textColor: 'FFFFFFFF',
          height: 24,
        },
      );

      let groupNet1 = 0;
      let groupLossN = 0;
      let groupRaw1 = 0;
      let groupRawN = 0;

      // 4.2 Từng dòng nguyên liệu trong nhóm
      for (const item of items) {
        const net1 = this.round2(item.netWeight1);
        const edible = Math.min(100, Math.max(1, this.round2(item.edible || 100)));
        // W_thô = W_sạch / (edible / 100) * servings
        const raw1 = edible > 0 ? this.round2(net1 / (edible / 100)) : net1;
        const rawN = this.round2(raw1 * servings);
        const lossPct = this.round2(100 - edible);
        const lossN = this.round2((raw1 - net1) * servings);
        const rawKgN = this.round3(rawN / 1000);

        groupNet1 += net1;
        groupLossN += lossN;
        groupRaw1 += raw1;
        groupRawN += rawN;

        const rowValues = [
          globalStt++,
          item.name,
          groupName,
          edible,
          net1,
          lossPct,
          lossN,
          raw1,
          rawN,
          rawKgN,
          item.notes || '',
        ];

        await this.addIngredientRow(rowValues);
      }

      grandNet1 += groupNet1;
      grandLossN += groupLossN;
      grandRaw1 += groupRaw1;
      grandRawN += groupRawN;

      // 4.3 Dòng tổng phụ nhóm (Subtotal)
      await this.addGroupSubtotalRow(
        `TỔNG NHÓM ${groupId} (${groupName})`,
        groupNet1,
        groupLossN,
        groupRaw1,
        groupRawN,
        servings,
      );
    }

    // 5. Dòng TỔNG CỘNG TOÀN BỘ KẾ HOẠCH ĐI CHỢ (Grand Total)
    await this.addGrandTotalRow(grandNet1, grandLossN, grandRaw1, grandRawN, servings);

    // 6. Hoàn tất stream
    await this.finalize();
  }

  // ==========================================
  // CÁC HÀM XÂY DỰNG DÒNG DỮ LIỆU STREAMING
  // ==========================================

  private addMarketPlanTitle(context: MarketPlanMenuContext): void {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.getCell(1).value = `BẢNG KẾ HOẠCH NGUYÊN LIỆU ĐI CHỢ (${context.servings} SUẤT ĂN)`;
    row.font = { name: EXCEL_FONT_FAMILY, size: 14, bold: true, color: { argb: 'FF1F497D' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 32;
    this.worksheet.mergeCells(r, 1, r, MenuMarketPlanStreamer.TOTAL_COLS);
    row.commit();
    this.rowCount++;

    // Subtitle
    const subR = this.rowCount + 1;
    const subRow = this.worksheet.getRow(subR);
    const dateStr = context.createdDate || new Date().toLocaleDateString('vi-VN');
    subRow.getCell(1).value =
      `Thực đơn: ${context.menuName} | Chu kỳ: ${context.cycleText} | Ngày lập: ${dateStr}`;
    subRow.font = { name: EXCEL_FONT_FAMILY, size: 10, italic: true, color: { argb: 'FF555555' } };
    subRow.alignment = { vertical: 'middle', horizontal: 'center' };
    subRow.height = 20;
    this.worksheet.mergeCells(subR, 1, subR, MenuMarketPlanStreamer.TOTAL_COLS);
    subRow.commit();
    this.rowCount++;

    // Dòng trống
    this.addBlankRow();
  }

  private addMenuInfoBlock(context: MarketPlanMenuContext): void {
    // Thông tin bệnh nhân & nhóm bệnh
    if (context.patient) {
      const p = context.patient;
      const patientInfo = `Bệnh nhân: ${p.fullName || 'N/A'} (Mã: ${p.patientCode || 'N/A'}) | Giới tính: ${p.gender || 'N/A'} | Tuổi: ${p.age || 'N/A'}`;
      this.addInfoRow(patientInfo, 'FF1F497D');

      if (p.bmi || p.tdee) {
        const tdeeText = p.tdee ? `${p.tdee} kcal/ngày` : 'N/A';
        const anthropometry = `Chỉ số nhân trắc: BMI: ${p.bmi || 'N/A'} | Nhu cầu năng lượng ước tính (TDEE): ${tdeeText}`;
        this.addInfoRow(anthropometry, 'FF333333');
      }
    }

    if (context.diseaseGroupName) {
      this.addInfoRow(`Nhóm bệnh áp dụng: ${context.diseaseGroupName}`, 'FF1F497D');
    }

    // Khối năng lượng & Tỷ lệ P:L:G (13-20% : 20-25% : 55-65%)
    if (context.energyKcal !== undefined && context.energyKcal > 0) {
      const p = context.pRatio !== undefined ? `${context.pRatio}%` : 'N/A';
      const l = context.lRatio !== undefined ? `${context.lRatio}%` : 'N/A';
      const g = context.gRatio !== undefined ? `${context.gRatio}%` : 'N/A';
      const plgInfo = `Năng lượng: ${context.energyKcal} kcal/suất | Tỷ lệ P:L:G: ${p} : ${l} : ${g} (Chuẩn BYT: 13-20% : 20-25% : 55-65%)`;
      this.addInfoRow(plgInfo, 'FF0D47A1', true);
    }

    this.addBlankRow();
  }

  private addInfoRow(text: string, colorArgb: string, isBold = false): void {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.getCell(1).value = ExcelSecurityUtil.sanitizeCellValue(text);
    row.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: isBold, color: { argb: colorArgb } };
    row.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    row.height = 20;
    this.worksheet.mergeCells(r, 1, r, MenuMarketPlanStreamer.TOTAL_COLS);
    row.commit();
    this.rowCount++;
  }

  private addBlankRow(): void {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.height = 8;
    row.commit();
    this.rowCount++;
  }

  private addTableHeaders(servings: number): void {
    const headers: ExcelColumnDefinition[] = [
      { header: 'STT', key: 'stt', width: 7 },
      { header: 'Tên nguyên liệu thực phẩm', key: 'name', width: 36 },
      { header: 'Nhóm thực phẩm (Bộ Y Tế)', key: 'group', width: 30 },
      { header: 'Ăn được (%)', key: 'edible', width: 14 },
      { header: 'Sống sạch 1 suất (g)', key: 'net1', width: 18 },
      { header: 'Hao hụt sơ chế (%)', key: 'lossPct', width: 18 },
      { header: `Hao hụt mua ${servings} suất (g)`, key: 'lossN', width: 22 },
      { header: 'Sống thô 1 suất (g)', key: 'raw1', width: 18 },
      { header: `Tổng mua ${servings} suất (g)`, key: 'rawN', width: 22 },
      { header: `Tổng mua ${servings} suất (kg)`, key: 'rawKgN', width: 22 },
      { header: 'Ghi chú / Chế biến', key: 'notes', width: 24 },
    ];

    this.setHeaders(headers, {
      height: 28,
      bgColor: 'FF1F497D', // Navy chuẩn y tế
      textColor: 'FFFFFFFF',
    });
  }

  private async addIngredientRow(values: any[]): Promise<void> {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.height = 20;

    const sanitized = ExcelSecurityUtil.sanitizeRow(values);
    for (let c = 1; c <= values.length; c++) {
      const cell = row.getCell(c);
      cell.value = sanitized[c - 1];
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10 };

      // Căn lề
      if (c === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (c === 2 || c === 3 || c === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (c === 10) {
          cell.numFmt = '#,##0.000';
        } else if (c >= 4 && c <= 9) {
          cell.numFmt = '#,##0.0';
        }
      }

      cell.border = {
        top: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        bottom: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        left: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
        right: { style: 'thin', color: { argb: EXCEL_STYLES.COLORS.BORDER_LIGHT } },
      };
    }

    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  private async addGroupSubtotalRow(
    title: string,
    net1: number,
    lossN: number,
    raw1: number,
    rawN: number,
    _servings: number,
  ): Promise<void> {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.height = 22;

    row.getCell(1).value = ExcelSecurityUtil.sanitizeCellValue(title);
    row.getCell(5).value = this.round2(net1);
    row.getCell(7).value = this.round2(lossN);
    row.getCell(8).value = this.round2(raw1);
    row.getCell(9).value = this.round2(rawN);
    row.getCell(10).value = this.round3(rawN / 1000);

    for (let c = 1; c <= MenuMarketPlanStreamer.TOTAL_COLS; c++) {
      const cell = row.getCell(c);
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1B5E20' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }, // Light green
      };
      if (c >= 4 && c <= 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (c === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF81C784' } },
        bottom: { style: 'thin', color: { argb: 'FF81C784' } },
      };
    }

    this.worksheet.mergeCells(r, 1, r, 4);
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  private async addGrandTotalRow(
    net1: number,
    lossN: number,
    raw1: number,
    rawN: number,
    servings: number,
  ): Promise<void> {
    const r = this.rowCount + 1;
    const row = this.worksheet.getRow(r);
    row.height = 26;

    row.getCell(1).value = `TỔNG CỘNG TOÀN BỘ KẾ HOẠCH ĐI CHỢ (${servings} SUẤT ĂN)`;
    row.getCell(5).value = this.round2(net1);
    row.getCell(7).value = this.round2(lossN);
    row.getCell(8).value = this.round2(raw1);
    row.getCell(9).value = this.round2(rawN);
    row.getCell(10).value = this.round3(rawN / 1000);

    for (let c = 1; c <= MenuMarketPlanStreamer.TOTAL_COLS; c++) {
      const cell = row.getCell(c);
      cell.font = { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1F497D' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F0FE' }, // Soft blue
      };
      if (c >= 4 && c <= 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (c === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F497D' } },
        bottom: { style: 'double', color: { argb: 'FF1F497D' } },
      };
    }

    this.worksheet.mergeCells(r, 1, r, 4);
    row.commit();
    this.rowCount++;
    await this.handleBackpressure();
  }

  private groupByMohFoodGroups(
    ingredients: MarketPlanIngredient[],
  ): Map<number, MarketPlanIngredient[]> {
    const map = new Map<number, MarketPlanIngredient[]>();

    for (const item of ingredients) {
      // Chuẩn hóa category ID: nếu không nằm trong 1..14 thì đưa vào nhóm 15
      let catId = Number(item.categoryId);
      if (isNaN(catId) || catId < 1 || catId > 15) {
        catId = 15;
      }

      if (!map.has(catId)) {
        map.set(catId, []);
      }
      map.get(catId)!.push(item);
    }

    // Sắp xếp các nguyên liệu trong từng nhóm theo tên
    for (const items of map.values()) {
      items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }

    return map;
  }

  private toRoman(num: number): string {
    const lookup: Record<string, number> = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1,
    };
    let roman = '';
    for (const i in lookup) {
      while (num >= lookup[i]) {
        roman += i;
        num -= lookup[i];
      }
    }
    return roman || 'I';
  }

  private round2(val: number): number {
    return Math.round((Number(val) || 0) * 100) / 100;
  }

  private round3(val: number): number {
    return Math.round((Number(val) || 0) * 1000) / 1000;
  }
}
