import { z } from 'zod';
import { EXCEL_LIMITS } from '../../../config/constants/excel.constants';

/**
 * Zod Schema kiểm thực dữ liệu từng dòng trong file Excel Khẩu phần 24h
 */
export const DailyIntakeExcelRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  mealName: z
    .string()
    .min(1, 'Tên bữa ăn không được để trống')
    .max(100, 'Tên bữa ăn không được vượt quá 100 ký tự'),
  mealTime: z
    .string()
    .regex(
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      'Giờ ăn không đúng định dạng HH:mm (VD: 07:00, 12:30)',
    )
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  ingredientName: z
    .string()
    .min(1, 'Tên nguyên liệu không được để trống')
    .max(255, 'Tên nguyên liệu không được vượt quá 255 ký tự'),
  netWeight: z
    .number()
    .positive('Khối lượng sống sạch phải lớn hơn 0')
    .max(
      EXCEL_LIMITS.MAX_WEIGHT_GRAMS,
      `Khối lượng sống sạch không được vượt quá ${EXCEL_LIMITS.MAX_WEIGHT_GRAMS}g`,
    ),
  notes: z
    .string()
    .max(255, 'Ghi chú không được vượt quá 255 ký tự')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
});

export type DailyIntakeExcelRowInput = z.infer<typeof DailyIntakeExcelRowSchema>;

export interface DailyIntakeRowValidationError {
  row: number;
  field: string;
  error: string;
  value?: any;
}
