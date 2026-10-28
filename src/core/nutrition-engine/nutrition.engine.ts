import Decimal from 'decimal.js';
import {
  AllIndicatorCode,
  ALL_INDICATOR_CODES,
  ATWATER_FACTORS,
  BASE_NUTRIENT_CODES,
  NUTRIENT_ALIASES,
  RAE_CONVERSION,
} from './nutrition.constants';

// Cấu hình chuẩn độ chính xác 20 chữ số và làm tròn ROUND_HALF_UP (chuẩn y khoa)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type DecimalMap = Partial<Record<AllIndicatorCode, Decimal>>;
export type RoundedNutrientMap = Partial<Record<AllIndicatorCode, number>>;

export interface RawIngredientInput {
  id?: number | bigint | string | null;
  name?: string | null;
  ten_nguyen_lieu?: string | null;
  edible?: number | string | Decimal | null;
  edibleRate?: number | string | Decimal | null;
  loai_protein?: string | null;
  loaiProtein?: string | null;
  proteinType?: string | null;
  nutrients?: Record<string, number | string | Decimal | null | undefined>;
  [key: string]: any;
}

export interface CalculationOptions {
  isNetWeight?: boolean; // true = khối lượng sạch (đã trừ vỏ); false = cân cả vỏ/xương (cần nhân edible)
  targetDecimalPlaces?: number; // Mặc định 2 ở presentation layer
  preserveDecimals?: boolean; // Giữ nguyên Decimal Map thay vì làm tròn số thực
}

export interface DetailedNutrientResult {
  rawWeightGrams: Decimal;
  netWeightGrams: Decimal;
  edibleRate: Decimal;
  nutrients: DecimalMap;
  roundedNutrients?: RoundedNutrientMap;
}

export class ToDecimalParamDto {
  val: unknown;
  fallback?: number;
}

export class CalculateNetWeightParamDto {
  weightGrams: unknown;
  edibleRateInput?: unknown;
  isNetWeight?: boolean;
}

export class CalculateCarbohydrateParamDto {
  water: unknown;
  protein: unknown;
  fat: unknown;
  ash: unknown;
  fiber: unknown;
}

export class CalculateEnergyParamDto {
  protein: unknown;
  fat: unknown;
  carbohydrate: unknown;
}

export class CalculateVitaminARaeParamDto {
  retinol: unknown;
  betaCarotene: unknown;
  alphaCarotene: unknown;
  betaCryptoxanthin: unknown;
}

export class ExtractNutrientValueParamDto {
  source: RawIngredientInput;
  code: AllIndicatorCode;
}

export class CalculateIngredientNutrientsParamDto {
  ingredient: RawIngredientInput;
  weightGrams: unknown;
  options?: CalculationOptions;
}

export class AccumulateNutrientsParamDto {
  target: DecimalMap;
  source: DecimalMap;
}

export class RoundDecimalMapParamDto {
  map: DecimalMap;
  decimalPlaces?: number;
}

/**
 * PURE NUTRITION CALCULATION ENGINE
 * Động cơ toán học dinh dưỡng chuẩn xác cao 100% bằng Decimal.js
 * Loại bỏ hoàn toàn Floating-point drift (0.1 + 0.2 != 0.3)
 * Khắc phục toàn bộ các bẫy logic của Spring Boot Java cũ
 */
export class NutritionEngine {
  public static readonly ATWATER_PROTEIN = new Decimal(ATWATER_FACTORS.PROTEIN);
  public static readonly ATWATER_FAT = new Decimal(ATWATER_FACTORS.FAT);
  public static readonly ATWATER_CARB = new Decimal(ATWATER_FACTORS.CARBOHYDRATE);

  public static readonly RAE_RETINOL = new Decimal(RAE_CONVERSION.RETINOL_FACTOR);
  public static readonly RAE_BETA_CAROTENE_DIV = new Decimal(RAE_CONVERSION.BETA_CAROTENE_DIVISOR);
  public static readonly RAE_ALPHA_CAROTENE_DIV = new Decimal(
    RAE_CONVERSION.ALPHA_CAROTENE_DIVISOR,
  );
  public static readonly RAE_BETA_CRYPTOXANTHIN_DIV = new Decimal(
    RAE_CONVERSION.BETA_CRYPTOXANTHIN_DIVISOR,
  );

  public static readonly ONE_HUNDRED = new Decimal(100);
  public static readonly ZERO = new Decimal(0);

  /**
   * Chuyển đổi an toàn bất kỳ kiểu dữ liệu nào sang Decimal
   */
  public static toDecimal(paramOrVal: ToDecimalParamDto | unknown, legacyFallback = 0): Decimal {
    if (
      paramOrVal &&
      typeof paramOrVal === 'object' &&
      !(paramOrVal instanceof Decimal) &&
      'val' in paramOrVal
    ) {
      const dto = paramOrVal as ToDecimalParamDto;
      return this.toDecimal(dto.val, dto.fallback ?? 0);
    }
    const val = paramOrVal;
    const fallback = legacyFallback;
    if (val === null || val === undefined || val === '') {
      return new Decimal(fallback);
    }
    if (val instanceof Decimal) {
      return val.isNaN() ? new Decimal(fallback) : val;
    }
    try {
      const d = new Decimal(String(val).trim());
      return d.isNaN() ? new Decimal(fallback) : d;
    } catch {
      return new Decimal(fallback);
    }
  }

  /**
   * Tính khối lượng thực phẩm sạch (Net Weight) sau khi áp dụng tỷ lệ ăn được (Edible Rate)
   * Gross Weight: Cân cả vỏ/xương -> netWeight = grossWeight * (edibleRate / 100)
   * Net Weight: Cân phần ăn được -> netWeight = weight
   */
  public static calculateNetWeight(
    paramOrWeight: CalculateNetWeightParamDto | unknown,
    legacyEdibleRateInput?: unknown,
    legacyIsNetWeight = false,
  ): Decimal {
    let weightGrams: unknown;
    let edibleRateInput: unknown;
    let isNetWeight: boolean;

    if (
      paramOrWeight &&
      typeof paramOrWeight === 'object' &&
      !(paramOrWeight instanceof Decimal) &&
      'weightGrams' in paramOrWeight
    ) {
      const dto = paramOrWeight as CalculateNetWeightParamDto;
      weightGrams = dto.weightGrams;
      edibleRateInput = dto.edibleRateInput;
      isNetWeight = dto.isNetWeight || false;
    } else {
      weightGrams = paramOrWeight;
      edibleRateInput = legacyEdibleRateInput;
      isNetWeight = legacyIsNetWeight;
    }

    const rawWeight = Decimal.max(this.ZERO, this.toDecimal(weightGrams, 0));
    if (isNetWeight) {
      return rawWeight;
    }

    let edible =
      edibleRateInput !== undefined && edibleRateInput !== null
        ? this.toDecimal(edibleRateInput, 100)
        : this.ONE_HUNDRED;

    // Giới hạn biên tỷ lệ ăn được từ 0% đến 100%
    edible = Decimal.max(this.ZERO, Decimal.min(this.ONE_HUNDRED, edible));

    return rawWeight.times(edible.dividedBy(this.ONE_HUNDRED));
  }

  /**
   * Tính Available Carbohydrate chuẩn FAO (Carbohydrate khả dụng):
   * Carb = max(0, 100 - (Water + Protein + Fat + Ash + Fiber))
   * BẮT BUỘC TRỪ FIBER (Chất xơ) theo đúng chuẩn FAO/WHO và Viện Dinh Dưỡng Quốc Gia (NIN).
   */
  public static calculateCarbohydrate(
    paramOrWater: CalculateCarbohydrateParamDto | unknown,
    legacyProtein?: unknown,
    legacyFat?: unknown,
    legacyAsh?: unknown,
    legacyFiber?: unknown,
  ): Decimal {
    let water: unknown;
    let protein: unknown;
    let fat: unknown;
    let ash: unknown;
    let fiber: unknown;

    if (
      paramOrWater &&
      typeof paramOrWater === 'object' &&
      !(paramOrWater instanceof Decimal) &&
      'water' in paramOrWater &&
      'protein' in paramOrWater
    ) {
      const dto = paramOrWater as CalculateCarbohydrateParamDto;
      water = dto.water;
      protein = dto.protein;
      fat = dto.fat;
      ash = dto.ash;
      fiber = dto.fiber;
    } else {
      water = paramOrWater;
      protein = legacyProtein;
      fat = legacyFat;
      ash = legacyAsh;
      fiber = legacyFiber;
    }

    const w = Decimal.max(this.ZERO, this.toDecimal(water, 0));
    const p = Decimal.max(this.ZERO, this.toDecimal(protein, 0));
    const f = Decimal.max(this.ZERO, this.toDecimal(fat, 0));
    const a = Decimal.max(this.ZERO, this.toDecimal(ash, 0));
    const fib = Decimal.max(this.ZERO, this.toDecimal(fiber, 0));

    const proximateSum = w.plus(p).plus(f).plus(a).plus(fib);
    return Decimal.max(this.ZERO, this.ONE_HUNDRED.minus(proximateSum));
  }

  /**
   * Tính Năng lượng Atwater chuẩn hóa:
   * Energy (kcal) = (4 * Protein) + (9 * Fat) + (4 * AvailableCarb)
   */
  public static calculateEnergy(
    paramOrProtein: CalculateEnergyParamDto | unknown,
    legacyFat?: unknown,
    legacyCarbohydrate?: unknown,
  ): Decimal {
    let protein: unknown;
    let fat: unknown;
    let carbohydrate: unknown;

    if (
      paramOrProtein &&
      typeof paramOrProtein === 'object' &&
      !(paramOrProtein instanceof Decimal) &&
      'protein' in paramOrProtein &&
      'fat' in paramOrProtein
    ) {
      const dto = paramOrProtein as CalculateEnergyParamDto;
      protein = dto.protein;
      fat = dto.fat;
      carbohydrate = dto.carbohydrate;
    } else {
      protein = paramOrProtein;
      fat = legacyFat;
      carbohydrate = legacyCarbohydrate;
    }

    const p = Decimal.max(this.ZERO, this.toDecimal(protein, 0));
    const f = Decimal.max(this.ZERO, this.toDecimal(fat, 0));
    const c = Decimal.max(this.ZERO, this.toDecimal(carbohydrate, 0));

    const pKcal = p.times(this.ATWATER_PROTEIN);
    const fKcal = f.times(this.ATWATER_FAT);
    const cKcal = c.times(this.ATWATER_CARB);

    return pKcal.plus(fKcal).plus(cKcal);
  }

  /**
   * Tính Vitamin A RAE (Retinol Activity Equivalent) theo FAO/WHO:
   * RAE = Retinol + (Beta-Carotene / 12) + (Alpha-Carotene / 24) + (Beta-Cryptoxanthin / 24)
   */
  public static calculateVitaminARae(
    paramOrRetinol: CalculateVitaminARaeParamDto | unknown,
    legacyBetaCarotene?: unknown,
    legacyAlphaCarotene?: unknown,
    legacyBetaCryptoxanthin?: unknown,
  ): Decimal {
    let retinol: unknown;
    let betaCarotene: unknown;
    let alphaCarotene: unknown;
    let betaCryptoxanthin: unknown;

    if (
      paramOrRetinol &&
      typeof paramOrRetinol === 'object' &&
      !(paramOrRetinol instanceof Decimal) &&
      'retinol' in paramOrRetinol
    ) {
      const dto = paramOrRetinol as CalculateVitaminARaeParamDto;
      retinol = dto.retinol;
      betaCarotene = dto.betaCarotene;
      alphaCarotene = dto.alphaCarotene;
      betaCryptoxanthin = dto.betaCryptoxanthin;
    } else {
      retinol = paramOrRetinol;
      betaCarotene = legacyBetaCarotene;
      alphaCarotene = legacyAlphaCarotene;
      betaCryptoxanthin = legacyBetaCryptoxanthin;
    }

    const ret = Decimal.max(this.ZERO, this.toDecimal(retinol, 0));
    const beta = Decimal.max(this.ZERO, this.toDecimal(betaCarotene, 0));
    const alpha = Decimal.max(this.ZERO, this.toDecimal(alphaCarotene, 0));
    const crypto = Decimal.max(this.ZERO, this.toDecimal(betaCryptoxanthin, 0));

    const betaPart = beta.dividedBy(this.RAE_BETA_CAROTENE_DIV);
    const alphaPart = alpha.dividedBy(this.RAE_ALPHA_CAROTENE_DIV);
    const cryptoPart = crypto.dividedBy(this.RAE_BETA_CRYPTOXANTHIN_DIV);

    return ret.plus(betaPart).plus(alphaPart).plus(cryptoPart);
  }

  /**
   * Trích xuất giá trị chỉ tiêu dinh dưỡng từ đối tượng nguyên liệu (hỗ trợ nhiều format khác nhau)
   * Sử dụng Static Map tra cứu O(1), loại bỏ hoàn toàn Java Reflection
   */
  public static extractNutrientValue(
    paramOrSource: ExtractNutrientValueParamDto | RawIngredientInput,
    legacyCode?: AllIndicatorCode,
  ): Decimal {
    let source: RawIngredientInput;
    let code: AllIndicatorCode;

    if (
      paramOrSource &&
      typeof paramOrSource === 'object' &&
      'source' in paramOrSource &&
      'code' in paramOrSource
    ) {
      const dto = paramOrSource as ExtractNutrientValueParamDto;
      source = dto.source;
      code = dto.code;
    } else {
      source = paramOrSource as RawIngredientInput;
      code = legacyCode!;
    }
    // 1. Kiểm tra trực tiếp trên root object
    if (source[code] !== undefined && source[code] !== null && source[code] !== '') {
      return this.toDecimal(source[code], 0);
    }

    // 2. Kiểm tra trong sub-object nutrients (nếu có)
    if (
      source.nutrients &&
      source.nutrients[code] !== undefined &&
      source.nutrients[code] !== null &&
      source.nutrients[code] !== ''
    ) {
      return this.toDecimal(source.nutrients[code], 0);
    }

    // 3. Tra cứu ngược qua Aliases
    for (const [alias, targetCode] of Object.entries(NUTRIENT_ALIASES)) {
      if (targetCode === code) {
        if (source[alias] !== undefined && source[alias] !== null && source[alias] !== '') {
          return this.toDecimal(source[alias], 0);
        }
        if (
          source.nutrients &&
          source.nutrients[alias] !== undefined &&
          source.nutrients[alias] !== null &&
          source.nutrients[alias] !== ''
        ) {
          return this.toDecimal(source.nutrients[alias], 0);
        }
      }
    }

    return this.ZERO;
  }

  /**
   * Tính toán dinh dưỡng đầy đủ của 1 nguyên liệu theo khối lượng thực tế
   * Bảo toàn nguyên vẹn Decimal qua mọi bước, tuyệt đối KHÔNG làm tròn non
   */
  public static calculateIngredientNutrients(
    paramOrIngredient: CalculateIngredientNutrientsParamDto | RawIngredientInput,
    legacyWeightGrams?: unknown,
    legacyOptions: CalculationOptions = {},
  ): DetailedNutrientResult {
    let ingredient: RawIngredientInput;
    let weightGrams: unknown;
    let options: CalculationOptions;

    if (
      paramOrIngredient &&
      typeof paramOrIngredient === 'object' &&
      'ingredient' in paramOrIngredient
    ) {
      const dto = paramOrIngredient as CalculateIngredientNutrientsParamDto;
      ingredient = dto.ingredient;
      weightGrams = dto.weightGrams;
      options = dto.options || {};
    } else {
      ingredient = paramOrIngredient as RawIngredientInput;
      weightGrams = legacyWeightGrams;
      options = legacyOptions;
    }

    const rawWeight = Decimal.max(this.ZERO, this.toDecimal(weightGrams, 0));
    const edibleRate =
      ingredient.edible !== undefined && ingredient.edible !== null
        ? this.toDecimal(ingredient.edible, 100)
        : ingredient.edibleRate !== undefined && ingredient.edibleRate !== null
          ? this.toDecimal(ingredient.edibleRate, 100)
          : this.ONE_HUNDRED;

    const netWeight = this.calculateNetWeight(rawWeight, edibleRate, options.isNetWeight);

    // Hệ số nhân theo khối lượng ăn được (chuẩn 100g)
    const factor = netWeight.dividedBy(this.ONE_HUNDRED);

    const decimalMap: DecimalMap = {};

    // 1. Trích xuất 77 chỉ tiêu cơ sở tính trên 100g
    for (const code of BASE_NUTRIENT_CODES) {
      const valPer100g = this.extractNutrientValue({ source: ingredient, code });
      decimalMap[code] = valPer100g.times(factor);
    }

    // 2. Tính Available Carbohydrate chuẩn FAO
    const waterPer100 = this.extractNutrientValue({ source: ingredient, code: 'water' });
    const proteinPer100 = this.extractNutrientValue({ source: ingredient, code: 'protein' });
    const fatPer100 = this.extractNutrientValue({ source: ingredient, code: 'fat' });
    const ashPer100 = this.extractNutrientValue({ source: ingredient, code: 'ash' });
    const fiberPer100 = this.extractNutrientValue({ source: ingredient, code: 'fiber' });

    const carbPer100 = this.calculateCarbohydrate({
      water: waterPer100,
      protein: proteinPer100,
      fat: fatPer100,
      ash: ashPer100,
      fiber: fiberPer100,
    });
    decimalMap.carbohydrate = carbPer100.times(factor);

    // 3. Tính Năng lượng Atwater chuẩn
    const energyPer100 = this.calculateEnergy({
      protein: proteinPer100,
      fat: fatPer100,
      carbohydrate: carbPer100,
    });
    decimalMap.energy = energyPer100.times(factor);

    // 4. Tính Vitamin A RAE chuẩn FAO/WHO
    const retinolPer100 = this.extractNutrientValue({ source: ingredient, code: 'retinol' });
    const betaCarotenePer100 = this.extractNutrientValue({
      source: ingredient,
      code: 'betaCarotene',
    });
    const alphaCarotenePer100 = this.extractNutrientValue({
      source: ingredient,
      code: 'alphaCarotene',
    });
    const betaCryptoxanthinPer100 = this.extractNutrientValue({
      source: ingredient,
      code: 'betaCryptoxanthin',
    });

    const raePer100 = this.calculateVitaminARae({
      retinol: retinolPer100,
      betaCarotene: betaCarotenePer100,
      alphaCarotene: alphaCarotenePer100,
      betaCryptoxanthin: betaCryptoxanthinPer100,
    });
    decimalMap.vitaminARae = raePer100.times(factor);

    // 5. Phân loại nguồn gốc Động vật / Thực vật
    const proteinType = String(
      ingredient.loai_protein || ingredient.loaiProtein || ingredient.proteinType || '',
    )
      .trim()
      .toUpperCase();

    const actualProtein = decimalMap.protein || this.ZERO;
    const actualFat = decimalMap.fat || this.ZERO;

    if (proteinType === 'DONG_VAT' || proteinType === 'ANIMAL') {
      decimalMap.proteinAnimal = actualProtein;
      decimalMap.proteinPlant = this.ZERO;
      decimalMap.fatAnimal = actualFat;
      decimalMap.fatPlant = this.ZERO;
      decimalMap.animalProteinRatio = actualProtein.isPositive() ? this.ONE_HUNDRED : this.ZERO;
      decimalMap.animalFatRatio = actualFat.isPositive() ? this.ONE_HUNDRED : this.ZERO;
    } else if (proteinType === 'THUC_VAT' || proteinType === 'PLANT') {
      decimalMap.proteinAnimal = this.ZERO;
      decimalMap.proteinPlant = actualProtein;
      decimalMap.fatAnimal = this.ZERO;
      decimalMap.fatPlant = actualFat;
      decimalMap.animalProteinRatio = this.ZERO;
      decimalMap.animalFatRatio = this.ZERO;
    } else {
      decimalMap.proteinAnimal = this.ZERO;
      decimalMap.proteinPlant = this.ZERO;
      decimalMap.fatAnimal = this.ZERO;
      decimalMap.fatPlant = this.ZERO;
      decimalMap.animalProteinRatio = this.ZERO;
      decimalMap.animalFatRatio = this.ZERO;
    }

    // 6. Tính tỷ lệ phân bổ năng lượng FAO/WHO (P:L:C %)
    const actualEnergy = decimalMap.energy || this.ZERO;
    if (actualEnergy.greaterThan(this.ZERO)) {
      decimalMap.proteinRatio = actualProtein
        .times(this.ATWATER_PROTEIN)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
      decimalMap.lipidRatio = actualFat
        .times(this.ATWATER_FAT)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
      decimalMap.carbohydrateRatio = (decimalMap.carbohydrate || this.ZERO)
        .times(this.ATWATER_CARB)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
    } else {
      decimalMap.proteinRatio = this.ZERO;
      decimalMap.lipidRatio = this.ZERO;
      decimalMap.carbohydrateRatio = this.ZERO;
    }

    const result: DetailedNutrientResult = {
      rawWeightGrams: rawWeight,
      netWeightGrams: netWeight,
      edibleRate,
      nutrients: decimalMap,
    };

    if (!options.preserveDecimals) {
      result.roundedNutrients = this.roundDecimalMap(decimalMap, options.targetDecimalPlaces ?? 2);
    }

    return result;
  }

  /**
   * Tích lũy (cộng dồn) các bản đồ vi chất Decimal mà không làm tròn sớm
   * Tránh hoàn toàn việc xóa sổ các vi chất lượng vết (Trace Minerals / Vitamins)
   */
  public static accumulateNutrients(
    paramOrTarget: AccumulateNutrientsParamDto | DecimalMap,
    legacySource?: DecimalMap,
  ): DecimalMap {
    let target: DecimalMap;
    let source: DecimalMap;

    if (
      paramOrTarget &&
      typeof paramOrTarget === 'object' &&
      'target' in paramOrTarget &&
      'source' in paramOrTarget
    ) {
      const dto = paramOrTarget as AccumulateNutrientsParamDto;
      target = dto.target;
      source = dto.source;
    } else {
      target = paramOrTarget as DecimalMap;
      source = legacySource!;
    }

    for (const code of ALL_INDICATOR_CODES) {
      const srcVal = source[code];
      if (srcVal && !srcVal.isZero()) {
        target[code] = (target[code] || this.ZERO).plus(srcVal);
      }
    }

    // Tái tính toán các tỷ lệ phụ thuộc sau khi gộp
    this.recalculateDerivedRatios(target);
    return target;
  }

  /**
   * Tái tính toán tỷ lệ động (P:L:C % và Tỷ lệ đạm/béo động vật) từ tổng số tích lũy
   */
  public static recalculateDerivedRatios(accumulated: DecimalMap): void {
    const energy = accumulated.energy || this.ZERO;
    const protein = accumulated.protein || this.ZERO;
    const fat = accumulated.fat || this.ZERO;
    const carb = accumulated.carbohydrate || this.ZERO;
    const pAnimal = accumulated.proteinAnimal || this.ZERO;
    const fAnimal = accumulated.fatAnimal || this.ZERO;

    if (energy.greaterThan(this.ZERO)) {
      accumulated.proteinRatio = protein
        .times(this.ATWATER_PROTEIN)
        .times(this.ONE_HUNDRED)
        .dividedBy(energy);
      accumulated.lipidRatio = fat
        .times(this.ATWATER_FAT)
        .times(this.ONE_HUNDRED)
        .dividedBy(energy);
      accumulated.carbohydrateRatio = carb
        .times(this.ATWATER_CARB)
        .times(this.ONE_HUNDRED)
        .dividedBy(energy);
    } else {
      accumulated.proteinRatio = this.ZERO;
      accumulated.lipidRatio = this.ZERO;
      accumulated.carbohydrateRatio = this.ZERO;
    }

    if (protein.greaterThan(this.ZERO)) {
      accumulated.animalProteinRatio = pAnimal.times(this.ONE_HUNDRED).dividedBy(protein);
    } else {
      accumulated.animalProteinRatio = this.ZERO;
    }

    if (fat.greaterThan(this.ZERO)) {
      accumulated.animalFatRatio = fAnimal.times(this.ONE_HUNDRED).dividedBy(fat);
    } else {
      accumulated.animalFatRatio = this.ZERO;
    }
  }

  /**
   * Tạo một bản sao DecimalMap rỗng (khởi tạo 0)
   */
  public static createEmptyDecimalMap(): DecimalMap {
    const map: DecimalMap = {};
    for (const code of ALL_INDICATOR_CODES) {
      map[code] = this.ZERO;
    }
    return map;
  }

  /**
   * Làm tròn DecimalMap ở biên Presentation Layer (mặc định 2 chữ số thập phân)
   */
  public static roundDecimalMap(
    paramOrMap: RoundDecimalMapParamDto | DecimalMap,
    legacyDecimalPlaces = 2,
  ): RoundedNutrientMap {
    let map: DecimalMap;
    let decimalPlaces: number;

    if (paramOrMap && typeof paramOrMap === 'object' && 'map' in paramOrMap) {
      const dto = paramOrMap as RoundDecimalMapParamDto;
      map = dto.map;
      decimalPlaces = dto.decimalPlaces ?? 2;
    } else {
      map = paramOrMap as DecimalMap;
      decimalPlaces = legacyDecimalPlaces;
    }

    const result: RoundedNutrientMap = {};
    for (const [code, decVal] of Object.entries(map)) {
      if (decVal instanceof Decimal) {
        result[code as AllIndicatorCode] = decVal
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber();
      }
    }
    return result;
  }
}
