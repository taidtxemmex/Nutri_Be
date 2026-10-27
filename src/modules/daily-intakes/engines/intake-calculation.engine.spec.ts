import {
  IntakeCalculationEngine,
  IntakeIngredientItemInput,
  ByMealCalculationInput,
  IngredientOnlyCalculationInput,
} from './intake-calculation.engine';
import { RdaComparisonEngine, RdaComplianceStatus } from './rda-comparison.engine';
import { DemographicProfile } from './rda-reference-data';

describe('Sprint 4: Module 07 - IntakeCalculationEngine & RdaComparisonEngine', () => {
  describe('PART 1: CLINICAL EDIBLE RATE & ELIMINATING LEGACY JAVA DISASTER', () => {
    it('Case 1: Banana (Chuối tiêu) - edible 75% should fix +33.33% overestimation of Java', () => {
      // Chuối tiêu: 100g ăn được chứa: water: 74g, protein: 1.5g, fat: 0.3g, ash: 0.8g, fiber: 0.8g, carbs ~ 22.6g, energy ~ 99 kcal
      const banana: IntakeIngredientItemInput = {
        ingredientId: 101,
        ingredientName: 'Chuối tiêu chín',
        rawWeight: 200, // Cân cả vỏ: 200g
        edible: 75, // Tỷ lệ ăn được 75%
        water: 74,
        protein: 1.5,
        fat: 0.3,
        ash: 0.8,
        fiber: 0.8,
        calci: 8,
        potassium: 358,
        vitaminC: 8.7,
      };

      const result = IntakeCalculationEngine.calculateIngredient(banana);

      // 1. Kiểm tra khối lượng sạch (Net Weight)
      expect(result.rawWeightGrams).toBe(200);
      expect(result.edibleRate).toBe(75);
      // netWeight = 200 * (75 / 100) = 150g
      expect(result.netWeightGrams).toBe(150);

      // 2. Kiểm chứng độ sai lệch so với Java cũ
      // Java cũ dùng ratio = 200 / 100 = 2.0 (tính khống 200g ăn được)
      // Thuật toán chuẩn dùng ratio = 150 / 100 = 1.5
      expect(result.legacyJavaRatio).toBe(2.0);
      expect(result.clinicalNetRatio).toBe(1.5);
      // Sai lệch: (2.0 - 1.5) / 1.5 * 100 = 33.33%
      expect(result.edibleDiscrepancyPercent).toBe(33.33);

      // 3. Vi chất phải nhân theo netWeight (150g = 1.5 x 100g)
      // Kali: 358 * 1.5 = 537.0
      expect(result.nutrients.potassium).toBe(537.0);
      // Canxi: 8 * 1.5 = 12.0
      expect(result.nutrients.calci).toBe(12.0);
      // Vitamin C: 8.7 * 1.5 = 13.05
      expect(result.nutrients.vitaminC).toBe(13.05);
    });

    it('Case 2: Watermelon (Dưa hấu) - edible 54% should fix +85.19% overestimation of Java', () => {
      // Dưa hấu: vỏ và hạt chiếm tới 46%, tỷ lệ ăn được chỉ có 54%
      const watermelon: IntakeIngredientItemInput = {
        ingredientId: 102,
        ingredientName: 'Dưa hấu',
        rawWeight: 500, // Cân nửa quả dưa 500g
        edible: 54, // Chỉ ăn được 54%
        water: 91.8,
        protein: 0.6,
        fat: 0.2,
        ash: 0.3,
        fiber: 0.4,
        sugar: 6.2,
      };

      const result = IntakeCalculationEngine.calculateIngredient(watermelon);

      // netWeight = 500 * (54 / 100) = 270g
      expect(result.rawWeightGrams).toBe(500);
      expect(result.netWeightGrams).toBe(270);
      expect(result.clinicalNetRatio).toBe(2.7);
      expect(result.legacyJavaRatio).toBe(5.0);
      // Sai lệch nếu dùng code Java: (5.0 - 2.7) / 2.7 = 85.19%
      expect(result.edibleDiscrepancyPercent).toBe(85.19);
    });

    it('Case 3: Inedible portion (edible = 0%) yields 0 net weight and 0 nutrients', () => {
      const inedibleItem: IntakeIngredientItemInput = {
        ingredientId: 999,
        ingredientName: 'Vỏ sầu riêng',
        rawWeight: 1000,
        edible: 0,
        protein: 10,
        energy: 200,
      };

      const result = IntakeCalculationEngine.calculateIngredient(inedibleItem);
      expect(result.rawWeightGrams).toBe(1000);
      expect(result.netWeightGrams).toBe(0);
      expect(result.nutrients.energy).toBe(0);
      expect(result.nutrients.protein).toBe(0);
    });

    it('Case 4: 100% edible food (e.g. gạo tẻ, dầu ăn) preserves full weight', () => {
      const rice: IntakeIngredientItemInput = {
        ingredientId: 201,
        ingredientName: 'Gạo tẻ máy',
        rawWeight: 100,
        edible: 100,
        water: 13.8,
        protein: 7.9,
        fat: 1.0,
        ash: 0.7,
        fiber: 0.4,
        calci: 30,
      };

      const result = IntakeCalculationEngine.calculateIngredient(rice);
      expect(result.rawWeightGrams).toBe(100);
      expect(result.netWeightGrams).toBe(100);
      expect(result.edibleDiscrepancyPercent).toBe(0);
      expect(result.nutrients.calci).toBe(30);
    });

    it('Case 5: Default edible rate is 100% when undefined or null', () => {
      const ingredientWithoutEdible: IntakeIngredientItemInput = {
        ingredientId: 202,
        ingredientName: 'Sữa đặc có đường',
        rawWeight: 50,
        protein: 4.0,
        fat: 4.2,
      };

      const result = IntakeCalculationEngine.calculateIngredient(ingredientWithoutEdible);
      expect(result.edibleRate).toBe(100);
      expect(result.netWeightGrams).toBe(50);
    });

    it('Case 6: isNetWeight flag forces netWeight = rawWeight even if edible is given', () => {
      const peeledShrimp: IntakeIngredientItemInput = {
        ingredientId: 203,
        ingredientName: 'Tôm nõn (đã bóc sạch vỏ)',
        rawWeight: 120,
        edible: 60, // Tỷ lệ tôm nguyên con là 60%, nhưng ở đây đã bóc sạch
        isNetWeight: true,
        protein: 20,
      };

      const result = IntakeCalculationEngine.calculateIngredient(peeledShrimp);
      expect(result.netWeightGrams).toBe(120);
      // 120g tôm x (20g protein / 100g) = 24g protein
      expect(result.nutrients.protein).toBe(24);
    });

    it('Case 7: Boundary clamping for edible rates (< 0 or > 100)', () => {
      const negativeEdible: IntakeIngredientItemInput = {
        ingredientId: 204,
        ingredientName: 'Negative edible test',
        rawWeight: 100,
        edible: -20,
      };
      const overEdible: IntakeIngredientItemInput = {
        ingredientId: 205,
        ingredientName: 'Over 100 edible test',
        rawWeight: 100,
        edible: 150,
      };

      expect(IntakeCalculationEngine.calculateIngredient(negativeEdible).netWeightGrams).toBe(0);
      expect(IntakeCalculationEngine.calculateIngredient(overEdible).netWeightGrams).toBe(100);
    });
  });

  describe('PART 2: RETENTION FACTOR (HỆ SỐ LƯU GIỮ KHI CHẾ BIẾN) & 86 INDICATORS', () => {
    it('should correctly apply retention factor to micro-nutrients after cooking', () => {
      // Rau ngót luộc: Luộc rau gây hao hụt ~30% Vitamin C (retentionFactor = 0.70)
      const rauNgot: IntakeIngredientItemInput = {
        ingredientId: 301,
        ingredientName: 'Rau ngót',
        rawWeight: 100,
        edible: 85, // Nhặt bỏ cuống già: ăn được 85g
        retentionFactor: 0.7, // Hệ số giữ lại 70%
        vitaminC: 185, // 100g rau ngót chứa 185mg Vit C
        calci: 169,
        iron: 2.7,
      };

      const result = IntakeCalculationEngine.calculateIngredient(rauNgot);
      // netWeight = 100 * 0.85 = 85g
      expect(result.netWeightGrams).toBe(85);
      // Vitamin C = (185 / 100) * 85 * 0.7 = 110.075 -> rounded 110.08
      expect(result.nutrients.vitaminC).toBe(110.08);
      // Canxi = (169 / 100) * 85 * 0.7 = 100.555 -> rounded 100.56
      expect(result.nutrients.calci).toBe(100.56);
    });

    it('should calculate Available Carbohydrate, Atwater Energy and Vitamin A RAE accurately with Decimal precision', () => {
      const carrot: IntakeIngredientItemInput = {
        ingredientId: 302,
        ingredientName: 'Cà rốt tươi',
        rawWeight: 125,
        edible: 80, // Nạo vỏ: net = 100g
        water: 88.5,
        protein: 1.5,
        fat: 0.2,
        ash: 0.8,
        fiber: 1.2,
        retinol: 0,
        betaCarotene: 6500, // 6500 µg beta-carotene
        alphaCarotene: 2400, // 2400 µg alpha-carotene
        betaCryptoxanthin: 240, // 240 µg
      };

      const result = IntakeCalculationEngine.calculateIngredient(carrot);
      expect(result.netWeightGrams).toBe(100);

      // 1. Available Carb = 100 - (88.5 + 1.5 + 0.2 + 0.8 + 1.2) = 100 - 92.2 = 7.8g
      expect(result.nutrients.carbohydrate).toBe(7.8);

      // 2. Atwater Energy = 4 * 1.5 (6) + 9 * 0.2 (1.8) + 4 * 7.8 (31.2) = 39.0 kcal
      expect(result.nutrients.energy).toBe(39.0);

      // 3. Vitamin A RAE = 0 + (6500 / 12) + (2400 / 24) + (240 / 24)
      // = 0 + 541.6666... + 100 + 10 = 651.6666... -> 651.67 µg RAE
      expect(result.nutrients.vitaminARae).toBe(651.67);
    });

    it('should split animal vs plant protein and compute P:L:C energy contribution ratios', () => {
      const beef: IntakeIngredientItemInput = {
        ingredientId: 303,
        ingredientName: 'Thịt bò loại 1',
        rawWeight: 100,
        edible: 100,
        protein: 21.0,
        fat: 3.5,
        water: 74.0,
        ash: 1.0,
        fiber: 0.0,
        loai_protein: 'DONG_VAT',
      };

      const result = IntakeCalculationEngine.calculateIngredient(beef);
      expect(result.nutrients.proteinAnimal).toBe(21.0);
      expect(result.nutrients.proteinPlant).toBe(0);
      expect(result.nutrients.animalProteinRatio).toBe(100);
      expect(result.nutrients.animalFatRatio).toBe(100);

      // Carbs = 100 - (74 + 21 + 3.5 + 1) = 0.5g
      // Energy = 4 * 21 (84) + 9 * 3.5 (31.5) + 4 * 0.5 (2) = 117.5 kcal
      expect(result.nutrients.energy).toBe(117.5);

      // P% = (84 / 117.5) * 100 = 71.49%
      expect(result.nutrients.proteinRatio).toBe(71.49);
      // L% = (31.5 / 117.5) * 100 = 26.81%
      expect(result.nutrients.lipidRatio).toBe(26.81);
      // C% = (2 / 117.5) * 100 = 1.70%
      expect(result.nutrients.carbohydrateRatio).toBe(1.7);
    });
  });

  describe('PART 3: 24H INTAKE MODES (BY_MEAL vs INGREDIENT_ONLY)', () => {
    it('Mode BY_MEAL: should calculate subtotal per meal, meal energy %, and daily aggregated total', () => {
      const input: ByMealCalculationInput = {
        mode: 'BY_MEAL',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Bữa sáng',
            mealTime: '07:00',
            items: [
              {
                type: 'INGREDIENT',
                ingredientName: 'Bánh mì sandwich',
                rawWeight: 100,
                edible: 100,
                protein: 8.0,
                fat: 2.0,
                carbohydrate: 50.0,
                calci: 50,
                sodium: 400,
              },
              {
                type: 'INGREDIENT',
                ingredientName: 'Trứng gà (1 quả)',
                rawWeight: 55,
                edible: 88, // Vỏ trứng 12% -> net = 48.4g
                protein: 13.0,
                fat: 11.0,
                calci: 55,
                sodium: 130,
                loai_protein: 'DONG_VAT',
              },
            ],
          },
          {
            mealOrder: 2,
            mealName: 'Bữa trưa',
            mealTime: '12:00',
            items: [
              {
                type: 'DISH',
                dish: {
                  dishName: 'Cơm bò xào',
                  quantity: 1,
                  chi_tiet_mon_an: [
                    {
                      ingredient: {
                        ten_nguyen_lieu: 'Gạo tẻ',
                        protein: 7.9,
                        fat: 1.0,
                        carbohydrate: 76.0,
                        sodium: 3,
                      },
                      rawWeight: 150,
                      edible: 100,
                    },
                    {
                      ingredient: {
                        ten_nguyen_lieu: 'Thịt bò bắp',
                        protein: 21.0,
                        fat: 4.0,
                        carbohydrate: 0,
                        sodium: 70,
                        loai_protein: 'DONG_VAT',
                      },
                      rawWeight: 100,
                      edible: 100,
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = IntakeCalculationEngine.calculateDailyIntake(input);

      expect(result.mode).toBe('BY_MEAL');
      expect(result.meals).toHaveLength(2);

      // Bữa sáng
      const breakfast = result.meals![0];
      expect(breakfast.mealName).toBe('Bữa sáng');
      expect(breakfast.mealOrder).toBe(1);
      // Net weight bữa sáng: 100g bánh mì + (55 * 0.88 = 48.4g trứng) = 148.4g
      expect(breakfast.netWeightGrams).toBe(148.4);
      expect(breakfast.energyKcal).toBeGreaterThan(0);
      expect(breakfast.energyPercentOfDaily).toBeGreaterThan(0);

      // Bữa trưa
      const lunch = result.meals![1];
      expect(lunch.mealName).toBe('Bữa trưa');
      expect(lunch.items[0].type).toBe('DISH');
      expect(lunch.netWeightGrams).toBe(250); // 150g gạo + 100g thịt bò

      // Tổng 24h
      expect(result.totalNetWeightGrams).toBe(398.4);
      // Tổng năng lượng phải bằng tổng năng lượng bữa sáng + bữa trưa
      const expectedTotalEnergy = Math.round((breakfast.energyKcal + lunch.energyKcal) * 100) / 100;
      expect(Math.abs(result.totalEnergyKcal - expectedTotalEnergy)).toBeLessThan(0.1);

      // % năng lượng bữa sáng + trưa phải bằng 100%
      expect(
        Math.round((breakfast.energyPercentOfDaily + lunch.energyPercentOfDaily) * 10) / 10,
      ).toBe(100.0);
    });

    it('Mode INGREDIENT_ONLY: should process flat ingredient list with correct totals', () => {
      const input: IngredientOnlyCalculationInput = {
        mode: 'INGREDIENT_ONLY',
        ingredients: [
          {
            ingredientName: 'Khoai lang luộc',
            rawWeight: 200,
            edible: 85, // Bỏ vỏ 15% -> net 170g
            protein: 1.3,
            fat: 0.2,
            carbohydrate: 28.5,
            calci: 34,
            potassium: 337,
            vitaminC: 23,
          },
          {
            ingredientName: 'Sữa chua không đường',
            rawWeight: 100,
            edible: 100,
            protein: 3.5,
            fat: 3.0,
            carbohydrate: 4.7,
            calci: 120,
            potassium: 155,
            vitaminC: 1,
            loai_protein: 'DONG_VAT',
          },
        ],
      };

      const result = IntakeCalculationEngine.calculateDailyIntake(input);

      expect(result.mode).toBe('INGREDIENT_ONLY');
      expect(result.ingredients).toHaveLength(2);
      expect(result.totalRawWeightGrams).toBe(300);
      expect(result.totalNetWeightGrams).toBe(270); // 170 + 100

      // Canxi tổng = (34 * 1.7) + (120 * 1.0) = 57.8 + 120 = 177.8 mg
      expect(result.nutrients.calci).toBe(177.8);
      // Kali tổng = (337 * 1.7) + (155 * 1.0) = 572.9 + 155 = 727.9 mg
      expect(result.nutrients.potassium).toBe(727.9);
      expect(result.macroRatios.proteinPercent).toBeGreaterThan(0);
    });
  });

  describe('PART 4: RDA COMPARISON ENGINE (5 CLINICAL BANDS & UL WARNINGS)', () => {
    const adultMaleProfile: DemographicProfile = {
      gender: 'NAM',
      ageYears: 28,
      activityLevel: 'LIGHT',
    };

    it('should classify ADEQUATE (90% - 110%) when actual intake meets RDA standard', () => {
      // Nhu cầu Calci nam 28 tuổi là 800mg. Actual 800mg = 100% -> ADEQUATE
      const actualIntake = {
        calci: 800,
        energy: 2200,
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile);
      const calci = report.nutrients.find((n) => n.code === 'calci');

      expect(calci).toBeDefined();
      expect(calci!.fulfillmentPercent).toBe(100.0);
      expect(calci!.status).toBe(RdaComplianceStatus.ADEQUATE);
      expect(calci!.alertLevel).toBe('NORMAL');
    });

    it('should classify DEFICIENCY (70% - 89.9%) and SEVERE_DEFICIENCY (< 70%) correctly', () => {
      // Calci: RDA 800mg -> actual 600mg = 75% -> DEFICIENCY
      // Vitamin C: RDA 100mg -> actual 50mg = 50% -> SEVERE_DEFICIENCY
      const actualIntake = {
        calci: 600,
        vitaminC: 50,
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile);
      const calci = report.nutrients.find((n) => n.code === 'calci');
      const vitC = report.nutrients.find((n) => n.code === 'vitaminC');

      expect(calci!.fulfillmentPercent).toBe(75.0);
      expect(calci!.status).toBe(RdaComplianceStatus.DEFICIENCY);
      expect(calci!.alertLevel).toBe('WARNING');

      expect(vitC!.fulfillmentPercent).toBe(50.0);
      expect(vitC!.status).toBe(RdaComplianceStatus.SEVERE_DEFICIENCY);
      expect(vitC!.alertLevel).toBe('DANGER');
      expect(report.summary.severeDeficiencyCount).toBeGreaterThanOrEqual(1);
    });

    it('should classify EXCESS (111% - 130%) when slightly above recommendation', () => {
      // Vitamin C: RDA 100mg -> actual 120mg = 120% -> EXCESS
      const actualIntake = {
        vitaminC: 120,
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile);
      const vitC = report.nutrients.find((n) => n.code === 'vitaminC');

      expect(vitC!.fulfillmentPercent).toBe(120.0);
      expect(vitC!.status).toBe(RdaComplianceStatus.EXCESS);
      expect(vitC!.alertLevel).toBe('WARNING');
    });

    it('should trigger WARNING_TOXIC_OR_UL_EXCEEDED when intake exceeds Tolerable Upper Limit (UL)', () => {
      // Sodium: RDA 1500mg, UL 2300mg -> actual 3500mg (ăn quá mặn) -> UL EXCEEDED
      // Vitamin A: RDA 850µg, UL 3000µg -> actual 3500µg (uống bổ sung liều cao) -> UL EXCEEDED
      const actualIntake = {
        sodium: 3500,
        vitaminARae: 3500,
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile);
      const sodium = report.nutrients.find((n) => n.code === 'sodium');
      const vitA = report.nutrients.find((n) => n.code === 'vitaminARae');

      expect(sodium!.status).toBe(RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED);
      expect(sodium!.alertLevel).toBe('DANGER');

      expect(vitA!.status).toBe(RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED);
      expect(vitA!.alertLevel).toBe('DANGER');

      expect(report.summary.toxicOrUlWarningCount).toBe(2);
      expect(report.summary.criticalWarnings.length).toBeGreaterThanOrEqual(2);
    });

    it('should trigger WARNING_TOXIC_OR_UL_EXCEEDED when percentage > 150% even without strict UL', () => {
      // Giả sử chỉ tiêu nào đó vượt 160% RDA -> WARNING_TOXIC_OR_UL_EXCEEDED
      const actualIntake = {
        energy: 3600, // RDA 2200 -> 163.6%
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile);
      const energy = report.nutrients.find((n) => n.code === 'energy');

      expect(energy!.fulfillmentPercent).toBe(163.6);
      expect(energy!.status).toBe(RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED);
      expect(energy!.alertLevel).toBe('DANGER');
    });

    it('should correctly adjust RDA targets for PREGNANT_T3 (3 tháng cuối thai kỳ)', () => {
      const pregnantProfile: DemographicProfile = {
        gender: 'NU',
        ageYears: 27,
        physiologicalStatus: 'PREGNANT_T3',
      };

      const report = RdaComparisonEngine.compare({}, pregnantProfile);
      const energy = report.nutrients.find((n) => n.code === 'energy');
      const protein = report.nutrients.find((n) => n.code === 'protein');
      const calci = report.nutrients.find((n) => n.code === 'calci');
      const iron = report.nutrients.find((n) => n.code === 'iron');
      const folate = report.nutrients.find((n) => n.code === 'folate');

      // Nữ cơ bản 1800 kcal + 450 kcal (3 tháng cuối) = 2250 kcal
      expect(energy!.recommendedRda).toBe(2250);
      // Nữ cơ bản 55g + 30g protein = 85g
      expect(protein!.recommendedRda).toBe(85);
      // Canxi tăng lên 1200mg
      expect(calci!.recommendedRda).toBe(1200);
      // Sắt tăng lên 30mg
      expect(iron!.recommendedRda).toBe(30);
      // Acid Folic tăng lên 600µg
      expect(folate!.recommendedRda).toBe(600);
    });

    it('should correctly adjust RDA targets for LACTATING_0_6M (cho con bú 6 tháng đầu)', () => {
      const lactatingProfile: DemographicProfile = {
        gender: 'NU',
        ageYears: 29,
        physiologicalStatus: 'LACTATING_0_6M',
      };

      const report = RdaComparisonEngine.compare({}, lactatingProfile);
      const energy = report.nutrients.find((n) => n.code === 'energy');
      const protein = report.nutrients.find((n) => n.code === 'protein');
      const calci = report.nutrients.find((n) => n.code === 'calci');
      const vitA = report.nutrients.find((n) => n.code === 'vitaminARae');
      const vitC = report.nutrients.find((n) => n.code === 'vitaminC');

      // 1800 + 500 = 2300 kcal
      expect(energy!.recommendedRda).toBe(2300);
      // 55 + 19 = 74g
      expect(protein!.recommendedRda).toBe(74);
      // Canxi 1300mg
      expect(calci!.recommendedRda).toBe(1300);
      // Vitamin A 850µg
      expect(vitA!.recommendedRda).toBe(850);
      // Vitamin C 140mg
      expect(vitC!.recommendedRda).toBe(140);
    });

    it('should support Custom RDA Targets overriding standard values (e.g. Bệnh thận cần kiêng kali/đạm)', () => {
      const renalDietTargets = {
        protein: {
          rda: 35, // Giới hạn đạm 35g/ngày cho bệnh nhân suy thận
          ul: 45,
          unit: 'g',
          nameVi: 'Protein kiểm soát bệnh thận',
          nameEn: 'Protein for CKD',
        },
        potassium: {
          rda: 1500, // Giới hạn kali < 1500mg
          ul: 2000,
          unit: 'mg',
          nameVi: 'Kali kiểm soát bệnh thận',
          nameEn: 'Potassium for CKD',
        },
      };

      const actualIntake = {
        protein: 36, // 36g -> ~102.9% -> ADEQUATE
        potassium: 2200, // Vượt UL 2000mg -> UL EXCEEDED
      };

      const report = RdaComparisonEngine.compare(actualIntake, adultMaleProfile, renalDietTargets);

      const protein = report.nutrients.find((n) => n.code === 'protein');
      const potassium = report.nutrients.find((n) => n.code === 'potassium');

      expect(protein!.recommendedRda).toBe(35);
      expect(protein!.status).toBe(RdaComplianceStatus.ADEQUATE);

      expect(potassium!.recommendedRda).toBe(1500);
      expect(potassium!.tolerableUpperLimit).toBe(2000);
      expect(potassium!.status).toBe(RdaComplianceStatus.WARNING_TOXIC_OR_UL_EXCEEDED);
      expect(potassium!.alertLevel).toBe('DANGER');
    });
  });

  describe('PART 5: CLINICAL BOUNDARIES, ZERO-DIVISION RESILIENCE & STRING INPUTS', () => {
    it('should handle zero intake (fasting day) gracefully without division by zero', () => {
      const fastingInput: ByMealCalculationInput = {
        mode: 'BY_MEAL',
        meals: [
          {
            mealOrder: 1,
            mealName: 'Nước lọc sáng',
            items: [
              {
                ingredientName: 'Nước lọc',
                rawWeight: 500,
                water: 100,
              },
            ],
          },
        ],
      };

      const result = IntakeCalculationEngine.calculateDailyIntake(fastingInput);
      expect(result.totalEnergyKcal).toBe(0);
      expect(result.meals![0].energyPercentOfDaily).toBe(0);
      expect(result.macroRatios.proteinPercent).toBe(0);
      expect(result.macroRatios.lipidPercent).toBe(0);
      expect(result.macroRatios.carbohydratePercent).toBe(0);

      // Đối chiếu RDA với 0 intake
      const report = RdaComparisonEngine.compare(result.nutrients, {
        gender: 'NAM',
        ageYears: 30,
      });

      expect(report.summary.severeDeficiencyCount).toBeGreaterThan(0);
      expect(report.summary.dietAdequacyScorePercent).toBe(0);
      expect(report.summary.energyBalance.differenceKcal).toBe(-2200);
    });

    it('should handle empty meals and empty ingredients lists safely', () => {
      const emptyMeal = IntakeCalculationEngine.calculateDailyIntake({
        mode: 'BY_MEAL',
        meals: [],
      });
      expect(emptyMeal.totalRawWeightGrams).toBe(0);
      expect(emptyMeal.totalNetWeightGrams).toBe(0);
      expect(emptyMeal.totalEnergyKcal).toBe(0);

      const emptyIng = IntakeCalculationEngine.calculateDailyIntake({
        mode: 'INGREDIENT_ONLY',
        ingredients: [],
      });
      expect(emptyIng.totalRawWeightGrams).toBe(0);
      expect(emptyIng.totalNetWeightGrams).toBe(0);
      expect(emptyIng.totalEnergyKcal).toBe(0);
    });

    it('should handle string inputs, negative values and preserve pure Decimal precision', () => {
      const stringInput: IntakeIngredientItemInput = {
        rawWeight: '150.5',
        edible: '80.0',
        retentionFactor: '0.9',
        protein: '10.5',
        fat: '2.5',
        calci: '100.0',
      };

      const res = IntakeCalculationEngine.calculateIngredient(stringInput, undefined, {
        preserveDecimals: true,
      });

      // netWeight = 150.5 * 0.8 = 120.4g
      expect(res.netWeightGrams).toBe(120.4);
      expect(res.decimalNutrients).toBeDefined();
      // Canxi = (100 / 100) * 120.4 * 0.9 = 108.36
      expect(res.nutrients.calci).toBe(108.36);
    });
  });
});
