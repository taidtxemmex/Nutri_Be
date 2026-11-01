import Decimal from 'decimal.js';
import {
  AllIndicatorCode,
  NUTRIENT_METADATA_MAP,
} from '../../../core/nutrition-engine/nutrition.constants';
import { DecimalMap, RoundedNutrientMap } from '../../../core/nutrition-engine/nutrition.engine';
import { DemographicProfile, getStandardRdaTargetMap, RdaTargetMap } from './rda-reference-data';

// Cấu hình Decimal chuẩn độ chính xác cao
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export enum RdaComplianceStatus {
  SEVERE_DEFICIENCY = 'SEVERE_DEFICIENCY', // Thiếu trầm trọng (< 70%)
  DEFICIENCY = 'DEFICIENCY', // Thiếu (70% - 89.9%)
  ADEQUATE = 'ADEQUATE', // Đạt (90% - 110%)
  EXCESS = 'EXCESS', // Vượt (111% - 130% hoặc <= 150%)
  WARNING_TOXIC_OR_UL_EXCEEDED = 'WARNING_TOXIC_OR_UL_EXCEEDED', // Nguy cơ ngộ độc / Vượt ngưỡng an toàn UL (>UL hoặc >150%)
}

export type ClinicalAlertLevel = 'NORMAL' | 'WARNING' | 'DANGER';

export interface NutrientComparisonDetail {
  code: string;
  nameVi: string;
  nameEn: string;
  unit: string;
  actualIntake: number;
  recommendedRda: number;
  tolerableUpperLimit?: number;
  fulfillmentPercent: number; // (actual / rda) * 100%
  status: RdaComplianceStatus;
  statusVi: string;
  alertLevel: ClinicalAlertLevel;
  clinicalNote?: string;
}

export interface RdaComparisonSummary {
  assessedNutrientCount: number;
  adequateCount: number;
  deficiencyCount: number;
  severeDeficiencyCount: number;
  excessCount: number;
  toxicOrUlWarningCount: number;
  dietAdequacyScorePercent: number; // % chỉ tiêu đạt chuẩn
  energyBalance: {
    actualKcal: number;
    recommendedKcal: number;
    differenceKcal: number;
    fulfillmentPercent: number;
  };
  criticalWarnings: Array<{
    code: string;
    nameVi: string;
    actual: number;
    threshold: number;
    type: 'UL_EXCEEDED' | 'SEVERE_DEFICIENCY' | 'MASSIVE_EXCESS';
    messageVi: string;
  }>;
}

export interface RdaComparisonResult {
  demographic: DemographicProfile;
  summary: RdaComparisonSummary;
  nutrients: NutrientComparisonDetail[];
}

export class CompareRdaParamDto {
  actualIntake: RoundedNutrientMap | DecimalMap | Record<string, number | Decimal>;
  demographic: DemographicProfile;
  customTargets?: RdaTargetMap;
}

/**
 * PURE RDA COMPARISON ENGINE
 * Động cơ đối chiếu dinh dưỡng khẩu phần 24h với chuẩn khuyến nghị RDA/DRI
 * Chuẩn Viện Dinh Dưỡng Quốc Gia (NIN) & Bộ Y Tế Việt Nam.
 */
export class RdaComparisonEngine {
  private static readonly ZERO = new Decimal(0);
  private static readonly ONE_HUNDRED = new Decimal(100);

  /**
   * So sánh tổng hấp thu 24h với chuẩn RDA/DRI cho đối tượng lâm sàng
   *
   * @param actualIntake Dữ liệu dinh dưỡng thực tế (DecimalMap hoặc RoundedNutrientMap)
   * @param demographic Hồ sơ nhân khẩu học (tuổi, giới tính, tình trạng sinh lý, mức độ lao động)
   * @param customTargets Mục tiêu dinh dưỡng tùy chỉnh (từ giới hạn bệnh lý hoặc chỉ định bác sĩ)
   */
  public static compare(
    paramOrActual:
      CompareRdaParamDto | RoundedNutrientMap | DecimalMap | Record<string, number | Decimal>,
    legacyDemographic?: DemographicProfile,
    legacyCustomTargets?: RdaTargetMap,
  ): RdaComparisonResult {
    let actualIntake: RoundedNutrientMap | DecimalMap | Record<string, number | Decimal>;
    let demographic: DemographicProfile;
    let customTargets: RdaTargetMap | undefined;

    if (
      paramOrActual &&
      typeof paramOrActual === 'object' &&
      'demographic' in paramOrActual &&
      'actualIntake' in paramOrActual
    ) {
      const dto = paramOrActual as CompareRdaParamDto;
      actualIntake = dto.actualIntake;
      demographic = dto.demographic;
      customTargets = dto.customTargets;
    } else {
      actualIntake = paramOrActual as
        RoundedNutrientMap | DecimalMap | Record<string, number | Decimal>;
      demographic = legacyDemographic!;
      customTargets = legacyCustomTargets;
    }

    // 1. Lấy bảng khuyến nghị RDA chuẩn
    const baseTargetMap = getStandardRdaTargetMap(demographic);
    const finalTargets: RdaTargetMap = { ...baseTargetMap, ...(customTargets || {}) };

    const details: NutrientComparisonDetail[] = [];
    const criticalWarnings: RdaComparisonSummary['criticalWarnings'] = [];

    let adequateCount = 0;
    let deficiencyCount = 0;
    let severeDeficiencyCount = 0;
    let excessCount = 0;
    let toxicOrUlWarningCount = 0;

    for (const [code, target] of Object.entries(finalTargets)) {
      if (!target || target.rda <= 0) continue;

      const meta = NUTRIENT_METADATA_MAP[code as AllIndicatorCode];
      const nameVi = target.nameVi || meta?.nameVi || code;
      const nameEn = target.nameEn || meta?.nameEn || code;
      const unit = target.unit || meta?.unit || '';

      const rawVal = actualIntake[code as keyof typeof actualIntake];
      const actualDec = this.toDecimal(rawVal, 0);
      const rdaDec = new Decimal(target.rda);
      const ulDec = target.ul !== undefined && target.ul > 0 ? new Decimal(target.ul) : null;

      // Tính % đáp ứng: (actual / rda) * 100
      const fulfillmentPercentDec = actualDec.times(this.ONE_HUNDRED).dividedBy(rdaDec);
      const fulfillmentPercent = fulfillmentPercentDec
        .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
        .toNumber();
      const actualNumber = actualDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      let status: RdaComplianceStatus;
      let statusVi: string;
      let alertLevel: ClinicalAlertLevel;
      let clinicalNote = '';

      // PHÂN LOẠI CẢNH BÁO LÂM SÀNG CHUẨN Y KHOA:
      // 1. Vượt ngưỡng an toàn tối đa (UL) hoặc vượt quá 150%
      if (ulDec && actualDec.greaterThan(ulDec)) {
        status = RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED;
        statusVi = 'VƯỢT NGƯỠNG AN TOÀN UL (NGUY CƠ NGỘ ĐỘC)';
        alertLevel = 'DANGER';
        clinicalNote = `Lượng thực nạp (${actualNumber} ${unit}) đã vượt quá ngưỡng an toàn tối đa UL (${target.ul} ${unit}). Cần cắt giảm ngay để tránh biến chứng/ngộ độc!`;
        toxicOrUlWarningCount++;

        criticalWarnings.push({
          code,
          nameVi,
          actual: actualNumber,
          threshold: target.ul!,
          type: 'UL_EXCEEDED',
          messageVi: clinicalNote,
        });
      } else if (fulfillmentPercent > 150) {
        status = RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED;
        statusVi = 'VƯỢT QUÁ CAO (> 150% RDA)';
        alertLevel = 'DANGER';
        clinicalNote = `Đạt ${fulfillmentPercent}% nhu cầu RDA. Nguy cơ dư thừa vi chất kéo dài.`;
        toxicOrUlWarningCount++;

        criticalWarnings.push({
          code,
          nameVi,
          actual: actualNumber,
          threshold: Math.round(target.rda * 1.5),
          type: 'MASSIVE_EXCESS',
          messageVi: clinicalNote,
        });
      } else if (fulfillmentPercent > 110) {
        // 2. VƯỢT (111% - 130%) [hoặc <= 150%]
        status = RdaComplianceStatus.EXCESS;
        statusVi = 'VƯỢT NHU CẦU KHUYẾN NGHỊ (111% - 130%)';
        alertLevel = 'WARNING';
        clinicalNote = `Hơi vượt nhu cầu khuyến nghị (${fulfillmentPercent}%). Theo dõi thêm nếu duy trì nhiều ngày.`;
        excessCount++;
      } else if (fulfillmentPercent >= 90) {
        // 3. ĐẠT (90% - 110%)
        status = RdaComplianceStatus.ADEQUATE;
        statusVi = 'ĐẠT CHUẨN KHUYẾN NGHỊ (90% - 110%)';
        alertLevel = 'NORMAL';
        clinicalNote = 'Lượng hấp thu hoàn hảo, đáp ứng tốt nhu cầu dinh dưỡng sinh lý.';
        adequateCount++;
      } else if (fulfillmentPercent >= 70) {
        // 4. THIẾU (70% - 89%)
        status = RdaComplianceStatus.DEFICIENCY;
        statusVi = 'THIẾU HỤT NHẸ (70% - 89%)';
        alertLevel = 'WARNING';
        clinicalNote = `Chỉ đáp ứng ${fulfillmentPercent}% RDA. Nên bổ sung thêm thực phẩm giàu ${nameVi}.`;
        deficiencyCount++;
      } else {
        // 5. THIẾU TRẦM TRỌNG (< 70%)
        status = RdaComplianceStatus.SEVERE_DEFICIENCY;
        statusVi = 'THIẾU HỤT TRẦM TRỌNG (< 70%)';
        alertLevel = 'DANGER';
        clinicalNote = `Thiếu hụt nghiêm trọng! Chỉ đạt ${fulfillmentPercent}% nhu cầu. Cần can thiệp dinh dưỡng khẩn cấp!`;
        severeDeficiencyCount++;

        criticalWarnings.push({
          code,
          nameVi,
          actual: actualNumber,
          threshold: Math.round(target.rda * 0.7),
          type: 'SEVERE_DEFICIENCY',
          messageVi: clinicalNote,
        });
      }

      details.push({
        code,
        nameVi,
        nameEn,
        unit,
        actualIntake: actualNumber,
        recommendedRda: target.rda,
        tolerableUpperLimit: target.ul,
        fulfillmentPercent,
        status,
        statusVi,
        alertLevel,
        clinicalNote,
      });
    }

    // 2. Tính toán tóm tắt năng lượng (Kcal)
    const energyTarget = finalTargets.energy?.rda ?? 2000;
    const actualEnergyDec = this.toDecimal(
      actualIntake['energy' as keyof typeof actualIntake] ?? 0,
      0,
    );
    const actualEnergy = actualEnergyDec.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
    const energyDiff = new Decimal(actualEnergy)
      .minus(energyTarget)
      .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
      .toNumber();
    const energyFulfillment = actualEnergyDec
      .times(this.ONE_HUNDRED)
      .dividedBy(energyTarget)
      .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
      .toNumber();

    // 3. Tính điểm chất lượng khẩu phần (% chỉ tiêu đạt chuẩn)
    const totalAssessed = details.length;
    const dietAdequacyScore =
      totalAssessed > 0
        ? new Decimal(adequateCount)
            .times(this.ONE_HUNDRED)
            .dividedBy(totalAssessed)
            .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
            .toNumber()
        : 0;

    const summary: RdaComparisonSummary = {
      assessedNutrientCount: totalAssessed,
      adequateCount,
      deficiencyCount,
      severeDeficiencyCount,
      excessCount,
      toxicOrUlWarningCount,
      dietAdequacyScorePercent: dietAdequacyScore,
      energyBalance: {
        actualKcal: actualEnergy,
        recommendedKcal: energyTarget,
        differenceKcal: energyDiff,
        fulfillmentPercent: energyFulfillment,
      },
      criticalWarnings,
    };

    return {
      demographic,
      summary,
      nutrients: details,
    };
  }

  private static toDecimal(val: unknown, fallback = 0): Decimal {
    if (val === null || val === undefined || val === '') return new Decimal(fallback);
    if (val instanceof Decimal) return val.isNaN() ? new Decimal(fallback) : val;
    try {
      const d = new Decimal(String(val).trim());
      return d.isNaN() ? new Decimal(fallback) : d;
    } catch {
      return new Decimal(fallback);
    }
  }
}
