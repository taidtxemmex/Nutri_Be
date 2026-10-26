import { computeRecipeHash, RecipeComponentInput } from '../nutrition-engine/recipe-hash.util';

export interface RecipeItemInput {
  ingredientId: number;
  weightGrams: number;
}

export class RecipeHashHelper {
  /**
   * Generates a deterministic SHA-256 hash using the canonical recipe engine.
   * Preserves backward compatibility while delegating to the unified recipe-hash utility.
   */
  static generateHash(items: RecipeItemInput[]): string {
    return computeRecipeHash(items as RecipeComponentInput[]);
  }
}
