import Decimal from 'decimal.js';
import { NutritionEngine, RawIngredientInput } from '../nutrition.engine';
import {
  NutritionCalculatorService,
  DishInput,
  MealInput,
  MenuInput,
} from '../nutrition-calculator.service';

describe('NutritionEngine (High-Precision Decimal.js Domain Engine)', () => {
  beforeEach(() => {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  });

  describe('1. Floating-Point Precision & IEEE 754 Zero-Drift Law', () => {
    it('should eliminate classical floating-point drift: 0.1 + 0.2 must exactly equal 0.3', () => {
      // JavaScript IEEE 754 fails this test: (0.1 + 0.2 === 0.3) is false (0.30000000000000004)
      const standardJsSum = 0.1 + 0.2;
      expect(standardJsSum).not.toBe(0.3);

      // Decimal.js engine guarantees exact equality
      const decimalSum = NutritionEngine.toDecimal(0.1).plus(NutritionEngine.toDecimal(0.2));
      expect(decimalSum.equals(new Decimal('0.3'))).toBe(true);
      expect(decimalSum.toNumber()).toBe(0.3);
    });

    it('should accurately accumulate fractional amounts over 120 iterative additions without precision drift', () => {
      // Giả lập 120 bữa ăn, mỗi bữa có 0.07g vi chất
      let accumulatedDecimal = NutritionEngine.ZERO;
      let accumulatedJs = 0;

      for (let i = 0; i < 120; i++) {
        accumulatedDecimal = accumulatedDecimal.plus(new Decimal('0.07'));
        accumulatedJs += 0.07;
      }

      // 120 * 0.07 = 8.4
      expect(accumulatedDecimal.equals(new Decimal('8.4'))).toBe(true);
      expect(accumulatedDecimal.toNumber()).toBe(8.4);

      // JS có thể trôi dấu phẩy động
      expect(accumulatedJs).not.toBe(8.4);
    });
  });

  describe('2. FAO Available Carbohydrate (By-Difference) Calculation', () => {
    it('should correctly subtract dietary fiber from prox total according to FAO standard', () => {
      // 100g thực phẩm có:
      // Nước: 70g, Protein: 5g, Fat: 2g, Ash: 1g, Fiber: 3g
      // Thuật toán FAO chuẩn: 100 - (70 + 5 + 2 + 1 + 3) = 19g
      // Thuật toán cũ của Java (quên trừ fiber): 100 - (70 + 5 + 2 + 1) = 22g (Sai lệch 3g!)
      const carb = NutritionEngine.calculateCarbohydrate(70, 5, 2, 1, 3);
      expect(carb.equals(new Decimal('19'))).toBe(true);
    });

    it('should return 0 and never return negative carbohydrate if proximate sum exceeds 100', () => {
      // Tổng các chất > 100g (do sai số phòng lab hoặc nhập liệu ngoại lai)
      const carb = NutritionEngine.calculateCarbohydrate(60, 25, 20, 5, 10);
      // 60 + 25 + 20 + 5 + 10 = 120 > 100
      expect(carb.equals(NutritionEngine.ZERO)).toBe(true);
      expect(carb.toNumber()).toBe(0);
    });
  });

  describe('3. Atwater Energy Calculation', () => {
    it('should calculate energy using exact Atwater constants (4 * P + 9 * F + 4 * C)', () => {
      // Protein: 10g -> 40 kcal
      // Fat: 5g -> 45 kcal
      // Carbohydrate: 20g -> 80 kcal
      // Total: 40 + 45 + 80 = 165 kcal
      const energy = NutritionEngine.calculateEnergy(10, 5, 20);
      expect(energy.equals(new Decimal('165'))).toBe(true);
      expect(energy.toNumber()).toBe(165);
    });

    it('should handle zero and negative inputs gracefully by clamping to zero', () => {
      const energy = NutritionEngine.calculateEnergy(-5, 0, null);
      expect(energy.equals(NutritionEngine.ZERO)).toBe(true);
    });
  });

  describe('4. Vitamin A RAE (Retinol Activity Equivalent) Calculation', () => {
    it('should convert provitamin carotenoids into RAE per FAO/WHO conversion factors', () => {
      // RAE = Retinol + (Beta-Carotene / 12) + (Alpha-Carotene / 24) + (Beta-Cryptoxanthin / 24)
      // Retinol: 100 µg -> 100
      // Beta-Carotene: 120 µg / 12 -> 10
      // Alpha-Carotene: 48 µg / 24 -> 2
      // Beta-Cryptoxanthin: 24 µg / 24 -> 1
      // Total RAE = 100 + 10 + 2 + 1 = 113 µg
      const rae = NutritionEngine.calculateVitaminARae(100, 120, 48, 24);
      expect(rae.equals(new Decimal('113'))).toBe(true);
      expect(rae.toNumber()).toBe(113);
    });
  });

  describe('5. Edible Rate & Gross Weight vs Net Weight Logic', () => {
    it('should correctly scale gross weight when isNetWeight is false', () => {
      // Cá có tỷ lệ ăn được 60%, cân cả con 250g
      // Khối lượng sạch ăn được: 250 * 0.6 = 150g
      const netWeight = NutritionEngine.calculateNetWeight(250, 60, false);
      expect(netWeight.equals(new Decimal('150'))).toBe(true);
      expect(netWeight.toNumber()).toBe(150);
    });

    it('should preserve full weight when isNetWeight is true regardless of edible rate', () => {
      // Người dùng đã cân phần thịt nạc sạch 250g
      const netWeight = NutritionEngine.calculateNetWeight(250, 60, true);
      expect(netWeight.equals(new Decimal('250'))).toBe(true);
      expect(netWeight.toNumber()).toBe(250);
    });

    it('should clamp edible rate within [0, 100] boundary', () => {
      const netNegative = NutritionEngine.calculateNetWeight(100, -20, false);
      expect(netNegative.equals(NutritionEngine.ZERO)).toBe(true);

      const netOver100 = NutritionEngine.calculateNetWeight(100, 150, false);
      expect(netOver100.equals(new Decimal('100'))).toBe(true);
    });
  });

  describe('6. Trace Nutrients Preservation (Defeating Java Premature Rounding Bug)', () => {
    it('should preserve trace nutrients without zeroing out like Java roundAll()', () => {
      // Trong Java cũ:
      // mergeTotals() gọi round(entry.getValue()) trên TỪNG nguyên liệu.
      // Nếu 1 nguyên liệu có 0.004 mg Vitamin B12, Java làm tròn Math.round(0.004 * 100) / 100 = 0.00.
      // 10 nguyên liệu như vậy trong Java bị xoá sổ thành 0.00 mg!
      //
      // Với Decimal.js Engine mới:
      // Giữ nguyên Decimal trong suốt quá trình tích lũy, 10 * 0.004 = 0.04 mg.
      const traceIngredient: RawIngredientInput = {
        name: 'Nguyên liệu chứa vi lượng B12',
        edible: 100,
        water: 80,
        protein: 10,
        fat: 5,
        ash: 1,
        fiber: 2,
        vitaminB12: 0.004, // 0.004 µg / 100g
      };

      const accumulated = NutritionEngine.createEmptyDecimalMap();

      // Cộng dồn 10 lần (100g mỗi lần)
      for (let i = 0; i < 10; i++) {
        const result = NutritionEngine.calculateIngredientNutrients(traceIngredient, 100, {
          preserveDecimals: true,
        });
        NutritionEngine.accumulateNutrients(accumulated, result.nutrients);
      }

      // Tổng vi chất phải là 0.04 µg, không bị xóa sổ thành 0
      expect(accumulated.vitaminB12?.equals(new Decimal('0.04'))).toBe(true);

      const presentationOutput = NutritionEngine.roundDecimalMap(accumulated, 2);
      expect(presentationOutput.vitaminB12).toBe(0.04);
    });
  });

  describe('7. Animal vs Plant Origin Classification', () => {
    it('should classify protein and fat as DONG_VAT or THUC_VAT accurately', () => {
      const beef: RawIngredientInput = {
        name: 'Thịt bò',
        loai_protein: 'DONG_VAT',
        edible: 100,
        water: 70,
        protein: 20,
        fat: 10,
        ash: 0,
        fiber: 0,
      };

      const tofu: RawIngredientInput = {
        name: 'Đậu phụ',
        loai_protein: 'THUC_VAT',
        edible: 100,
        water: 80,
        protein: 10,
        fat: 5,
        ash: 0,
        fiber: 0,
      };

      const beefResult = NutritionEngine.calculateIngredientNutrients(beef, 100);
      expect(beefResult.nutrients.proteinAnimal?.toNumber()).toBe(20);
      expect(beefResult.nutrients.proteinPlant?.toNumber()).toBe(0);
      expect(beefResult.nutrients.fatAnimal?.toNumber()).toBe(10);
      expect(beefResult.nutrients.fatPlant?.toNumber()).toBe(0);

      const tofuResult = NutritionEngine.calculateIngredientNutrients(tofu, 100);
      expect(tofuResult.nutrients.proteinAnimal?.toNumber()).toBe(0);
      expect(tofuResult.nutrients.proteinPlant?.toNumber()).toBe(10);
      expect(tofuResult.nutrients.fatAnimal?.toNumber()).toBe(0);
      expect(tofuResult.nutrients.fatPlant?.toNumber()).toBe(5);

      // Gộp cả 2
      const combined = NutritionEngine.createEmptyDecimalMap();
      NutritionEngine.accumulateNutrients(combined, beefResult.nutrients);
      NutritionEngine.accumulateNutrients(combined, tofuResult.nutrients);

      expect(combined.protein?.toNumber()).toBe(30);
      expect(combined.proteinAnimal?.toNumber()).toBe(20);
      expect(combined.proteinPlant?.toNumber()).toBe(10);

      // Tỷ lệ đạm động vật: (20 / 30) * 100 = 66.67%
      const rounded = NutritionEngine.roundDecimalMap(combined, 2);
      expect(rounded.animalProteinRatio).toBe(66.67);
      expect(rounded.animalFatRatio).toBe(66.67);
    });
  });

  describe('8. FAO/WHO Energy Ratio (P:L:C %)', () => {
    it('should compute energy distribution percentages accurately sum to 100%', () => {
      // Giả sử có: Protein = 25g (100 kcal), Fat = 10g (90 kcal), Carbohydrate = 40g (160 kcal)
      // Tổng năng lượng = 350 kcal
      // P% = 100 / 350 * 100 = 28.5714...%
      // L% = 90 / 350 * 100 = 25.7142...%
      // C% = 160 / 350 * 100 = 45.7142...%
      const map: Partial<Record<string, Decimal>> = {
        protein: new Decimal(25),
        fat: new Decimal(10),
        carbohydrate: new Decimal(40),
        energy: new Decimal(350),
      };

      NutritionEngine.recalculateDerivedRatios(map);
      const rounded = NutritionEngine.roundDecimalMap(map, 2);

      expect(rounded.proteinRatio).toBe(28.57);
      expect(rounded.lipidRatio).toBe(25.71);
      expect(rounded.carbohydrateRatio).toBe(45.71);
      expect(
        new Decimal(rounded.proteinRatio!)
          .plus(new Decimal(rounded.lipidRatio!))
          .plus(new Decimal(rounded.carbohydrateRatio!))
          .toDecimalPlaces(0)
          .toNumber(),
      ).toBe(100);
    });
  });
});

describe('NutritionCalculatorService (NestJS Injectable Service)', () => {
  let service: NutritionCalculatorService;

  beforeEach(() => {
    service = new NutritionCalculatorService();
  });

  it('should calculate dish nutrition from ingredients and shrinkage coefficient', () => {
    const rawPork: RawIngredientInput = {
      id: 1,
      name: 'Thịt lợn nạc',
      edible: 100,
      water: 72,
      protein: 20,
      fat: 7,
      ash: 1,
      fiber: 0,
      loai_protein: 'DONG_VAT',
    };

    const dish: DishInput = {
      id: 10,
      name: 'Thịt luộc',
      he_so_song_chin: 0.8, // Hao hụt 20% khi luộc
      details: [
        {
          ingredientId: 1,
          weightGrams: 100,
          ingredient: rawPork,
          isNetWeight: true,
        },
      ],
    };

    const result = service.calculateDishNutrition(dish);

    expect(result.rawWeightGrams).toBe(100);
    expect(result.netWeightGrams).toBe(100);
    expect(result.cookedWeightGrams).toBe(80); // 100 * 0.8 = 80g
    expect(result.nutrients.protein).toBe(20);
    expect(result.nutrients.fat).toBe(7);
    expect(result.nutrients.proteinAnimal).toBe(20);
  });

  it('should hierarchically aggregate meals and menu day without loss of precision', () => {
    const egg: RawIngredientInput = {
      id: 2,
      name: 'Trứng gà',
      edible: 100,
      water: 74,
      protein: 13,
      fat: 11,
      ash: 1,
      fiber: 0,
      loai_protein: 'DONG_VAT',
    };

    const dish1: DishInput = {
      id: 101,
      name: 'Trứng luộc',
      details: [{ ingredientId: 2, weightGrams: 50, ingredient: egg, isNetWeight: true }],
    };

    const meal1: MealInput = {
      id: 201,
      mealName: 'Bữa sáng',
      mealDetails: [{ dishId: 101, dish: dish1 }],
    };

    const meal2: MealInput = {
      id: 202,
      mealName: 'Bữa trưa',
      mealDetails: [{ dishId: 101, dish: dish1 }],
    };

    const dayResult = service.calculateMenuDayNutrition([meal1, meal2]);

    // 50g trứng x 2 bữa = 100g trứng
    expect(dayResult.nutrients.protein).toBe(13);
    expect(dayResult.nutrients.fat).toBe(11);
  });

  it('should calculate week/month menu energy range and formatted string display', () => {
    const rice: RawIngredientInput = {
      id: 3,
      name: 'Gạo tẻ',
      edible: 100,
      water: 14,
      protein: 8,
      fat: 1,
      ash: 1,
      fiber: 0.5,
      loai_protein: 'THUC_VAT',
    };

    const dishDay1: DishInput = {
      id: 301,
      name: 'Cơm trắng ít',
      details: [{ ingredientId: 3, weightGrams: 100, ingredient: rice, isNetWeight: true }],
    };

    const dishDay2: DishInput = {
      id: 302,
      name: 'Cơm trắng nhiều',
      details: [{ ingredientId: 3, weightGrams: 200, ingredient: rice, isNetWeight: true }],
    };

    const menu: MenuInput = {
      id: 501,
      menuType: 'TUAN',
      menuDetails: [
        {
          weekNo: 1,
          dayOfWeek: 1,
          meal: { mealDetails: [{ dish: dishDay1 }] },
        },
        {
          weekNo: 1,
          dayOfWeek: 2,
          meal: { mealDetails: [{ dish: dishDay2 }] },
        },
      ],
    };

    const rangeResult = service.calculateMenuRangeNutrition(menu);

    expect(rangeResult.days.length).toBe(2);
    expect(rangeResult.minEnergyKcal).toBeLessThan(rangeResult.maxEnergyKcal);
    expect(rangeResult.energyDisplay).toContain(' - ');
    expect(rangeResult.energyDisplay).toMatch(/^\d+\s-\s\d+\skcal$/);
  });
});
