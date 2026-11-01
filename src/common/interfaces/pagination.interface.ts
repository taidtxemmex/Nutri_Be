/**
 * Generic Paginated Result Interface for Service Layer (DRY SSOT)
 *
 * Chuẩn hóa cấu trúc kết quả phân trang trả về từ tầng Service:
 * { items: T[]; total: number; page: number; limit: number }
 *
 * Cấu trúc này được TransformResponseInterceptor tự động chuyển đổi thành
 * API List Response Envelope chuẩn hóa theo Pillar IV (Rule 10):
 * {
 *   data: T[],
 *   meta: {
 *     page: number,
 *     limit: number,
 *     totalItems: number,
 *     totalPages: number,
 *     hasNextPage: boolean,
 *     hasPreviousPage: boolean,
 *     timestamp: string,
 *     traceId?: string
 *   }
 * }
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  totalItems?: number;
}
