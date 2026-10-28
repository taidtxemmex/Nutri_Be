import * as crypto from 'crypto';
import Decimal from 'decimal.js';

/**
 * Input component interface for recipe hashing.
 * Accepts numeric, string, or bigint ingredient identifiers,
 * and handles both `weight` and `weightGrams` properties.
 */
export interface RecipeComponentInput {
  ingredientId: number | bigint | string;
  weight?: number | string | Decimal | null;
  weightGrams?: number | string | Decimal | null;
}

export interface RecipeHashOptions {
  /**
   * Whether to aggregate/sum weights of duplicate ingredientIds before hashing.
   * Eliminates the duplicate ingredient split bug (Bẫy 5 from Java legacy).
   * Default: true
   */
  mergeDuplicates?: boolean;
}

export interface BuildCanonicalRecipeStringParamDto {
  components?: RecipeComponentInput[] | null;
  options?: RecipeHashOptions;
}

export interface ComputeRecipeHashParamDto {
  components?: RecipeComponentInput[] | null;
  options?: RecipeHashOptions;
}

/**
 * Normalizes a recipe ingredient weight to a deterministic 4-decimal place string.
 * Strictly uses '.' as decimal separator, invariant across all OS locales (solves Java Locale bug).
 * Eliminates IEEE 754 precision drift using Decimal.js.
 *
 * @param weight - Raw weight number, string, Decimal, or null/undefined
 * @returns Formatted 4-decimal string (e.g. "100.0000")
 */
export function normalizeRecipeWeight(
  weight: number | string | Decimal | null | undefined,
): string {
  if (weight === null || weight === undefined || weight === '') {
    return '0.0000';
  }

  try {
    const dec = new Decimal(weight).abs();
    if (dec.isNaN()) {
      return '0.0000';
    }
    return dec.toFixed(4);
  } catch {
    return '0.0000';
  }
}

/**
 * Builds a deterministic canonical string representation of recipe components.
 * Format: "id1:weight1|id2:weight2|..."
 *
 * Invariants:
 * 1. Empty / null / undefined input returns an empty string `""`.
 * 2. Components are sorted ascending by numeric `ingredientId`.
 * 3. Duplicate `ingredientId`s are merged by summing their weights using Decimal.js
 *    (preventing split ingredient discrepancies between "10g" and "5g + 5g").
 * 4. Weights are formatted to fixed 4 decimal places with decimal point `.`
 *    (bypassing OS locale-dependent formatting such as French/Vietnamese commas).
 *
 * @param components - Array of recipe components
 * @param options - Configuration options (e.g., mergeDuplicates)
 * @returns Canonical recipe string or empty string
 */
export function buildCanonicalRecipeString(
  paramOrComponents?: BuildCanonicalRecipeStringParamDto | RecipeComponentInput[] | null,
  legacyOptions: RecipeHashOptions = { mergeDuplicates: true },
): string {
  let components: RecipeComponentInput[] | null | undefined;
  let options: RecipeHashOptions;

  if (
    paramOrComponents &&
    typeof paramOrComponents === 'object' &&
    !Array.isArray(paramOrComponents) &&
    'components' in paramOrComponents
  ) {
    const dto = paramOrComponents as BuildCanonicalRecipeStringParamDto;
    components = dto.components;
    options = dto.options || { mergeDuplicates: true };
  } else {
    components = paramOrComponents as RecipeComponentInput[] | null | undefined;
    options = legacyOptions;
  }

  if (!components || !Array.isArray(components) || components.length === 0) {
    return '';
  }

  const shouldMerge = options.mergeDuplicates !== false;

  if (shouldMerge) {
    const ingredientMap = new Map<number, Decimal>();

    for (const item of components) {
      if (!item || item.ingredientId === null || item.ingredientId === undefined) {
        continue;
      }

      const numId = Number(item.ingredientId);
      if (isNaN(numId)) {
        continue;
      }

      const rawWeight =
        item.weight !== undefined && item.weight !== null ? item.weight : item.weightGrams;

      let weightDec: Decimal;
      try {
        weightDec = new Decimal(rawWeight ?? 0).abs();
        if (weightDec.isNaN()) {
          weightDec = new Decimal(0);
        }
      } catch {
        weightDec = new Decimal(0);
      }

      const existing = ingredientMap.get(numId);
      if (existing) {
        ingredientMap.set(numId, existing.plus(weightDec));
      } else {
        ingredientMap.set(numId, weightDec);
      }
    }

    if (ingredientMap.size === 0) {
      return '';
    }

    const sortedIds = Array.from(ingredientMap.keys()).sort((a, b) => a - b);
    return sortedIds.map((id) => `${id}:${ingredientMap.get(id)!.toFixed(4)}`).join('|');
  }

  // Non-merging path (preserves individual entries, sorts by ingredientId)
  const validItems: Array<{ id: number; weight: Decimal }> = [];

  for (const item of components) {
    if (!item || item.ingredientId === null || item.ingredientId === undefined) {
      continue;
    }

    const numId = Number(item.ingredientId);
    if (isNaN(numId)) {
      continue;
    }

    const rawWeight =
      item.weight !== undefined && item.weight !== null ? item.weight : item.weightGrams;

    let weightDec: Decimal;
    try {
      weightDec = new Decimal(rawWeight ?? 0).abs();
      if (weightDec.isNaN()) {
        weightDec = new Decimal(0);
      }
    } catch {
      weightDec = new Decimal(0);
    }

    validItems.push({ id: numId, weight: weightDec });
  }

  if (validItems.length === 0) {
    return '';
  }

  validItems.sort((a, b) => a.id - b.id);
  return validItems.map((item) => `${item.id}:${item.weight.toFixed(4)}`).join('|');
}

/**
 * Computes a SHA-256 hash of the canonical recipe representation.
 *
 * Guarantees:
 * - Deterministic: Same recipe ingredients and weights always yield the identical 64-char hex hash.
 * - Order-independent: Swapping ingredient order [A, B] vs [B, A] produces the exact same hash.
 * - Locale-invariant: Uses '.' exclusively, avoiding OS language/locale comma drift.
 * - Memory-safe: Operates directly in-memory in O(N log N) without loading database rows.
 *
 * @param components - Array of recipe components
 * @param options - Configuration options
 * @returns 64-character lowercase hex SHA-256 hash, or empty string `""` if empty.
 */
export function computeRecipeHash(
  paramOrComponents?: ComputeRecipeHashParamDto | RecipeComponentInput[] | null,
  legacyOptions?: RecipeHashOptions,
): string {
  let components: RecipeComponentInput[] | null | undefined;
  let options: RecipeHashOptions | undefined;

  if (
    paramOrComponents &&
    typeof paramOrComponents === 'object' &&
    !Array.isArray(paramOrComponents) &&
    'components' in paramOrComponents
  ) {
    const dto = paramOrComponents as ComputeRecipeHashParamDto;
    components = dto.components;
    options = dto.options;
  } else {
    components = paramOrComponents as RecipeComponentInput[] | null | undefined;
    options = legacyOptions;
  }

  const canonical = buildCanonicalRecipeString({ components, options });
  if (!canonical) {
    return '';
  }

  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
