import * as crypto from 'crypto';

export interface RecipeItemInput {
  ingredientId: number;
  weightGrams: number;
}

export class RecipeHashHelper {
  static generateHash(items: RecipeItemInput[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    // Sort items by ingredientId ascending to ensure consistent hash
    const sorted = [...items].sort((a, b) => a.ingredientId - b.ingredientId);

    const canonicalString = sorted
      .map((item) => `${item.ingredientId}:${Number(item.weightGrams).toFixed(2)}`)
      .join('|');

    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }
}
