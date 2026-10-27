/**
 * Anthropometry Calculation Engine (Động cơ Nhân trắc học Dinh dưỡng)
 * Chuẩn hóa theo tiêu chuẩn WHO Châu Á (WPRO), Mifflin-St Jeor, và Lịch Dân sự Gregorius
 */

export enum BmiCategoryWPRO {
  UNDERWEIGHT = 'underweight',
  NORMAL = 'normal',
  OVERWEIGHT = 'overweight',
  OBESE_1 = 'obese1',
  OBESE_2 = 'obese2',
  OBESE_3 = 'obese3',
}

export const BMI_STATUS_VN: Record<BmiCategoryWPRO, string> = {
  [BmiCategoryWPRO.UNDERWEIGHT]: 'Thiếu cân',
  [BmiCategoryWPRO.NORMAL]: 'Bình thường',
  [BmiCategoryWPRO.OVERWEIGHT]: 'Thừa cân',
  [BmiCategoryWPRO.OBESE_1]: 'Béo phì độ I',
  [BmiCategoryWPRO.OBESE_2]: 'Béo phì độ II',
  [BmiCategoryWPRO.OBESE_3]: 'Béo phì độ III',
};

export const BIOLOGICAL_RANGES = {
  WEIGHT_KG: { MIN: 0.5, MAX: 500.0 },
  HEIGHT_CM: { MIN: 20.0, MAX: 300.0 },
  AGE_YEARS: { MIN: 0, MAX: 130 },
  PAL: { MIN: 1.0, MAX: 2.5, DEFAULT: 1.2 },
  STRESS_FACTOR: { MIN: 0.5, MAX: 3.0, DEFAULT: 1.0 },
} as const;

export const STANDARD_PAL_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

export interface BmiResult {
  bmi: number | null;
  bmiLevel: BmiCategoryWPRO | null;
  bmiStatus: string | null;
}

export interface AnthropometryEvaluation {
  age: number | null;
  bmi: number | null;
  bmiLevel: BmiCategoryWPRO | null;
  bmiStatus: string | null;
  bmr: number;
  tdee: number;
}

export class AnthropometryEngine {
  /**
   * Phân tích ngày tháng an toàn bất chấp múi giờ (Timezone Invariant)
   */
  private static parseDateParts(
    input: Date | string,
  ): { year: number; month: number; day: number } | null {
    if (input instanceof Date) {
      if (isNaN(input.getTime())) return null;
      return {
        year: input.getFullYear(),
        month: input.getMonth(),
        day: input.getDate(),
      };
    }

    const str = String(input).trim();
    if (!str) return null;

    // Định dạng YYYY-MM-DD hoặc ISO YYYY-MM-DDTHH:mm:ss
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return { year, month, day };
    }

    // Định dạng DD/MM/YYYY hoặc DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      return { year, month, day };
    }

    // Fallback qua Date parser
    const fallback = new Date(str);
    if (isNaN(fallback.getTime())) return null;
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth(),
      day: fallback.getDate(),
    };
  }

  /**
   * Tính tuổi dân sự chính xác theo lịch Gregorius
   * - So sánh chi tiết năm, tháng, ngày hiện tại với ngày sinh.
   * - Tuyệt đối không chia cho 365.25 ngày để tránh lệch 1 tuổi sát ngày sinh nhật.
   * - Nếu birthYearOnly = true: age = currentYear - birthYear.
   * - Giới hạn Biological Safety Range: [0, 130]. Nếu < 0 (ngày sinh ở tương lai) hoặc > 130 trả về null.
   */
  public static calculateExactAge(
    dobInput?: Date | string | null,
    birthYearOnly = false,
    referenceDate?: Date | string | null,
  ): number | null {
    if (!dobInput) return null;

    const birth = this.parseDateParts(dobInput);
    if (!birth) return null;

    const ref = referenceDate
      ? this.parseDateParts(referenceDate)
      : this.parseDateParts(new Date());
    if (!ref) return null;

    let age: number;

    if (birthYearOnly) {
      age = ref.year - birth.year;
    } else {
      age = ref.year - birth.year;
      const monthDiff = ref.month - birth.month;
      if (monthDiff < 0 || (monthDiff === 0 && ref.day < birth.day)) {
        age--;
      }
    }

    // Kiểm tra giới hạn sinh học an toàn
    if (age < BIOLOGICAL_RANGES.AGE_YEARS.MIN || age > BIOLOGICAL_RANGES.AGE_YEARS.MAX) {
      return null;
    }

    return age;
  }

  /**
   * Tính chỉ số khối cơ thể (BMI) và phân loại theo chuẩn WHO Châu Á (WPRO)
   * Formula: round(weight / (height/100)^2, 1)
   * Phân loại WPRO:
   *   < 18.5: underweight ("Thiếu cân")
   *   18.5 - 22.9: normal ("Bình thường")
   *   23.0 - 24.9: overweight ("Thừa cân")
   *   25.0 - 29.9: obese_1 ("Béo phì độ I")
   *   30.0 - 34.9: obese_2 ("Béo phì độ II")
   *   >= 35.0: obese_3 ("Béo phì độ III")
   * Biological Safety Range: W in [0.5, 500], H in [20, 300].
   * Nếu W <= 0 hoặc H <= 0 -> trả về null, TUYỆT ĐỐI không chia cho 0 sinh NaN/Infinity.
   */
  public static calculateBmi(weightKg?: number | null, heightCm?: number | null): BmiResult {
    if (
      weightKg == null ||
      heightCm == null ||
      isNaN(weightKg) ||
      isNaN(heightCm) ||
      weightKg <= 0 ||
      heightCm <= 0
    ) {
      return { bmi: null, bmiLevel: null, bmiStatus: null };
    }

    // Biological Safety Range checks
    if (
      weightKg < BIOLOGICAL_RANGES.WEIGHT_KG.MIN ||
      weightKg > BIOLOGICAL_RANGES.WEIGHT_KG.MAX ||
      heightCm < BIOLOGICAL_RANGES.HEIGHT_CM.MIN ||
      heightCm > BIOLOGICAL_RANGES.HEIGHT_CM.MAX
    ) {
      return { bmi: null, bmiLevel: null, bmiStatus: null };
    }

    const heightM = heightCm / 100.0;
    const rawBmi = weightKg / (heightM * heightM);

    // Làm tròn 1 chữ số thập phân chuẩn xác
    const bmi = Math.round(rawBmi * 10) / 10;

    let bmiLevel: BmiCategoryWPRO;
    if (bmi < 18.5) {
      bmiLevel = BmiCategoryWPRO.UNDERWEIGHT;
    } else if (bmi <= 22.9) {
      bmiLevel = BmiCategoryWPRO.NORMAL;
    } else if (bmi <= 24.9) {
      bmiLevel = BmiCategoryWPRO.OVERWEIGHT;
    } else if (bmi <= 29.9) {
      bmiLevel = BmiCategoryWPRO.OBESE_1;
    } else if (bmi <= 34.9) {
      bmiLevel = BmiCategoryWPRO.OBESE_2;
    } else {
      bmiLevel = BmiCategoryWPRO.OBESE_3;
    }

    return {
      bmi,
      bmiLevel,
      bmiStatus: BMI_STATUS_VN[bmiLevel],
    };
  }

  /**
   * Tính BMR theo phương trình Mifflin-St Jeor:
   * 10 * W + 6.25 * H - 5 * A + S
   * với S = +5 (Nam), S = -161 (Nữ)
   * Ràng buộc sinh học: W in [0.5, 500], H in [20, 300], A in [0, 130].
   */
  public static calculateBmr(
    isMale: boolean,
    weightKg?: number | null,
    heightCm?: number | null,
    age?: number | null,
  ): number {
    if (
      weightKg == null ||
      heightCm == null ||
      age == null ||
      isNaN(weightKg) ||
      isNaN(heightCm) ||
      isNaN(age) ||
      weightKg <= 0 ||
      heightCm <= 0 ||
      age < 0
    ) {
      return 0;
    }

    if (
      weightKg < BIOLOGICAL_RANGES.WEIGHT_KG.MIN ||
      weightKg > BIOLOGICAL_RANGES.WEIGHT_KG.MAX ||
      heightCm < BIOLOGICAL_RANGES.HEIGHT_CM.MIN ||
      heightCm > BIOLOGICAL_RANGES.HEIGHT_CM.MAX ||
      age > BIOLOGICAL_RANGES.AGE_YEARS.MAX
    ) {
      return 0;
    }

    const s = isMale ? 5 : -161;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;

    // Làm tròn 2 chữ số thập phân để triệt tiêu trôi số thực IEEE 754
    return Math.max(0, Math.round(bmr * 100) / 100);
  }

  /**
   * Tính TDEE (Tổng năng lượng tiêu hao cả ngày):
   * TDEE = round(BMR * PAL * StressFactor)
   * Hỗ trợ PAL chuẩn (1.2, 1.375, 1.55, 1.725, 1.9), mặc định 1.2
   * Hỗ trợ StressFactor (mặc định 1.0, phẫu thuật, nhiễm trùng, bỏng)
   */
  public static calculateTdee(
    isMale: boolean,
    weightKg?: number | null,
    heightCm?: number | null,
    age?: number | null,
    activityFactor?: number | null,
    stressFactor = 1.0,
  ): number {
    const bmr = this.calculateBmr(isMale, weightKg, heightCm, age);
    if (bmr <= 0) return 0;

    const pal =
      activityFactor != null && !isNaN(activityFactor) && activityFactor > 0
        ? activityFactor
        : BIOLOGICAL_RANGES.PAL.DEFAULT;

    const stress =
      stressFactor != null && !isNaN(stressFactor) && stressFactor > 0
        ? stressFactor
        : BIOLOGICAL_RANGES.STRESS_FACTOR.DEFAULT;

    return Math.max(0, Math.round(bmr * pal * stress));
  }

  /**
   * Tính TDEE trực tiếp từ giá trị BMR đã tính trước
   */
  public static calculateTdeeFromBmr(
    bmr: number,
    activityFactor?: number | null,
    stressFactor = 1.0,
  ): number {
    if (bmr <= 0 || isNaN(bmr)) return 0;

    const pal =
      activityFactor != null && !isNaN(activityFactor) && activityFactor > 0
        ? activityFactor
        : BIOLOGICAL_RANGES.PAL.DEFAULT;

    const stress =
      stressFactor != null && !isNaN(stressFactor) && stressFactor > 0
        ? stressFactor
        : BIOLOGICAL_RANGES.STRESS_FACTOR.DEFAULT;

    return Math.max(0, Math.round(bmr * pal * stress));
  }

  /**
   * Đánh giá toàn diện các chỉ số nhân trắc học cho bệnh nhân (DRY SSOT)
   */
  public static evaluate(input: {
    isMale: boolean;
    weightKg?: number | null;
    heightCm?: number | null;
    dob?: Date | string | null;
    birthYearOnly?: boolean;
    activityFactor?: number | null;
    stressFactor?: number | null;
    referenceDate?: Date | string | null;
  }): AnthropometryEvaluation {
    const age = this.calculateExactAge(input.dob, input.birthYearOnly, input.referenceDate);
    const { bmi, bmiLevel, bmiStatus } = this.calculateBmi(input.weightKg, input.heightCm);
    const bmr = this.calculateBmr(input.isMale, input.weightKg, input.heightCm, age);
    const tdee = this.calculateTdee(
      input.isMale,
      input.weightKg,
      input.heightCm,
      age,
      input.activityFactor,
      input.stressFactor ?? 1.0,
    );

    return {
      age,
      bmi,
      bmiLevel,
      bmiStatus,
      bmr,
      tdee,
    };
  }
}
