/**
 * Utility functions for string manipulation and Vietnamese Unicode normalization.
 */

/**
 * Chuẩn hóa chuỗi tiếng Việt theo Unicode NFC và loại bỏ khoảng trắng thừa đầu/cuối.
 * Đảm bảo sự nhất quán cho tìm kiếm, so sánh và lưu trữ dữ liệu tiếng Việt.
 */
export function normalizeVietnameseNFC(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').trim();
}

/**
 * Chuẩn hóa key tiếng Việt phục vụ tra cứu/so khớp (NFC, chuẩn hóa khoảng trắng giữa các từ, trim, toLowerCase).
 */
export function normalizeVietnameseKey(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}
