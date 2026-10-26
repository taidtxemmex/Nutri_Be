import {
  computeRecipeHash,
  buildCanonicalRecipeString,
  normalizeRecipeWeight,
  RecipeComponentInput,
} from '../../src/core/nutrition-engine/recipe-hash.util';

describe('Task 3.1: Canonical RecipeHash SHA-256 & OS Locale Invariance', () => {
  it('Order Invariance: A+B and B+A must produce the exact same SHA-256 hash', () => {
    const dishAB: RecipeComponentInput[] = [
      { ingredientId: 1, weight: 100 },
      { ingredientId: 2, weight: 50 },
    ];

    const dishBA: RecipeComponentInput[] = [
      { ingredientId: 2, weight: 50 },
      { ingredientId: 1, weight: 100 },
    ];

    const hashAB = computeRecipeHash(dishAB);
    const hashBA = computeRecipeHash(dishBA);

    expect(hashAB).toBe(hashBA);
    expect(hashAB).toHaveLength(64);
    expect(buildCanonicalRecipeString(dishAB)).toBe('1:100.0000|2:50.0000');
  });

  it('Locale Invariance: Numbers formatted with dot (.) regardless of French/Vietnamese comma OS locale', () => {
    const rawNumbers = [10.5, 99.9999, 0.1234, 1234.5678];
    for (const num of rawNumbers) {
      const normalized = normalizeRecipeWeight(num);
      expect(normalized).toMatch(/^\d+\.\d{4}$/);
      expect(normalized).not.toContain(',');
    }
  });

  it('Float Precision: 10.00001 and 10.00004 yield consistent toFixed(4) output', () => {
    const hash1 = computeRecipeHash([{ ingredientId: 1, weight: 10.00001 }]);
    const hash2 = computeRecipeHash([{ ingredientId: 1, weight: 10.00004 }]);
    expect(hash1).toBe(hash2);
  });

  it('Empty recipe returns empty string', () => {
    expect(computeRecipeHash([])).toBe('');
    expect(computeRecipeHash(null)).toBe('');
  });
});
