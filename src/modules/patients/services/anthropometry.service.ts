export class AnthropometryEngine {
  /**
   * Tính tuổi chính xác theo lịch dân sự (Khắc phục hoàn toàn lỗi trôi ngày của 365.25)
   */
  public static calculateExactAge(
    dobInput?: Date | string | null,
    birthYearOnly = false,
  ): number | null {
    if (!dobInput) return null;
    const birth = new Date(dobInput);
    if (isNaN(birth.getTime())) return null;

    const today = new Date();
    if (birthYearOnly) {
      return Math.max(0, today.getFullYear() - birth.getFullYear());
    }

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }

  /**
   * Tính BMI và phân loại theo tiêu chuẩn WHO Châu Á (WPRO)
   */
  public static calculateBmi(
    weightKg?: number | null,
    heightCm?: number | null,
  ): { bmi: number | null; bmiLevel: string | null; bmiStatus: string | null } {
    if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
      return { bmi: null, bmiLevel: null, bmiStatus: null };
    }

    const heightM = heightCm / 100.0;
    const rawBmi = weightKg / (heightM * heightM);
    const bmi = Math.round(rawBmi * 10) / 10; // Làm tròn 1 chữ số thập phân

    let bmiLevel = 'normal';
    let bmiStatus = 'Bình thường';

    if (bmi < 18.5) {
      bmiLevel = 'underweight';
      bmiStatus = 'Thiếu cân';
    } else if (bmi <= 22.9) {
      bmiLevel = 'normal';
      bmiStatus = 'Bình thường';
    } else if (bmi <= 24.9) {
      bmiLevel = 'overweight';
      bmiStatus = 'Thừa cân';
    } else if (bmi <= 29.9) {
      bmiLevel = 'obese1';
      bmiStatus = 'Béo phì độ I';
    } else if (bmi <= 34.9) {
      bmiLevel = 'obese2';
      bmiStatus = 'Béo phì độ II';
    } else {
      bmiLevel = 'obese3';
      bmiStatus = 'Béo phì độ III';
    }

    return { bmi, bmiLevel, bmiStatus };
  }

  /**
   * Tính BMR theo phương trình Mifflin-St Jeor
   */
  public static calculateBmr(
    isMale: boolean,
    weightKg?: number | null,
    heightCm?: number | null,
    age?: number | null,
  ): number {
    if (!weightKg || !heightCm || age == null || age < 0) return 0;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return isMale ? base + 5 : base - 161;
  }

  /**
   * Tính TDEE tổng tiêu hao năng lượng hàng ngày
   */
  public static calculateTdee(
    isMale: boolean,
    weightKg?: number | null,
    heightCm?: number | null,
    age?: number | null,
    activityFactor?: number | null,
  ): number {
    const bmr = this.calculateBmr(isMale, weightKg, heightCm, age);
    if (bmr <= 0) return 0;
    const factor = activityFactor && activityFactor >= 1.0 ? activityFactor : 1.2;
    return Math.round(bmr * factor);
  }
}
