import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ALL_INDICATOR_CODES } from './nutrition.constants';
import {
  CalculationOptions,
  DecimalMap,
  NutritionEngine,
  RawIngredientInput,
  RoundedNutrientMap,
} from './nutrition.engine';

export interface DishIngredientItem {
  ingredientId?: number | bigint | string | null;
  weightGrams?: number | string | Decimal | null;
  netWeight?: number | string | Decimal | null;
  khoi_luong_song_sach?: number | string | Decimal | null;
  isNetWeight?: boolean;
  ingredient?: RawIngredientInput | null;
  nguyen_lieu?: RawIngredientInput | null;
  nutrients?: RoundedNutrientMap | null;
  decimalNutrients?: DecimalMap | null;
}

export interface DishInput {
  id?: number | bigint | string | null;
  name?: string | null;
  ten_mon?: string | null;
  he_so_song_chin?: number | string | Decimal | null;
  details?: DishIngredientItem[] | null;
  chi_tiet_mon_an?: DishIngredientItem[] | null;
}

export interface MealDishItem {
  dishId?: number | bigint | string | null;
  dish?: DishInput | null;
  mon_an?: DishInput | null;
  he_so_song_chin?: number | string | Decimal | null;
}

export interface MealInput {
  id?: number | bigint | string | null;
  mealName?: string | null;
  ten_bua_an?: string | null;
  gio_an?: string | null;
  mealDetails?: MealDishItem[] | null;
  chi_tiet_bua_an?: MealDishItem[] | null;
}

export interface MenuDetailItem {
  id?: number | bigint | string | null;
  so_tuan?: number | null;
  weekNo?: number | null;
  thu_trong_tuan?: number | null;
  dayOfWeek?: number | null;
  thu_tu_trong_tuan?: number | null;
  meal?: MealInput | null;
  bua_an?: MealInput | null;
}

export interface MenuInput {
  id?: number | bigint | string | null;
  menuType?: string | null;
  ten_thuc_don?: string | null;
  menuDetails?: MenuDetailItem[] | null;
  chi_tiet_thuc_don?: MenuDetailItem[] | null;
}

export interface DishNutritionResult {
  dishId?: number | bigint | string | null;
  rawWeightGrams: number;
  netWeightGrams: number;
  cookedWeightGrams: number;
  nutrients: RoundedNutrientMap;
  decimalNutrients: DecimalMap;
  ingredientBreakdown: Array<{
    ingredientId?: number | bigint | string | null;
    rawWeightGrams: number;
    netWeightGrams: number;
    nutrients: RoundedNutrientMap;
  }>;
}

export interface MealNutritionResult {
  mealId?: number | bigint | string | null;
  mealName?: string | null;
  dishes: DishNutritionResult[];
  nutrients: RoundedNutrientMap;
  decimalNutrients: DecimalMap;
}

export interface MenuDayNutritionResult {
  dayKey: string; // e.g. "1-1" (week 1, day 1) hoặc "1"
  weekNo: number;
  dayOfWeek: number;
  meals: MealNutritionResult[];
  nutrients: RoundedNutrientMap;
  decimalNutrients: DecimalMap;
}

export interface MenuRangeNutritionResult {
  menuId?: number | bigint | string | null;
  menuType: string;
  days: MenuDayNutritionResult[];
  totalNutrients: RoundedNutrientMap;
  averageDailyNutrients: RoundedNutrientMap;
  minEnergyKcal: number;
  maxEnergyKcal: number;
  averageEnergyKcal: number;
  energyDisplay: string;
  decimalNutrients: DecimalMap;
}

export interface CalculateDishNutritionParamDto {
  dish: DishInput;
  ingredientMap?: Map<string | number | bigint, RawIngredientInput>;
  options?: CalculationOptions;
}

export interface CalculateMealNutritionParamDto {
  meal: MealInput;
  ingredientMap?: Map<string | number | bigint, RawIngredientInput>;
  options?: CalculationOptions;
}

export interface CalculateMenuDayNutritionParamDto {
  menuDayMeals: MealInput[];
  ingredientMap?: Map<string | number | bigint, RawIngredientInput>;
  options?: CalculationOptions;
}

export interface CalculateMenuRangeNutritionParamDto {
  menu: MenuInput;
  ingredientMap?: Map<string | number | bigint, RawIngredientInput>;
  options?: CalculationOptions;
}

export interface CalculateDishCookedWeightParamDto {
  dish: DishInput;
  fallbackNetWeight?: Decimal;
}

export interface GetMenuEnergyDisplayParamDto {
  menu: MenuInput;
  ingredientMap?: Map<string | number | bigint, RawIngredientInput>;
}

@Injectable()
export class NutritionCalculatorService {
  private readonly logger = new Logger(NutritionCalculatorService.name);

  /**
   * Tính toán dinh dưỡng 1 món ăn (Dish) từ các nguyên liệu thành phần
   * Giữ nguyên Decimal trong mọi bước cộng dồn, chỉ làm tròn ở output
   */
  public calculateDishNutrition(
    paramOrDish: CalculateDishNutritionParamDto | DishInput,
    legacyIngredientMap?: Map<string | number | bigint, RawIngredientInput>,
    legacyOptions: CalculationOptions = {},
  ): DishNutritionResult {
    let dish: DishInput;
    let ingredientMap: Map<string | number | bigint, RawIngredientInput> | undefined;
    let options: CalculationOptions;

    if (paramOrDish && typeof paramOrDish === 'object' && 'dish' in paramOrDish) {
      dish = paramOrDish.dish;
      ingredientMap = paramOrDish.ingredientMap;
      options = paramOrDish.options || {};
    } else {
      dish = paramOrDish as DishInput;
      ingredientMap = legacyIngredientMap;
      options = legacyOptions || {};
    }

    const rawItems = dish.details || dish.chi_tiet_mon_an || [];
    const accumulated = NutritionEngine.createEmptyDecimalMap();
    let totalRawWeight = NutritionEngine.ZERO;
    let totalNetWeight = NutritionEngine.ZERO;

    const breakdown: DishNutritionResult['ingredientBreakdown'] = [];

    for (const item of rawItems) {
      if (!item) continue;

      // Tìm thông tin nguyên liệu từ map hoặc đối tượng lồng
      const ingId = item.ingredientId;
      const ingredient =
        item.ingredient ||
        item.nguyen_lieu ||
        (ingId != null && ingredientMap ? ingredientMap.get(ingId) : null);

      if (!ingredient) {
        this.logger.warn(`Không tìm thấy nguyên liệu có ID ${ingId} trong món ăn`);
        continue;
      }

      // Xác định khối lượng
      const weightVal = item.khoi_luong_song_sach ?? item.netWeight ?? item.weightGrams ?? 0;
      const isNet =
        item.isNetWeight ??
        (item.khoi_luong_song_sach !== undefined || item.netWeight !== undefined);

      const ingResult = NutritionEngine.calculateIngredientNutrients({
        ingredient,
        weightGrams: weightVal,
        options: {
          ...options,
          isNetWeight: isNet,
          preserveDecimals: true,
        },
      });

      totalRawWeight = totalRawWeight.plus(ingResult.rawWeightGrams);
      totalNetWeight = totalNetWeight.plus(ingResult.netWeightGrams);

      NutritionEngine.accumulateNutrients({
        target: accumulated,
        source: ingResult.nutrients,
      });

      breakdown.push({
        ingredientId: ingId,
        rawWeightGrams: ingResult.rawWeightGrams
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toNumber(),
        netWeightGrams: ingResult.netWeightGrams
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toNumber(),
        nutrients: NutritionEngine.roundDecimalMap({
          map: ingResult.nutrients,
          decimalPlaces: options.targetDecimalPlaces ?? 2,
        }),
      });
    }

    const cookedWeight = this.calculateDishCookedWeight(dish, totalNetWeight);
    const decimalPlaces = options.targetDecimalPlaces ?? 2;

    return {
      dishId: dish.id,
      rawWeightGrams: totalRawWeight.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber(),
      netWeightGrams: totalNetWeight.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber(),
      cookedWeightGrams: cookedWeight.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber(),
      nutrients: NutritionEngine.roundDecimalMap({ map: accumulated, decimalPlaces }),
      decimalNutrients: accumulated,
      ingredientBreakdown: breakdown,
    };
  }

  /**
   * Tính khối lượng chín của món ăn dựa trên hệ số sống/chín (Shrinkage/Yield Coefficient)
   */
  public calculateDishCookedWeight(
    paramOrDish: CalculateDishCookedWeightParamDto | DishInput,
    legacyFallbackNetWeight?: Decimal,
  ): Decimal {
    let dish: DishInput;
    let fallbackNetWeight: Decimal | undefined;

    if (paramOrDish && typeof paramOrDish === 'object' && 'dish' in paramOrDish) {
      dish = paramOrDish.dish;
      fallbackNetWeight = paramOrDish.fallbackNetWeight;
    } else {
      dish = paramOrDish as DishInput;
      fallbackNetWeight = legacyFallbackNetWeight;
    }

    const rawItems = dish.details || dish.chi_tiet_mon_an || [];
    const dishCoeff =
      dish.he_so_song_chin != null
        ? NutritionEngine.toDecimal({ val: dish.he_so_song_chin, fallback: 1 })
        : new Decimal(1);

    if (rawItems.length === 0 && fallbackNetWeight) {
      return fallbackNetWeight.times(dishCoeff);
    }

    let totalCooked = NutritionEngine.ZERO;
    let hasItemCoeff = false;

    for (const item of rawItems) {
      if (!item) continue;
      const weightVal = item.khoi_luong_song_sach ?? item.netWeight ?? item.weightGrams ?? 0;
      const netWeight = NutritionEngine.toDecimal({ val: weightVal, fallback: 0 });

      // Nếu từng dòng có hệ số riêng
      if (item['he_so_song_chin'] != null) {
        hasItemCoeff = true;
        const coeff = NutritionEngine.toDecimal({ val: item['he_so_song_chin'], fallback: 1 });
        totalCooked = totalCooked.plus(netWeight.times(coeff));
      } else {
        totalCooked = totalCooked.plus(netWeight.times(dishCoeff));
      }
    }

    return hasItemCoeff
      ? totalCooked
      : fallbackNetWeight
        ? fallbackNetWeight.times(dishCoeff)
        : totalCooked;
  }

  /**
   * Tính toán dinh dưỡng 1 bữa ăn (Meal)
   * Gộp các món ăn ở mức Decimal chính xác tuyệt đối, loại trừ sai số làm tròn non
   */
  public calculateMealNutrition(
    paramOrMeal: CalculateMealNutritionParamDto | MealInput,
    legacyIngredientMap?: Map<string | number | bigint, RawIngredientInput>,
    legacyOptions: CalculationOptions = {},
  ): MealNutritionResult {
    let meal: MealInput;
    let ingredientMap: Map<string | number | bigint, RawIngredientInput> | undefined;
    let options: CalculationOptions;

    if (paramOrMeal && typeof paramOrMeal === 'object' && 'meal' in paramOrMeal) {
      meal = paramOrMeal.meal;
      ingredientMap = paramOrMeal.ingredientMap;
      options = paramOrMeal.options || {};
    } else {
      meal = paramOrMeal as MealInput;
      ingredientMap = legacyIngredientMap;
      options = legacyOptions || {};
    }

    const mealItems = meal.mealDetails || meal.chi_tiet_bua_an || [];
    const accumulated = NutritionEngine.createEmptyDecimalMap();
    const dishResults: DishNutritionResult[] = [];

    for (const item of mealItems) {
      if (!item) continue;
      const dish = item.dish || item.mon_an;
      if (!dish) continue;

      const dishResult = this.calculateDishNutrition(dish, ingredientMap, {
        ...options,
        preserveDecimals: true,
      });

      // Nếu chi tiết bữa ăn có hệ số sống/chín ghi đè
      if (item.he_so_song_chin != null) {
        const mealDishCoeff = NutritionEngine.toDecimal({ val: item.he_so_song_chin, fallback: 1 });
        const netWeight = new Decimal(dishResult.netWeightGrams);
        dishResult.cookedWeightGrams = netWeight
          .times(mealDishCoeff)
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      dishResults.push(dishResult);
      NutritionEngine.accumulateNutrients({
        target: accumulated,
        source: dishResult.decimalNutrients,
      });
    }

    const decimalPlaces = options.targetDecimalPlaces ?? 2;

    return {
      mealId: meal.id,
      mealName: meal.mealName ?? meal.ten_bua_an,
      dishes: dishResults,
      nutrients: NutritionEngine.roundDecimalMap({ map: accumulated, decimalPlaces }),
      decimalNutrients: accumulated,
    };
  }

  /**
   * Tính toán dinh dưỡng 1 ngày (Menu Day)
   */
  public calculateMenuDayNutrition(
    paramOrMeals: CalculateMenuDayNutritionParamDto | MealInput[],
    legacyIngredientMap?: Map<string | number | bigint, RawIngredientInput>,
    legacyOptions: CalculationOptions = {},
  ): { nutrients: RoundedNutrientMap; decimalNutrients: DecimalMap; meals: MealNutritionResult[] } {
    let menuDayMeals: MealInput[];
    let ingredientMap: Map<string | number | bigint, RawIngredientInput> | undefined;
    let options: CalculationOptions;

    if (paramOrMeals && typeof paramOrMeals === 'object' && 'menuDayMeals' in paramOrMeals) {
      menuDayMeals = paramOrMeals.menuDayMeals;
      ingredientMap = paramOrMeals.ingredientMap;
      options = paramOrMeals.options || {};
    } else {
      menuDayMeals = paramOrMeals as MealInput[];
      ingredientMap = legacyIngredientMap;
      options = legacyOptions || {};
    }

    const accumulated = NutritionEngine.createEmptyDecimalMap();
    const mealResults: MealNutritionResult[] = [];

    for (const meal of menuDayMeals) {
      if (!meal) continue;
      const mealResult = this.calculateMealNutrition(meal, ingredientMap, {
        ...options,
        preserveDecimals: true,
      });
      mealResults.push(mealResult);
      NutritionEngine.accumulateNutrients({
        target: accumulated,
        source: mealResult.decimalNutrients,
      });
    }

    const decimalPlaces = options.targetDecimalPlaces ?? 2;

    return {
      meals: mealResults,
      nutrients: NutritionEngine.roundDecimalMap({ map: accumulated, decimalPlaces }),
      decimalNutrients: accumulated,
    };
  }

  /**
   * Tính toán toàn diện thực đơn tuần hoặc tháng (Menu Range)
   * Gom nhóm theo ngày, tính Min/Max năng lượng, trung bình ngày và tổng thực đơn
   */
  public calculateMenuRangeNutrition(
    paramOrMenu: CalculateMenuRangeNutritionParamDto | MenuInput,
    legacyIngredientMap?: Map<string | number | bigint, RawIngredientInput>,
    legacyOptions: CalculationOptions = {},
  ): MenuRangeNutritionResult {
    let menu: MenuInput;
    let ingredientMap: Map<string | number | bigint, RawIngredientInput> | undefined;
    let options: CalculationOptions;

    if (paramOrMenu && typeof paramOrMenu === 'object' && 'menu' in paramOrMenu) {
      menu = paramOrMenu.menu;
      ingredientMap = paramOrMenu.ingredientMap;
      options = paramOrMenu.options || {};
    } else {
      menu = paramOrMenu as MenuInput;
      ingredientMap = legacyIngredientMap;
      options = legacyOptions || {};
    }

    const details = menu.menuDetails || menu.chi_tiet_thuc_don || [];
    const menuType = String(menu.menuType || 'NGAY').toUpperCase();

    // Gom nhóm chi tiết theo ngày: key = `${weekNo}-${dayOfWeek}`
    const dayGroups = new Map<string, { weekNo: number; dayOfWeek: number; meals: MealInput[] }>();

    for (const item of details) {
      if (!item) continue;
      const meal = item.meal || item.bua_an;
      if (!meal) continue;

      const weekNo = item.weekNo ?? item.so_tuan ?? 1;
      const dayOfWeek = item.dayOfWeek ?? item.thu_trong_tuan ?? 1;
      const dayKey = `${weekNo}-${dayOfWeek}`;

      if (!dayGroups.has(dayKey)) {
        dayGroups.set(dayKey, { weekNo, dayOfWeek, meals: [] });
      }
      dayGroups.get(dayKey)!.meals.push(meal);
    }

    const dayResults: MenuDayNutritionResult[] = [];
    const totalAccumulated = NutritionEngine.createEmptyDecimalMap();

    let minEnergy = new Decimal(Number.MAX_SAFE_INTEGER);
    let maxEnergy = NutritionEngine.ZERO;

    for (const [dayKey, group] of dayGroups.entries()) {
      const dayCalc = this.calculateMenuDayNutrition(group.meals, ingredientMap, {
        ...options,
        preserveDecimals: true,
      });

      const dayEnergy = dayCalc.decimalNutrients.energy || NutritionEngine.ZERO;
      if (dayEnergy.lessThan(minEnergy)) minEnergy = dayEnergy;
      if (dayEnergy.greaterThan(maxEnergy)) maxEnergy = dayEnergy;

      NutritionEngine.accumulateNutrients({
        target: totalAccumulated,
        source: dayCalc.decimalNutrients,
      });

      dayResults.push({
        dayKey,
        weekNo: group.weekNo,
        dayOfWeek: group.dayOfWeek,
        meals: dayCalc.meals,
        nutrients: dayCalc.nutrients,
        decimalNutrients: dayCalc.decimalNutrients,
      });
    }

    const totalDaysCount = dayResults.length > 0 ? dayResults.length : 1;
    const daysDecimal = new Decimal(totalDaysCount);

    // Tính trung bình ngày
    const avgAccumulated: DecimalMap = {};
    for (const code of ALL_INDICATOR_CODES) {
      const totalVal = totalAccumulated[code] || NutritionEngine.ZERO;
      avgAccumulated[code] = totalVal.dividedBy(daysDecimal);
    }
    NutritionEngine.recalculateDerivedRatios(avgAccumulated);

    const decimalPlaces = options.targetDecimalPlaces ?? 2;
    const actualMin = minEnergy.equals(new Decimal(Number.MAX_SAFE_INTEGER))
      ? NutritionEngine.ZERO
      : minEnergy;
    const avgEnergy = (avgAccumulated.energy || NutritionEngine.ZERO)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();

    let energyDisplay = '0 kcal';
    if (menuType === 'NGAY') {
      energyDisplay = `${avgEnergy} kcal`;
    } else {
      const minKcal = actualMin.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      const maxKcal = maxEnergy.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      energyDisplay = `${minKcal} - ${maxKcal} kcal`;
    }

    return {
      menuId: menu.id,
      menuType,
      days: dayResults,
      totalNutrients: NutritionEngine.roundDecimalMap({ map: totalAccumulated, decimalPlaces }),
      averageDailyNutrients: NutritionEngine.roundDecimalMap({
        map: avgAccumulated,
        decimalPlaces,
      }),
      minEnergyKcal: actualMin.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      maxEnergyKcal: maxEnergy.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      averageEnergyKcal: avgEnergy,
      energyDisplay,
      decimalNutrients: totalAccumulated,
    };
  }

  /**
   * Tính chuỗi hiển thị năng lượng tóm tắt cho thực đơn
   */
  public getMenuEnergyDisplay(
    paramOrMenu: GetMenuEnergyDisplayParamDto | MenuInput,
    legacyIngredientMap?: Map<string | number | bigint, RawIngredientInput>,
  ): string {
    let menu: MenuInput;
    let ingredientMap: Map<string | number | bigint, RawIngredientInput> | undefined;

    if (paramOrMenu && typeof paramOrMenu === 'object' && 'menu' in paramOrMenu) {
      menu = paramOrMenu.menu;
      ingredientMap = paramOrMenu.ingredientMap;
    } else {
      menu = paramOrMenu as MenuInput;
      ingredientMap = legacyIngredientMap;
    }

    const rangeResult = this.calculateMenuRangeNutrition({ menu, ingredientMap });
    return rangeResult.energyDisplay;
  }
}
