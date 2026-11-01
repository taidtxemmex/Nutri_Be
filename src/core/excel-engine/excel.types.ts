/**
 * Shared interface for Excel export column configurations.
 * Standardizes column metadata (header, key, unit, width) across Dish, Menu, and Ingredient Excel exports.
 */
export interface ExcelExportColumn {
  key: string;
  header: string;
  unit?: string;
  width?: number;
}
