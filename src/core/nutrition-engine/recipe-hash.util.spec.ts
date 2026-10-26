import {
  computeRecipeHash,
  buildCanonicalRecipeString,
  normalizeRecipeWeight,
  RecipeComponentInput,
} from './recipe-hash.util';

describe('RecipeHashUtil (Canonical Recipe SHA-256 & Locale OS Invariance)', () => {
  describe('1. Ingredient Order Invariance (Canonical Ascending Order)', () => {
    it('should generate identical SHA-256 hash when ingredient order is reversed', () => {
      const orderA: RecipeComponentInput[] = [
        { ingredientId: 2, weight: 50 },
        { ingredientId: 1, weight: 100 },
      ];

      const orderB: RecipeComponentInput[] = [
        { ingredientId: 1, weight: 100 },
        { ingredientId: 2, weight: 50 },
      ];

      const hashA = computeRecipeHash(orderA);
      const hashB = computeRecipeHash(orderB);

      expect(hashA).toBeDefined();
      expect(hashA).toHaveLength(64);
      expect(hashA).toBe(hashB);

      // Verify canonical string structure
      const canonicalA = buildCanonicalRecipeString(orderA);
      const canonicalB = buildCanonicalRecipeString(orderB);
      expect(canonicalA).toBe('1:100.0000|2:50.0000');
      expect(canonicalB).toBe('1:100.0000|2:50.0000');
    });

    it('should handle multi-element arrays with random permutations identically', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 99, weight: 12.5 },
        { ingredientId: 3, weight: 200 },
        { ingredientId: 15, weight: 45.75 },
        { ingredientId: 1, weight: 10 },
      ];

      const reversed = [...components].reverse();
      const shuffled = [components[2], components[0], components[3], components[1]];

      const hashOriginal = computeRecipeHash(components);
      const hashReversed = computeRecipeHash(reversed);
      const hashShuffled = computeRecipeHash(shuffled);

      expect(hashOriginal).toBe(hashReversed);
      expect(hashOriginal).toBe(hashShuffled);
      expect(buildCanonicalRecipeString(components)).toBe(
        '1:10.0000|3:200.0000|15:45.7500|99:12.5000',
      );
    });
  });

  describe('2. Floating-Point Precision & Rounding Consistency', () => {
    it('should handle 10.00001 and 10.00004 consistently after toFixed(4)', () => {
      const recipe1: RecipeComponentInput[] = [{ ingredientId: 1, weight: 10.00001 }];
      const recipe2: RecipeComponentInput[] = [{ ingredientId: 1, weight: 10.00004 }];

      const canonical1 = buildCanonicalRecipeString(recipe1);
      const canonical2 = buildCanonicalRecipeString(recipe2);

      // Both round down to 10.0000 with 4 decimal places
      expect(canonical1).toBe('1:10.0000');
      expect(canonical2).toBe('1:10.0000');

      const hash1 = computeRecipeHash(recipe1);
      const hash2 = computeRecipeHash(recipe2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should correctly round half-up for 5th decimal digit', () => {
      const recipeUnder: RecipeComponentInput[] = [{ ingredientId: 1, weight: 10.00004 }];
      const recipeOver: RecipeComponentInput[] = [{ ingredientId: 1, weight: 10.00005 }];

      const canonicalUnder = buildCanonicalRecipeString(recipeUnder);
      const canonicalOver = buildCanonicalRecipeString(recipeOver);

      expect(canonicalUnder).toBe('1:10.0000');
      expect(canonicalOver).toBe('1:10.0001');

      const hashUnder = computeRecipeHash(recipeUnder);
      const hashOver = computeRecipeHash(recipeOver);

      expect(hashUnder).not.toBe(hashOver);
    });

    it('should eliminate classical IEEE 754 precision drift (0.1 + 0.2)', () => {
      // Classical 0.1 + 0.2 = 0.30000000000000004 in native JS float
      const splitIngredients: RecipeComponentInput[] = [
        { ingredientId: 5, weight: 0.1 },
        { ingredientId: 5, weight: 0.2 },
      ];

      const singleIngredient: RecipeComponentInput[] = [{ ingredientId: 5, weight: 0.3 }];

      const canonicalSplit = buildCanonicalRecipeString(splitIngredients);
      const canonicalSingle = buildCanonicalRecipeString(singleIngredient);

      expect(canonicalSplit).toBe('5:0.3000');
      expect(canonicalSingle).toBe('5:0.3000');

      expect(computeRecipeHash(splitIngredients)).toBe(computeRecipeHash(singleIngredient));
    });
  });

  describe('3. Empty & Null Input Resilience', () => {
    it('should return empty string when components array is empty', () => {
      expect(computeRecipeHash([])).toBe('');
      expect(buildCanonicalRecipeString([])).toBe('');
    });

    it('should return empty string when components is null or undefined', () => {
      expect(computeRecipeHash(null)).toBe('');
      expect(computeRecipeHash(undefined)).toBe('');
      expect(buildCanonicalRecipeString(null)).toBe('');
      expect(buildCanonicalRecipeString(undefined)).toBe('');
    });

    it('should return empty string when components contains only invalid entries', () => {
      const invalidComponents: any[] = [
        null,
        undefined,
        { ingredientId: null, weight: 50 },
        { ingredientId: undefined, weight: 50 },
        { ingredientId: 'not-a-number', weight: 50 },
      ];

      expect(computeRecipeHash(invalidComponents)).toBe('');
      expect(buildCanonicalRecipeString(invalidComponents)).toBe('');
    });
  });

  describe('4. SHA-256 Hash Formatting & Properties', () => {
    it('should return exactly 64 hexadecimal characters', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 10, weight: 150 },
        { ingredientId: 20, weight: 75.5 },
      ];

      const hash = computeRecipeHash(components);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic across multiple repeated invocations', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 7, weight: 120 },
        { ingredientId: 14, weight: 45 },
      ];

      const hash1 = computeRecipeHash(components);
      const hash2 = computeRecipeHash(components);
      const hash3 = computeRecipeHash(components);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('5. Locale OS Invariance (Defeating Java Locale Bug)', () => {
    it('should strictly use decimal point "." and never "," for all weight outputs', () => {
      const testWeights = [10.5, 0.1234, 1000.9999, 0.0001, 55.55];

      for (const w of testWeights) {
        const normalized = normalizeRecipeWeight(w);
        expect(normalized).toContain('.');
        expect(normalized).not.toContain(',');
      }
    });

    it('should normalize negative weights by taking absolute value', () => {
      const components: RecipeComponentInput[] = [{ ingredientId: 1, weight: -50.25 }];
      const canonical = buildCanonicalRecipeString(components);

      expect(canonical).toBe('1:50.2500');
    });

    it('should handle zero and falsy weights safely', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 1, weight: 0 },
        { ingredientId: 2, weight: null },
      ];

      const canonical = buildCanonicalRecipeString(components);
      expect(canonical).toBe('1:0.0000|2:0.0000');
    });
  });

  describe('6. ID Type Compatibility (number, bigint, string)', () => {
    it('should handle numeric, bigint, and string ingredient IDs seamlessly', () => {
      const withNumber: RecipeComponentInput[] = [{ ingredientId: 10, weight: 50 }];
      const withBigInt: RecipeComponentInput[] = [{ ingredientId: BigInt(10), weight: 50 }];
      const withString: RecipeComponentInput[] = [{ ingredientId: '10', weight: 50 }];

      const hashNumber = computeRecipeHash(withNumber);
      const hashBigInt = computeRecipeHash(withBigInt);
      const hashString = computeRecipeHash(withString);

      expect(hashNumber).toBe(hashBigInt);
      expect(hashNumber).toBe(hashString);

      expect(buildCanonicalRecipeString(withNumber)).toBe('10:50.0000');
      expect(buildCanonicalRecipeString(withBigInt)).toBe('10:50.0000');
      expect(buildCanonicalRecipeString(withString)).toBe('10:50.0000');
    });

    it('should sort numerically, not lexicographically (e.g. 2 before 10)', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 10, weight: 50 },
        { ingredientId: 2, weight: 30 },
      ];

      const canonical = buildCanonicalRecipeString(components);
      // If lexicographical: "10:..." < "2:..." which is wrong!
      // Must be numeric: "2:..." before "10:..."
      expect(canonical).toBe('2:30.0000|10:50.0000');
    });
  });

  describe('7. Duplicate Ingredient Aggregation (Bẫy 5 Java Elimination)', () => {
    it('should aggregate split ingredients (50g + 50g = 100g) to match single 100g dish', () => {
      const splitDish: RecipeComponentInput[] = [
        { ingredientId: 1, weight: 50 },
        { ingredientId: 1, weight: 50 },
        { ingredientId: 2, weight: 30 },
      ];

      const mergedDish: RecipeComponentInput[] = [
        { ingredientId: 1, weight: 100 },
        { ingredientId: 2, weight: 30 },
      ];

      const canonicalSplit = buildCanonicalRecipeString(splitDish);
      const canonicalMerged = buildCanonicalRecipeString(mergedDish);

      expect(canonicalSplit).toBe('1:100.0000|2:30.0000');
      expect(canonicalMerged).toBe('1:100.0000|2:30.0000');

      expect(computeRecipeHash(splitDish)).toBe(computeRecipeHash(mergedDish));
    });

    it('should respect mergeDuplicates: false when explicitly requested', () => {
      const components: RecipeComponentInput[] = [
        { ingredientId: 1, weight: 50 },
        { ingredientId: 1, weight: 50 },
      ];

      const canonicalUnmerged = buildCanonicalRecipeString(components, {
        mergeDuplicates: false,
      });

      expect(canonicalUnmerged).toBe('1:50.0000|1:50.0000');
    });
  });

  describe('8. weightGrams Property Compatibility', () => {
    it('should support weightGrams property when weight is omitted', () => {
      const components = [
        { ingredientId: 1, weightGrams: 75.5 },
        { ingredientId: 2, weightGrams: 24.5 },
      ];

      const canonical = buildCanonicalRecipeString(components);
      expect(canonical).toBe('1:75.5000|2:24.5000');

      const hash = computeRecipeHash(components);
      expect(hash).toHaveLength(64);
    });
  });
});
