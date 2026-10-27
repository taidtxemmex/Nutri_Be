/**
 * SSOT EXCEL CONSTANTS & CLINICAL RDA REFERENCE VALUES
 * Tuân thủ Pillar II (SSOT & Universal DRY Code Law)
 */

export const EXCEL_FONT_FAMILY = 'Calibri';

export const EXCEL_STYLES = {
  FONTS: {
    TITLE: { name: EXCEL_FONT_FAMILY, size: 14, bold: true, color: { argb: 'FF1F497D' } },
    SUBTITLE: { name: EXCEL_FONT_FAMILY, size: 11, italic: true, color: { argb: 'FF595959' } },
    SECTION_HEADER: { name: EXCEL_FONT_FAMILY, size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    DAY_TITLE: { name: EXCEL_FONT_FAMILY, size: 12, bold: true, color: { argb: 'FF276A3C' } },
    MEAL_TITLE: { name: EXCEL_FONT_FAMILY, size: 11, bold: true, color: { argb: 'FF8A6D3B' } },
    HEADER: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    DATA: { name: EXCEL_FONT_FAMILY, size: 10, color: { argb: 'FF000000' } },
    TOTAL: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF1A73E8' } },
    ERROR: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF9C0006' } },
    WARNING: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF9C6500' } },
    OPTIMAL: { name: EXCEL_FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF006100' } },
  },
  COLORS: {
    PRIMARY_NAVY: 'FF1F497D',
    MEDICAL_GREEN: 'FF2E7D32',
    LIGHT_GREEN_DAY: 'FFE2F0D9',
    LIGHT_YELLOW_MEAL: 'FFFFF2CC',
    LIGHT_BLUE_TOTAL: 'FFE8F0FE',
    ZEBRA_LIGHT: 'FFF9FAFB',
    BORDER_LIGHT: 'FFD0D7DE',
    BORDER_MEDIUM: 'FF1F497D',
    // Clinical indicators
    DEFICIENCY_RED_FILL: 'FFFFC7CE',
    DEFICIENCY_RED_TEXT: 'FF9C0006',
    EXCESS_YELLOW_FILL: 'FFFFEB9C',
    EXCESS_YELLOW_TEXT: 'FF9C6500',
    OPTIMAL_GREEN_FILL: 'FFC6EFCE',
    OPTIMAL_GREEN_TEXT: 'FF006100',
  },
} as const;

export const EXCEL_LIMITS = {
  MAX_IMPORT_ROWS: 1000,
  MAX_WEIGHT_GRAMS: 50000,
  MIN_WEIGHT_GRAMS: 0.1,
} as const;

export interface RdaReferenceItem {
  code: string;
  nameVi: string;
  unit: string;
  rdaMale: number;
  rdaFemale: number;
  rdaDefault: number;
  lowerLimitRatio: number; // 0.8 (80%)
  upperLimitRatio: number; // 1.2 (120%)
  category: 'ENERGY' | 'MACRO' | 'MINERAL' | 'VITAMIN';
}

/**
 * Bảng Nhu cầu Dinh dưỡng Khuyến nghị (RDA) theo Viện Dinh Dưỡng Quốc Gia (NIN 2016)
 * Chuẩn đối chiếu lâm sàng cho người trưởng thành Việt Nam
 */
export const VIETNAM_NIN_RDA_STANDARDS: Record<string, RdaReferenceItem> = {
  energy: {
    code: 'energy',
    nameVi: 'Năng lượng',
    unit: 'kcal',
    rdaMale: 2200,
    rdaFemale: 1800,
    rdaDefault: 2000,
    lowerLimitRatio: 0.9,
    upperLimitRatio: 1.1,
    category: 'ENERGY',
  },
  protein: {
    code: 'protein',
    nameVi: 'Chất đạm (Protein)',
    unit: 'g',
    rdaMale: 65,
    rdaFemale: 55,
    rdaDefault: 60,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.25,
    category: 'MACRO',
  },
  fat: {
    code: 'fat',
    nameVi: 'Chất béo (Lipid)',
    unit: 'g',
    rdaMale: 55,
    rdaFemale: 45,
    rdaDefault: 50,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.25,
    category: 'MACRO',
  },
  carbohydrate: {
    code: 'carbohydrate',
    nameVi: 'Chất bột đường (Glucid)',
    unit: 'g',
    rdaMale: 330,
    rdaFemale: 270,
    rdaDefault: 300,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.25,
    category: 'MACRO',
  },
  fiber: {
    code: 'fiber',
    nameVi: 'Chất xơ tổng số',
    unit: 'g',
    rdaMale: 25,
    rdaFemale: 20,
    rdaDefault: 22,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'MACRO',
  },
  calci: {
    code: 'calci',
    nameVi: 'Canxi (Calci)',
    unit: 'mg',
    rdaMale: 1000,
    rdaFemale: 1000,
    rdaDefault: 1000,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  phosphorous: {
    code: 'phosphorous',
    nameVi: 'Phốt pho',
    unit: 'mg',
    rdaMale: 700,
    rdaFemale: 700,
    rdaDefault: 700,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  iron: {
    code: 'iron',
    nameVi: 'Sắt',
    unit: 'mg',
    rdaMale: 11,
    rdaFemale: 24, // Phụ nữ độ tuổi sinh sản cần 24-28mg
    rdaDefault: 15,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  zinc: {
    code: 'zinc',
    nameVi: 'Kẽm',
    unit: 'mg',
    rdaMale: 10,
    rdaFemale: 8,
    rdaDefault: 9,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  sodium: {
    code: 'sodium',
    nameVi: 'Natri (Muối ăn <5g/ngày)',
    unit: 'mg',
    rdaMale: 2000,
    rdaFemale: 2000,
    rdaDefault: 2000,
    lowerLimitRatio: 0.5,
    upperLimitRatio: 1.0, // Natri cần khống chế < 2000mg
    category: 'MINERAL',
  },
  potassium: {
    code: 'potassium',
    nameVi: 'Kali',
    unit: 'mg',
    rdaMale: 3500,
    rdaFemale: 3500,
    rdaDefault: 3500,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  magnesium: {
    code: 'magnesium',
    nameVi: 'Magiê',
    unit: 'mg',
    rdaMale: 350,
    rdaFemale: 300,
    rdaDefault: 320,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'MINERAL',
  },
  vitaminARae: {
    code: 'vitaminARae',
    nameVi: 'Vitamin A (RAE)',
    unit: 'µg',
    rdaMale: 750,
    rdaFemale: 650,
    rdaDefault: 700,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 1.5,
    category: 'VITAMIN',
  },
  vitaminC: {
    code: 'vitaminC',
    nameVi: 'Vitamin C',
    unit: 'mg',
    rdaMale: 100,
    rdaFemale: 100,
    rdaDefault: 100,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  vitaminD: {
    code: 'vitaminD',
    nameVi: 'Vitamin D',
    unit: 'µg',
    rdaMale: 15,
    rdaFemale: 15,
    rdaDefault: 15,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.5,
    category: 'VITAMIN',
  },
  vitaminE: {
    code: 'vitaminE',
    nameVi: 'Vitamin E',
    unit: 'mg',
    rdaMale: 15,
    rdaFemale: 15,
    rdaDefault: 15,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  thiamine: {
    code: 'thiamine',
    nameVi: 'Vitamin B1 (Thiamine)',
    unit: 'mg',
    rdaMale: 1.2,
    rdaFemale: 1.1,
    rdaDefault: 1.2,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  riboflavin: {
    code: 'riboflavin',
    nameVi: 'Vitamin B2 (Riboflavin)',
    unit: 'mg',
    rdaMale: 1.3,
    rdaFemale: 1.1,
    rdaDefault: 1.2,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  niacin: {
    code: 'niacin',
    nameVi: 'Vitamin B3 / PP (Niacin)',
    unit: 'mg',
    rdaMale: 16,
    rdaFemale: 14,
    rdaDefault: 15,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  vitaminB6: {
    code: 'vitaminB6',
    nameVi: 'Vitamin B6',
    unit: 'mg',
    rdaMale: 1.5,
    rdaFemale: 1.3,
    rdaDefault: 1.4,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  folate: {
    code: 'folate',
    nameVi: 'Folate / Acid Folic',
    unit: 'µg',
    rdaMale: 400,
    rdaFemale: 400,
    rdaDefault: 400,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.0,
    category: 'VITAMIN',
  },
  vitaminB12: {
    code: 'vitaminB12',
    nameVi: 'Vitamin B12',
    unit: 'µg',
    rdaMale: 2.4,
    rdaFemale: 2.4,
    rdaDefault: 2.4,
    lowerLimitRatio: 0.8,
    upperLimitRatio: 2.5,
    category: 'VITAMIN',
  },
};

/**
 * Tỷ lệ năng lượng khuyến nghị chuẩn NIN / WHO (P:L:C)
 */
export const ENERGY_DISTRIBUTION_RECOMMENDED = {
  PROTEIN_MIN: 13,
  PROTEIN_MAX: 20,
  LIPID_MIN: 20,
  LIPID_MAX: 25,
  CARBOHYDRATE_MIN: 55,
  CARBOHYDRATE_MAX: 65,
  // Phân bố theo bữa
  MEAL_BREAKFAST_MIN: 20,
  MEAL_BREAKFAST_MAX: 25,
  MEAL_LUNCH_MIN: 30,
  MEAL_LUNCH_MAX: 35,
  MEAL_DINNER_MIN: 25,
  MEAL_DINNER_MAX: 30,
  MEAL_SNACK_MIN: 5,
  MEAL_SNACK_MAX: 10,
} as const;
