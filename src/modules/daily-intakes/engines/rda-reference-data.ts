/**
 * BẢNG NHU CẦU DINH DƯỠNG KHUYẾN NGHỊ (RDA / DRI)
 * Chuẩn Viện Dinh Dưỡng Quốc Gia Việt Nam (NIN) & Bộ Y Tế (Quyết định 2146/QĐ-BYT) & WHO/FAO
 */

export interface DemographicProfile {
  ageYears?: number;
  ageMonths?: number;
  gender: 'NAM' | 'NU' | 'MALE' | 'FEMALE';
  physiologicalStatus?:
    'NORMAL' | 'PREGNANT_T1' | 'PREGNANT_T2' | 'PREGNANT_T3' | 'LACTATING_0_6M' | 'LACTATING_7_12M';
  activityLevel?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
  activityFactor?: number;
}

export interface NutrientReferenceTarget {
  rda: number; // Recommended Dietary Allowance (Khuyến nghị hàng ngày)
  ul?: number; // Tolerable Upper Intake Level (Ngưỡng an toàn tối đa)
  unit: string;
  nameVi: string;
  nameEn: string;
}

export type RdaTargetMap = Record<string, NutrientReferenceTarget>;

/**
 * Ngưỡng an toàn tối đa (UL - Tolerable Upper Intake Level) theo WHO/NIN
 */
export const DEFAULT_UPPER_LIMITS: Record<string, number> = {
  calci: 2500, // mg
  phosphorous: 4000, // mg
  iron: 45, // mg
  zinc: 40, // mg
  sodium: 2300, // mg
  magnesium: 350, // mg
  manganese: 11, // mg
  copper: 10000, // µg
  selenium: 400, // µg
  vitaminC: 2000, // mg
  niacin: 35, // mg
  vitaminB6: 100, // mg
  folate: 1000, // µg
  folicAcid: 1000, // µg
  vitaminARae: 3000, // µg
  retinol: 3000, // µg
  vitaminD: 100, // µg (4000 IU)
  vitaminE: 1000, // mg
  cholesterol: 300, // mg (Khuyến nghị trần tim mạch)
};

/**
 * Tra cứu bảng RDA chuẩn theo độ tuổi, giới tính và mức độ lao động
 */
export function getStandardRdaTargetMap(profile: DemographicProfile): RdaTargetMap {
  const isMale = profile.gender === 'NAM' || profile.gender === 'MALE';
  const age = profile.ageYears ?? (profile.ageMonths ? profile.ageMonths / 12 : 25);
  const status = profile.physiologicalStatus ?? 'NORMAL';
  const pal = profile.activityLevel ?? 'LIGHT';

  // 1. Năng lượng cơ bản (kcal) & Đạm (g) theo độ tuổi và giới tính
  let baseEnergy = isMale ? 2200 : 1800;
  let baseProtein = isMale ? 65 : 55;
  let baseWater = isMale ? 2500 : 2000;
  let baseFiber = isMale ? 25 : 20;

  // Điều chỉnh theo nhóm tuổi
  if (age < 1) {
    baseEnergy = 650;
    baseProtein = 11;
    baseWater = 800;
    baseFiber = 0;
  } else if (age <= 3) {
    baseEnergy = 1100;
    baseProtein = 20;
    baseWater = 1200;
    baseFiber = 14;
  } else if (age <= 6) {
    baseEnergy = 1400;
    baseProtein = 25;
    baseWater = 1500;
    baseFiber = 16;
  } else if (age <= 9) {
    baseEnergy = 1700;
    baseProtein = 35;
    baseWater = 1800;
    baseFiber = 18;
  } else if (age <= 18) {
    baseEnergy = isMale ? 2400 : 2000;
    baseProtein = isMale ? 65 : 55;
    baseWater = isMale ? 2400 : 2000;
    baseFiber = isMale ? 25 : 22;
  } else if (age >= 60) {
    baseEnergy = isMale ? 1900 : 1600;
    baseProtein = isMale ? 60 : 50;
    baseWater = 2000;
    baseFiber = 20;
  }

  // Điều chỉnh theo mức độ vận động (PAL) cho người lớn (>= 18 tuổi)
  if (age >= 18) {
    let factor = 1.0;
    if (pal === 'SEDENTARY') factor = 0.9;
    else if (pal === 'LIGHT') factor = 1.0;
    else if (pal === 'MODERATE') factor = 1.15;
    else if (pal === 'ACTIVE') factor = 1.3;
    else if (pal === 'VERY_ACTIVE') factor = 1.45;

    baseEnergy = Math.round(baseEnergy * factor);
    baseWater = Math.round(baseWater * factor);
  }

  // 2. Vi chất dinh dưỡng chuẩn người trưởng thành (Bộ Y Tế / NIN 2016)
  let calci = age >= 50 ? 1000 : 800;
  let iron = isMale ? 11 : age <= 50 ? 24 : 10;
  let zinc = isMale ? 10 : 8;
  let vitC = isMale ? 100 : 95;
  let vitA = isMale ? 850 : 650;
  let vitD = age >= 70 ? 20 : 15;
  let vitE = 12;
  let vitB1 = isMale ? 1.2 : 1.1;
  let vitB2 = isMale ? 1.3 : 1.1;
  let vitB3 = isMale ? 16 : 14;
  let vitB6 = age >= 50 ? 1.7 : 1.3;
  let folate = 400;
  let vitB12 = 2.4;
  let sodium = 1500;
  let potassium = 3510;
  let magnesium = isMale ? 340 : 280;
  let phosphorous = 700;
  let selenium = 55;

  // Trẻ em điều chỉnh vi chất theo tuổi
  if (age < 1) {
    calci = 300;
    iron = 5;
    zinc = 3;
    vitC = 40;
    vitA = 400;
    vitD = 10;
    vitE = 4;
    vitB1 = 0.3;
    vitB2 = 0.4;
    vitB3 = 4;
    vitB6 = 0.3;
    folate = 80;
    vitB12 = 0.5;
    sodium = 370;
    potassium = 800;
    magnesium = 55;
    phosphorous = 275;
    selenium = 15;
  } else if (age <= 9) {
    calci = 600;
    iron = 9;
    zinc = 5;
    vitC = 60;
    vitA = 500;
    vitD = 15;
    vitE = 7;
    vitB1 = 0.7;
    vitB2 = 0.8;
    vitB3 = 9;
    vitB6 = 0.7;
    folate = 200;
    vitB12 = 1.2;
    sodium = 1000;
    potassium = 2300;
    magnesium = 130;
    phosphorous = 500;
    selenium = 25;
  }

  // 3. Phụ nữ mang thai & cho con bú (Bộ Y Tế / NIN 2016)
  if (!isMale) {
    if (status === 'PREGNANT_T1') {
      baseEnergy += 50;
      baseProtein += 1;
      iron = 30;
      folate = 600;
      calci = 1000;
    } else if (status === 'PREGNANT_T2') {
      baseEnergy += 250;
      baseProtein += 15;
      iron = 30;
      folate = 600;
      calci = 1200;
      vitC += 10;
      vitA += 50;
    } else if (status === 'PREGNANT_T3') {
      baseEnergy += 450;
      baseProtein += 30;
      iron = 30;
      folate = 600;
      calci = 1200;
      vitC += 15;
      vitA += 50;
    } else if (status === 'LACTATING_0_6M') {
      baseEnergy += 500;
      baseProtein += 19;
      calci = 1300;
      vitA = 850;
      vitC = 140;
      folate = 500;
      vitB12 = 2.8;
      zinc = 12;
      baseWater += 700;
    } else if (status === 'LACTATING_7_12M') {
      baseEnergy += 500;
      baseProtein += 13;
      calci = 1300;
      vitA = 850;
      vitC = 140;
      folate = 500;
      vitB12 = 2.8;
      zinc = 12;
      baseWater += 700;
    }
  }

  // Nhu cầu chất béo (Fat): 20 - 25% tổng năng lượng (1g fat = 9 kcal)
  const baseFat = Math.round((baseEnergy * 0.25) / 9);
  // Nhu cầu tinh bột (Carbohydrate): 55 - 65% tổng năng lượng (1g carb = 4 kcal)
  const baseCarb = Math.round((baseEnergy * 0.6) / 4);

  const targets: RdaTargetMap = {
    energy: {
      rda: baseEnergy,
      unit: 'kcal',
      nameVi: 'Năng lượng',
      nameEn: 'Energy',
    },
    protein: {
      rda: baseProtein,
      unit: 'g',
      nameVi: 'Protein tổng số (Đạm)',
      nameEn: 'Protein',
    },
    fat: {
      rda: baseFat,
      unit: 'g',
      nameVi: 'Lipid tổng số (Chất béo)',
      nameEn: 'Fat',
    },
    carbohydrate: {
      rda: baseCarb,
      unit: 'g',
      nameVi: 'Glucid khả dụng (Carbohydrate)',
      nameEn: 'Available Carbohydrate',
    },
    fiber: {
      rda: baseFiber,
      unit: 'g',
      nameVi: 'Chất xơ tổng số',
      nameEn: 'Dietary Fiber',
    },
    water: {
      rda: baseWater,
      unit: 'g',
      nameVi: 'Nước',
      nameEn: 'Water',
    },
    calci: {
      rda: calci,
      ul: DEFAULT_UPPER_LIMITS.calci,
      unit: 'mg',
      nameVi: 'Canxi (Calci)',
      nameEn: 'Calcium',
    },
    phosphorous: {
      rda: phosphorous,
      ul: DEFAULT_UPPER_LIMITS.phosphorous,
      unit: 'mg',
      nameVi: 'Phốt pho',
      nameEn: 'Phosphorus',
    },
    iron: {
      rda: iron,
      ul: DEFAULT_UPPER_LIMITS.iron,
      unit: 'mg',
      nameVi: 'Sắt',
      nameEn: 'Iron',
    },
    zinc: {
      rda: zinc,
      ul: DEFAULT_UPPER_LIMITS.zinc,
      unit: 'mg',
      nameVi: 'Kẽm',
      nameEn: 'Zinc',
    },
    sodium: {
      rda: sodium,
      ul: DEFAULT_UPPER_LIMITS.sodium,
      unit: 'mg',
      nameVi: 'Natri',
      nameEn: 'Sodium',
    },
    potassium: {
      rda: potassium,
      unit: 'mg',
      nameVi: 'Kali',
      nameEn: 'Potassium',
    },
    magnesium: {
      rda: magnesium,
      ul: DEFAULT_UPPER_LIMITS.magnesium,
      unit: 'mg',
      nameVi: 'Magiê',
      nameEn: 'Magnesium',
    },
    selenium: {
      rda: selenium,
      ul: DEFAULT_UPPER_LIMITS.selenium,
      unit: 'µg',
      nameVi: 'Selen',
      nameEn: 'Selenium',
    },
    vitaminC: {
      rda: vitC,
      ul: DEFAULT_UPPER_LIMITS.vitaminC,
      unit: 'mg',
      nameVi: 'Vitamin C',
      nameEn: 'Vitamin C',
    },
    thiamine: {
      rda: vitB1,
      unit: 'mg',
      nameVi: 'Vitamin B1 (Thiamine)',
      nameEn: 'Thiamine',
    },
    riboflavin: {
      rda: vitB2,
      unit: 'mg',
      nameVi: 'Vitamin B2 (Riboflavin)',
      nameEn: 'Riboflavin',
    },
    niacin: {
      rda: vitB3,
      ul: DEFAULT_UPPER_LIMITS.niacin,
      unit: 'mg',
      nameVi: 'Vitamin B3 (Niacin)',
      nameEn: 'Niacin',
    },
    vitaminB6: {
      rda: vitB6,
      ul: DEFAULT_UPPER_LIMITS.vitaminB6,
      unit: 'mg',
      nameVi: 'Vitamin B6',
      nameEn: 'Vitamin B6',
    },
    folate: {
      rda: folate,
      ul: DEFAULT_UPPER_LIMITS.folate,
      unit: 'µg',
      nameVi: 'Vitamin B9 (Folate / Acid Folic)',
      nameEn: 'Folate',
    },
    vitaminB12: {
      rda: vitB12,
      unit: 'µg',
      nameVi: 'Vitamin B12',
      nameEn: 'Vitamin B12',
    },
    vitaminARae: {
      rda: vitA,
      ul: DEFAULT_UPPER_LIMITS.vitaminARae,
      unit: 'µg',
      nameVi: 'Vitamin A (RAE)',
      nameEn: 'Vitamin A RAE',
    },
    vitaminD: {
      rda: vitD,
      ul: DEFAULT_UPPER_LIMITS.vitaminD,
      unit: 'µg',
      nameVi: 'Vitamin D',
      nameEn: 'Vitamin D',
    },
    vitaminE: {
      rda: vitE,
      ul: DEFAULT_UPPER_LIMITS.vitaminE,
      unit: 'mg',
      nameVi: 'Vitamin E',
      nameEn: 'Vitamin E',
    },
  };

  return targets;
}
