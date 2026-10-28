import Decimal from 'decimal.js';
import {
  ATWATER_FACTORS,
  BASE_NUTRIENT_CODES,
} from '../../../core/nutrition-engine/nutrition.constants';
import {
  DecimalMap,
  NutritionEngine,
  RawIngredientInput,
  RoundedNutrientMap,
} from '../../../core/nutrition-engine/nutrition.engine';
import { IntakeInputType } from '../../../config/enums/domain.enum';

// Khởi tạo cấu hình Decimal chính xác 20 chữ số và làm tròn ROUND_HALF_UP (chuẩn y khoa)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface IntakeCalculationOptions {
  isNetWeight?: boolean; // Nếu true: coi rawWeight đã là khối lượng sạch
  targetDecimalPlaces?: number; // Mặc định 2 chữ số thập phân
  preserveDecimals?: boolean; // Giữ nguyên DecimalMap cho downstream engines (RDA)
}

export interface IntakeIngredientItemInput {
  ingredientId?: number | bigint | string | null;
  ingredientName?: string | null;
  ten_nguyen_lieu?: string | null;
  category?: string | null;
  danh_muc?: number | string | null;
  rawWeight: number | string | Decimal; // Khối lượng ban đầu (g)
  edible?: number | string | Decimal | null; // Tỷ lệ ăn được (%) - VD: chuối 75%, dưa hấu 54%
  isNetWeight?: boolean; // Đã là khối lượng ăn được
  retentionFactor?: number | string | Decimal | null; // Hệ số giữ lại sau chế biến (0 - 1.0)
  loai_protein?: 'DONG_VAT' | 'THUC_VAT' | string | null;
  loaiProtein?: string | null;
  [key: string]: any;
}

export interface IntakeDishComponentItemInput {
  ingredientId?: number | bigint | string | null;
  rawWeight: number | string | Decimal;
  edible?: number | string | Decimal | null;
  isNetWeight?: boolean;
  retentionFactor?: number | string | Decimal | null;
  ingredient?: RawIngredientInput | null;
  nguyen_lieu?: RawIngredientInput | null;
  [key: string]: any;
}

export interface IntakeDishItemInput {
  id?: number | bigint | string | null;
  dishId?: number | bigint | string | null;
  dishName?: string | null;
  ten_mon?: string | null;
  quantity?: number; // Số suất / phần ăn (mặc định 1)
  retentionFactor?: number | string | Decimal | null; // Hệ số chế biến của món
  components?: IntakeDishComponentItemInput[] | null;
  chi_tiet_mon_an?: IntakeDishComponentItemInput[] | null;
  [key: string]: any;
}

export interface IntakeMealItemInput {
  type?: 'INGREDIENT' | 'DISH';
  ingredientId?: number | bigint | string | null;
  dishId?: number | bigint | string | null;
  dish?: IntakeDishItemInput | null;
  mon_an?: IntakeDishItemInput | null;
  rawWeight?: number | string | Decimal | null;
  edible?: number | string | Decimal | null;
  isNetWeight?: boolean;
  retentionFactor?: number | string | Decimal | null;
  ingredient?: RawIngredientInput | null;
  nguyen_lieu?: RawIngredientInput | null;
  [key: string]: any;
}

export interface IntakeMealInput {
  mealId?: number | bigint | string | null;
  mealOrder: number; // 1, 2, 3, 4
  mealName: string; // 'Bữa sáng', 'Bữa trưa', 'Bữa tối', 'Bữa phụ'
  mealTime?: string | null; // '07:00', '12:00', '18:30'
  items: IntakeMealItemInput[];
}

export interface ByMealCalculationInput {
  mode: IntakeInputType.BY_MEAL | 'BY_MEAL';
  meals: IntakeMealInput[];
  options?: IntakeCalculationOptions;
}

export interface IngredientOnlyCalculationInput {
  mode: IntakeInputType.INGREDIENT_ONLY | 'INGREDIENT_ONLY';
  ingredients: IntakeIngredientItemInput[];
  options?: IntakeCalculationOptions;
}

export type DailyIntakeCalculationInput = ByMealCalculationInput | IngredientOnlyCalculationInput;

export interface CalculatedIngredientDetail {
  ingredientId?: number | bigint | string | null;
  ingredientName: string;
  category?: string;
  rawWeightGrams: number;
  netWeightGrams: number;
  edibleRate: number;
  retentionFactor: number;
  // So sánh với công thức Java cũ (bỏ qua edible) để kiểm chứng lâm sàng
  legacyJavaRatio: number;
  clinicalNetRatio: number;
  edibleDiscrepancyPercent: number; // % sai lệch nếu dùng code Java cũ
  nutrients: RoundedNutrientMap;
  decimalNutrients?: DecimalMap;
}

export interface CalculatedDishDetail {
  dishId?: number | bigint | string | null;
  dishName: string;
  quantity: number;
  rawWeightGrams: number;
  netWeightGrams: number;
  energyKcal: number;
  nutrients: RoundedNutrientMap;
  decimalNutrients?: DecimalMap;
  ingredients: CalculatedIngredientDetail[];
}

export interface CalculatedMealDetail {
  mealId?: number | bigint | string | null;
  mealOrder: number;
  mealName: string;
  mealTime?: string | null;
  rawWeightGrams: number;
  netWeightGrams: number;
  energyKcal: number;
  energyPercentOfDaily: number; // % năng lượng đóng góp cho cả ngày
  nutrients: RoundedNutrientMap;
  decimalNutrients?: DecimalMap;
  items: Array<{
    type: 'INGREDIENT' | 'DISH';
    ingredient?: CalculatedIngredientDetail;
    dish?: CalculatedDishDetail;
  }>;
}

export interface DailyIntakeCalculationResult {
  mode: 'BY_MEAL' | 'INGREDIENT_ONLY';
  totalRawWeightGrams: number;
  totalNetWeightGrams: number;
  totalEnergyKcal: number;
  nutrients: RoundedNutrientMap;
  decimalNutrients?: DecimalMap;
  macroRatios: {
    proteinPercent: number; // P% năng lượng
    lipidPercent: number; // L% năng lượng
    carbohydratePercent: number; // C% năng lượng
    animalProteinPercent: number; // % Đạm động vật / tổng đạm
    animalFatPercent: number; // % Béo động vật / tổng béo
  };
  meals?: CalculatedMealDetail[]; // Chỉ có trong mode BY_MEAL
  ingredients?: CalculatedIngredientDetail[]; // Chỉ có trong mode INGREDIENT_ONLY
}

export class IntakeToDecimalParamDto {
  val: unknown;
  fallback?: number;
}

export class IntakeCalculateNetWeightParamDto {
  rawWeightInput: unknown;
  edibleInput?: unknown;
  isNetWeight?: boolean;
}

export class IntakeCalculateNutrientValueParamDto {
  nutrientPer100g: unknown;
  netWeightGrams: Decimal;
  retentionFactor?: unknown;
}

export class IntakeCalculateIngredientParamDto {
  ingredient: IntakeIngredientItemInput;
  rawWeightInput?: unknown;
  options?: IntakeCalculationOptions;
}

export class IntakeCalculateDishParamDto {
  dish: IntakeDishItemInput;
  options?: IntakeCalculationOptions;
}

/**
 * PURE INTAKE CALCULATION ENGINE
 * Động cơ tính toán dinh dưỡng khẩu phần 24h chuẩn Bộ Y Tế & Viện Dinh Dưỡng
 * Khắc phục triệt để lỗ hổng bỏ quên tỷ lệ ăn được (edible) của code Spring Boot Java cũ.
 */
export class IntakeCalculationEngine {
  private static readonly ZERO = new Decimal(0);
  private static readonly ONE_HUNDRED = new Decimal(100);
  private static readonly ONE = new Decimal(1);

  /**
   * Chuyển đổi an toàn giá trị bất kỳ sang Decimal (Tái sử dụng NutritionEngine - DRY D1)
   */
  public static toDecimal(
    paramOrVal: IntakeToDecimalParamDto | unknown,
    legacyFallback = 0,
  ): Decimal {
    if (
      paramOrVal &&
      typeof paramOrVal === 'object' &&
      !(paramOrVal instanceof Decimal) &&
      'val' in paramOrVal
    ) {
      const dto = paramOrVal as IntakeToDecimalParamDto;
      return NutritionEngine.toDecimal({ val: dto.val, fallback: dto.fallback ?? 0 });
    }
    return NutritionEngine.toDecimal({ val: paramOrVal, fallback: legacyFallback });
  }

  /**
   * CÔNG THỨC CHUẨN BỘ Y TẾ (Tái sử dụng NutritionEngine - DRY D1)
   * Tính khối lượng thực tế ăn được (Net Weight):
   * netWeight = rawWeight * (edible / 100)
   */
  public static calculateNetWeight(
    paramOrRawWeight: IntakeCalculateNetWeightParamDto | unknown,
    legacyEdibleInput?: unknown,
    legacyIsNetWeight = false,
  ): Decimal {
    if (
      paramOrRawWeight &&
      typeof paramOrRawWeight === 'object' &&
      !(paramOrRawWeight instanceof Decimal) &&
      'rawWeightInput' in paramOrRawWeight
    ) {
      const dto = paramOrRawWeight as IntakeCalculateNetWeightParamDto;
      return NutritionEngine.calculateNetWeight(
        dto.rawWeightInput,
        dto.edibleInput,
        dto.isNetWeight || false,
      );
    }
    return NutritionEngine.calculateNetWeight(
      paramOrRawWeight,
      legacyEdibleInput,
      legacyIsNetWeight,
    );
  }

  /**
   * CÔNG THỨC 86 CHỈ TIÊU VI CHẤT CHUẨN BỘ Y TẾ / VIỆN DINH DƯỠNG:
   * nutrientValue = (nutrientPer100g / 100) * netWeight * (retentionFactor ?? 1.0)
   *
   * @param nutrientPer100g Giá trị vi chất trên 100g phần ăn được
   * @param netWeightGrams Khối lượng sạch thực tế (g)
   * @param retentionFactor Hệ số lưu giữ vi chất sau chế biến (0 - 1.0, mặc định 1.0)
   */
  public static calculateNutrientValue(
    paramOrPer100: IntakeCalculateNutrientValueParamDto | unknown,
    legacyNetWeightGrams?: Decimal,
    legacyRetentionFactor: unknown = 1.0,
  ): Decimal {
    let nutrientPer100g: unknown;
    let netWeightGrams: Decimal;
    let retentionFactor: unknown;

    if (
      paramOrPer100 &&
      typeof paramOrPer100 === 'object' &&
      !(paramOrPer100 instanceof Decimal) &&
      'nutrientPer100g' in paramOrPer100
    ) {
      const dto = paramOrPer100 as IntakeCalculateNutrientValueParamDto;
      nutrientPer100g = dto.nutrientPer100g;
      netWeightGrams = dto.netWeightGrams;
      retentionFactor = dto.retentionFactor;
    } else {
      nutrientPer100g = paramOrPer100;
      netWeightGrams = legacyNetWeightGrams!;
      retentionFactor = legacyRetentionFactor;
    }

    const per100 = this.toDecimal(nutrientPer100g, 0);
    const retention =
      retentionFactor !== undefined && retentionFactor !== null && retentionFactor !== ''
        ? Decimal.max(this.ZERO, this.toDecimal(retentionFactor, 1.0))
        : this.ONE;

    const factor = netWeightGrams.dividedBy(this.ONE_HUNDRED);
    return per100.times(factor).times(retention);
  }

  /**
   * Tính toán dinh dưỡng chi tiết cho 1 nguyên liệu đơn lẻ
   */
  public static calculateIngredient(
    paramOrIngredient: IntakeCalculateIngredientParamDto | IntakeIngredientItemInput,
    legacyRawWeightInput?: unknown,
    legacyOptions: IntakeCalculationOptions = {},
  ): CalculatedIngredientDetail {
    let ingredient: IntakeIngredientItemInput;
    let rawWeightInput: unknown;
    let options: IntakeCalculationOptions;

    if (
      paramOrIngredient &&
      typeof paramOrIngredient === 'object' &&
      'ingredient' in paramOrIngredient
    ) {
      const dto = paramOrIngredient as IntakeCalculateIngredientParamDto;
      ingredient = dto.ingredient;
      rawWeightInput = dto.rawWeightInput;
      options = dto.options || {};
    } else {
      ingredient = paramOrIngredient as IntakeIngredientItemInput;
      rawWeightInput = legacyRawWeightInput;
      options = legacyOptions;
    }
    const rawWeightVal = rawWeightInput !== undefined ? rawWeightInput : ingredient.rawWeight;
    const rawWeight = Decimal.max(this.ZERO, this.toDecimal(rawWeightVal, 0));

    const isNetWeight = options.isNetWeight || Boolean(ingredient.isNetWeight);
    const edibleRate =
      ingredient.edible !== undefined && ingredient.edible !== null && ingredient.edible !== ''
        ? Decimal.max(
            this.ZERO,
            Decimal.min(this.ONE_HUNDRED, this.toDecimal(ingredient.edible, 100)),
          )
        : this.ONE_HUNDRED;

    const netWeight = this.calculateNetWeight(rawWeight, edibleRate, isNetWeight);

    const retentionFactor =
      ingredient.retentionFactor !== undefined &&
      ingredient.retentionFactor !== null &&
      ingredient.retentionFactor !== ''
        ? Decimal.max(this.ZERO, this.toDecimal(ingredient.retentionFactor, 1.0))
        : this.ONE;

    const factor = netWeight.dividedBy(this.ONE_HUNDRED);

    // Tính toán tỷ lệ sai lệch so với code Java cũ
    // Java cũ: ratio = rawWeight / 100.0 (BỎ QUÊN edible)
    const legacyJavaRatio = rawWeight.dividedBy(this.ONE_HUNDRED);
    const clinicalNetRatio = factor;
    let edibleDiscrepancyPercent = this.ZERO;
    if (clinicalNetRatio.greaterThan(this.ZERO)) {
      edibleDiscrepancyPercent = legacyJavaRatio
        .minus(clinicalNetRatio)
        .dividedBy(clinicalNetRatio)
        .times(this.ONE_HUNDRED);
    }

    const decimalMap: DecimalMap = {};

    // 1. Tính toán 77 chỉ tiêu cơ sở
    for (const code of BASE_NUTRIENT_CODES) {
      const valPer100g = NutritionEngine.extractNutrientValue({ source: ingredient, code });
      decimalMap[code] = valPer100g.times(factor).times(retentionFactor);
    }

    // 2. Tính Carbohydrate khả dụng chuẩn FAO:
    // Available Carb = max(0, 100 - (Water + Protein + Fat + Ash + Fiber))
    const waterPer100 = NutritionEngine.extractNutrientValue({ source: ingredient, code: 'water' });
    const proteinPer100 = NutritionEngine.extractNutrientValue({
      source: ingredient,
      code: 'protein',
    });
    const fatPer100 = NutritionEngine.extractNutrientValue({ source: ingredient, code: 'fat' });
    const ashPer100 = NutritionEngine.extractNutrientValue({ source: ingredient, code: 'ash' });
    const fiberPer100 = NutritionEngine.extractNutrientValue({ source: ingredient, code: 'fiber' });

    const carbPer100 = NutritionEngine.calculateCarbohydrate({
      water: waterPer100,
      protein: proteinPer100,
      fat: fatPer100,
      ash: ashPer100,
      fiber: fiberPer100,
    });
    decimalMap.carbohydrate = carbPer100.times(factor).times(retentionFactor);

    // 3. Tính Năng lượng Atwater chuẩn hóa:
    // Energy (kcal) = (4 * Protein) + (9 * Fat) + (4 * AvailableCarb)
    const actualProtein = decimalMap.protein || this.ZERO;
    const actualFat = decimalMap.fat || this.ZERO;
    const actualCarb = decimalMap.carbohydrate || this.ZERO;

    decimalMap.energy = actualProtein
      .times(ATWATER_FACTORS.PROTEIN)
      .plus(actualFat.times(ATWATER_FACTORS.FAT))
      .plus(actualCarb.times(ATWATER_FACTORS.CARBOHYDRATE));

    // 4. Tính Vitamin A RAE (Retinol Activity Equivalent) theo FAO/WHO:
    // RAE = Retinol + (Beta-Carotene / 12) + (Alpha-Carotene / 24) + (Beta-Cryptoxanthin / 24)
    const retinolPer100 = NutritionEngine.extractNutrientValue({
      source: ingredient,
      code: 'retinol',
    });
    const betaCarotenePer100 = NutritionEngine.extractNutrientValue({
      source: ingredient,
      code: 'betaCarotene',
    });
    const alphaCarotenePer100 = NutritionEngine.extractNutrientValue({
      source: ingredient,
      code: 'alphaCarotene',
    });
    const betaCryptoxanthinPer100 = NutritionEngine.extractNutrientValue({
      source: ingredient,
      code: 'betaCryptoxanthin',
    });

    const raePer100 = NutritionEngine.calculateVitaminARae({
      retinol: retinolPer100,
      betaCarotene: betaCarotenePer100,
      alphaCarotene: alphaCarotenePer100,
      betaCryptoxanthin: betaCryptoxanthinPer100,
    });
    decimalMap.vitaminARae = raePer100.times(factor).times(retentionFactor);

    // 5. Phân loại nguồn gốc Động vật / Thực vật
    const proteinType = String(
      ingredient.loai_protein || ingredient.loaiProtein || ingredient.proteinType || '',
    )
      .trim()
      .toUpperCase();

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

    // 6. Phân bổ năng lượng P:L:C %
    const actualEnergy = decimalMap.energy || this.ZERO;
    if (actualEnergy.greaterThan(this.ZERO)) {
      decimalMap.proteinRatio = actualProtein
        .times(ATWATER_FACTORS.PROTEIN)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
      decimalMap.lipidRatio = actualFat
        .times(ATWATER_FACTORS.FAT)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
      decimalMap.carbohydrateRatio = actualCarb
        .times(ATWATER_FACTORS.CARBOHYDRATE)
        .times(this.ONE_HUNDRED)
        .dividedBy(actualEnergy);
    } else {
      decimalMap.proteinRatio = this.ZERO;
      decimalMap.lipidRatio = this.ZERO;
      decimalMap.carbohydrateRatio = this.ZERO;
    }

    const decimalPlaces = options.targetDecimalPlaces ?? 2;
    const roundedNutrients = NutritionEngine.roundDecimalMap({
      map: decimalMap,
      decimalPlaces,
    });

    const name =
      ingredient.ingredientName ||
      ingredient.ten_nguyen_lieu ||
      ingredient.name ||
      `Nguyên liệu #${ingredient.ingredientId ?? 'unknown'}`;

    return {
      ingredientId: ingredient.ingredientId ?? ingredient.id,
      ingredientName: name,
      category:
        ingredient.category || (ingredient.danh_muc ? String(ingredient.danh_muc) : undefined),
      rawWeightGrams: rawWeight.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber(),
      netWeightGrams: netWeight.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber(),
      edibleRate: edibleRate.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber(),
      retentionFactor: retentionFactor
        .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
        .toNumber(),
      legacyJavaRatio: legacyJavaRatio
        .toDecimalPlaces(decimalPlaces + 2, Decimal.ROUND_HALF_UP)
        .toNumber(),
      clinicalNetRatio: clinicalNetRatio
        .toDecimalPlaces(decimalPlaces + 2, Decimal.ROUND_HALF_UP)
        .toNumber(),
      edibleDiscrepancyPercent: edibleDiscrepancyPercent
        .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
        .toNumber(),
      nutrients: roundedNutrients,
      ...(options.preserveDecimals ? { decimalNutrients: decimalMap } : {}),
    };
  }

  /**
   * Tính toán dinh dưỡng cho một món ăn (Dish) bao gồm danh sách nguyên liệu
   */
  public static calculateDish(
    paramOrDish: IntakeCalculateDishParamDto | IntakeDishItemInput,
    legacyOptions: IntakeCalculationOptions = {},
  ): CalculatedDishDetail {
    let dish: IntakeDishItemInput;
    let options: IntakeCalculationOptions;

    if (paramOrDish && typeof paramOrDish === 'object' && 'dish' in paramOrDish) {
      const dto = paramOrDish as IntakeCalculateDishParamDto;
      dish = dto.dish;
      options = dto.options || {};
    } else {
      dish = paramOrDish as IntakeDishItemInput;
      options = legacyOptions;
    }

    const quantity = dish.quantity !== undefined && dish.quantity > 0 ? dish.quantity : 1;
    const qtyDecimal = new Decimal(quantity);
    const dishRetention =
      dish.retentionFactor !== undefined && dish.retentionFactor !== null
        ? this.toDecimal(dishRetentionFactor(dish.retentionFactor), 1.0)
        : this.ONE;

    const components = dish.components || dish.chi_tiet_mon_an || [];
    const calculatedIngredients: CalculatedIngredientDetail[] = [];
    const accumulatedNutrients = NutritionEngine.createEmptyDecimalMap();
    let totalRaw = this.ZERO;
    let totalNet = this.ZERO;

    for (const comp of components) {
      const ingSource = comp.ingredient || comp.nguyen_lieu || comp;
      const compRawWeight = this.toDecimal(comp.rawWeight ?? comp.khoi_luong_song_sach, 0).times(
        qtyDecimal,
      );

      const compRetention =
        comp.retentionFactor !== undefined && comp.retentionFactor !== null
          ? this.toDecimal(comp.retentionFactor, 1.0).times(dishRetention)
          : dishRetention;

      const ingDetail = this.calculateIngredient(
        {
          ...ingSource,
          ingredientId: comp.ingredientId ?? ingSource.id,
          rawWeight: compRawWeight,
          edible: comp.edible ?? ingSource.edible,
          isNetWeight: comp.isNetWeight ?? ingSource.isNetWeight,
          retentionFactor: compRetention,
        },
        compRawWeight,
        { ...options, preserveDecimals: true },
      );

      calculatedIngredients.push(ingDetail);
      totalRaw = totalRaw.plus(this.toDecimal(ingDetail.rawWeightGrams));
      totalNet = totalNet.plus(this.toDecimal(ingDetail.netWeightGrams));

      if (ingDetail.decimalNutrients) {
        NutritionEngine.accumulateNutrients({
          target: accumulatedNutrients,
          source: ingDetail.decimalNutrients,
        });
      }
    }

    NutritionEngine.recalculateDerivedRatios(accumulatedNutrients);
    const decimalPlaces = options.targetDecimalPlaces ?? 2;
    const roundedNutrients = NutritionEngine.roundDecimalMap({
      map: accumulatedNutrients,
      decimalPlaces,
    });

    return {
      dishId: dish.dishId ?? dish.id,
      dishName: dish.dishName || dish.ten_mon || `Món ăn #${dish.dishId ?? 'unknown'}`,
      quantity,
      rawWeightGrams: totalRaw.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber(),
      netWeightGrams: totalNet.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber(),
      energyKcal: (accumulatedNutrients.energy || this.ZERO)
        .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
        .toNumber(),
      nutrients: roundedNutrients,
      ingredients: calculatedIngredients,
      ...(options.preserveDecimals ? { decimalNutrients: accumulatedNutrients } : {}),
    };
  }

  /**
   * Tính toán khẩu phần 24h đầy đủ hỗ trợ cả 2 chế độ:
   * 1. BY_MEAL: Chia theo bữa ăn (Sáng, Trưa, Tối, Phụ)
   * 2. INGREDIENT_ONLY: Danh sách nguyên liệu trực tiếp
   */
  public static calculateDailyIntake(
    input: DailyIntakeCalculationInput,
  ): DailyIntakeCalculationResult {
    const mode = input.mode;
    const options: IntakeCalculationOptions = {
      targetDecimalPlaces: 2,
      preserveDecimals: true,
      ...(input.options || {}),
    };
    const decimalPlaces = options.targetDecimalPlaces ?? 2;

    const accumulatedTotalNutrients = NutritionEngine.createEmptyDecimalMap();
    let totalRawWeight = this.ZERO;
    let totalNetWeight = this.ZERO;

    if (String(mode) === IntakeInputType.BY_MEAL || String(mode) === 'BY_MEAL') {
      const mealInputs = (input as ByMealCalculationInput).meals || [];
      const calculatedMeals: CalculatedMealDetail[] = [];

      // 1. Tính toán chi tiết từng bữa ăn
      for (const meal of mealInputs) {
        const mealNutrients = NutritionEngine.createEmptyDecimalMap();
        let mealRawWeight = this.ZERO;
        let mealNetWeight = this.ZERO;

        const calculatedItems: CalculatedMealDetail['items'] = [];

        for (const item of meal.items || []) {
          if (item.type === 'DISH' || item.dish || item.mon_an) {
            const dishInput = item.dish || item.mon_an || item;
            const dishDetail = this.calculateDish(dishInput, options);

            calculatedItems.push({
              type: 'DISH',
              dish: dishDetail,
            });

            mealRawWeight = mealRawWeight.plus(this.toDecimal(dishDetail.rawWeightGrams));
            mealNetWeight = mealNetWeight.plus(this.toDecimal(dishDetail.netWeightGrams));

            if (dishDetail.decimalNutrients) {
              NutritionEngine.accumulateNutrients({
                target: mealNutrients,
                source: dishDetail.decimalNutrients,
              });
            }
          } else {
            // Nguyên liệu trực tiếp trong bữa
            const ingSource = item.ingredient || item.nguyen_lieu || item;
            const ingDetail = this.calculateIngredient(
              {
                ...ingSource,
                ingredientId: item.ingredientId ?? ingSource.id,
                rawWeight: item.rawWeight ?? ingSource.rawWeight,
                edible: item.edible ?? ingSource.edible,
                isNetWeight: item.isNetWeight ?? ingSource.isNetWeight,
                retentionFactor: item.retentionFactor ?? ingSource.retentionFactor,
              },
              item.rawWeight,
              options,
            );

            calculatedItems.push({
              type: 'INGREDIENT',
              ingredient: ingDetail,
            });

            mealRawWeight = mealRawWeight.plus(this.toDecimal(ingDetail.rawWeightGrams));
            mealNetWeight = mealNetWeight.plus(this.toDecimal(ingDetail.netWeightGrams));

            if (ingDetail.decimalNutrients) {
              NutritionEngine.accumulateNutrients({
                target: mealNutrients,
                source: ingDetail.decimalNutrients,
              });
            }
          }
        }

        NutritionEngine.recalculateDerivedRatios(mealNutrients);

        totalRawWeight = totalRawWeight.plus(mealRawWeight);
        totalNetWeight = totalNetWeight.plus(mealNetWeight);
        NutritionEngine.accumulateNutrients({
          target: accumulatedTotalNutrients,
          source: mealNutrients,
        });

        calculatedMeals.push({
          mealId: meal.mealId,
          mealOrder: meal.mealOrder,
          mealName: meal.mealName,
          mealTime: meal.mealTime,
          rawWeightGrams: mealRawWeight
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          netWeightGrams: mealNetWeight
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          energyKcal: (mealNutrients.energy || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          energyPercentOfDaily: 0, // Tính sau khi có tổng năng lượng cả ngày
          nutrients: NutritionEngine.roundDecimalMap({
            map: mealNutrients,
            decimalPlaces,
          }),
          items: calculatedItems,
          ...(options.preserveDecimals ? { decimalNutrients: mealNutrients } : {}),
        });
      }

      // 2. Tính tỷ lệ % năng lượng đóng góp của từng bữa ăn so với 24h
      const dailyEnergy = accumulatedTotalNutrients.energy || this.ZERO;
      for (const cm of calculatedMeals) {
        if (dailyEnergy.greaterThan(this.ZERO)) {
          const mEnergy = this.toDecimal(cm.energyKcal);
          cm.energyPercentOfDaily = mEnergy
            .times(this.ONE_HUNDRED)
            .dividedBy(dailyEnergy)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber();
        } else {
          cm.energyPercentOfDaily = 0;
        }
      }

      NutritionEngine.recalculateDerivedRatios(accumulatedTotalNutrients);
      const totalRoundedNutrients = NutritionEngine.roundDecimalMap({
        map: accumulatedTotalNutrients,
        decimalPlaces,
      });

      return {
        mode: 'BY_MEAL',
        totalRawWeightGrams: totalRawWeight
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        totalNetWeightGrams: totalNetWeight
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        totalEnergyKcal: dailyEnergy
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        nutrients: totalRoundedNutrients,
        decimalNutrients: accumulatedTotalNutrients,
        macroRatios: {
          proteinPercent: (accumulatedTotalNutrients.proteinRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          lipidPercent: (accumulatedTotalNutrients.lipidRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          carbohydratePercent: (accumulatedTotalNutrients.carbohydrateRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          animalProteinPercent: (accumulatedTotalNutrients.animalProteinRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          animalFatPercent: (accumulatedTotalNutrients.animalFatRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
        },
        meals: calculatedMeals,
      };
    } else {
      // INGREDIENT_ONLY Mode
      const ingredientInputs = (input as IngredientOnlyCalculationInput).ingredients || [];
      const calculatedIngredients: CalculatedIngredientDetail[] = [];

      for (const ing of ingredientInputs) {
        const detail = this.calculateIngredient(ing, undefined, options);
        calculatedIngredients.push(detail);

        totalRawWeight = totalRawWeight.plus(this.toDecimal(detail.rawWeightGrams));
        totalNetWeight = totalNetWeight.plus(this.toDecimal(detail.netWeightGrams));

        if (detail.decimalNutrients) {
          NutritionEngine.accumulateNutrients({
            target: accumulatedTotalNutrients,
            source: detail.decimalNutrients,
          });
        }
      }

      NutritionEngine.recalculateDerivedRatios(accumulatedTotalNutrients);
      const dailyEnergy = accumulatedTotalNutrients.energy || this.ZERO;
      const totalRoundedNutrients = NutritionEngine.roundDecimalMap({
        map: accumulatedTotalNutrients,
        decimalPlaces,
      });

      return {
        mode: 'INGREDIENT_ONLY',
        totalRawWeightGrams: totalRawWeight
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        totalNetWeightGrams: totalNetWeight
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        totalEnergyKcal: dailyEnergy
          .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
          .toNumber(),
        nutrients: totalRoundedNutrients,
        decimalNutrients: accumulatedTotalNutrients,
        macroRatios: {
          proteinPercent: (accumulatedTotalNutrients.proteinRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          lipidPercent: (accumulatedTotalNutrients.lipidRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          carbohydratePercent: (accumulatedTotalNutrients.carbohydrateRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          animalProteinPercent: (accumulatedTotalNutrients.animalProteinRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
          animalFatPercent: (accumulatedTotalNutrients.animalFatRatio || this.ZERO)
            .toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
            .toNumber(),
        },
        ingredients: calculatedIngredients,
      };
    }
  }
}

function dishRetentionFactor(val: unknown): Decimal {
  if (val === null || val === undefined || val === '') return new Decimal(1.0);
  try {
    return Decimal.max(0, new Decimal(String(val)));
  } catch {
    return new Decimal(1.0);
  }
}
