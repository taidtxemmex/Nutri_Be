/**
 * DTO / Interface tham số dùng chung cho việc tính toán tuổi chính xác từ ngày sinh / năm sinh.
 * Tái sử dụng đồng nhất giữa AnthropometryService (quản lý nhân trắc bệnh nhân)
 * và DailyIntakesService (tính toán khẩu phần 24h & RDA).
 */
export interface CalculateAgeParamDto {
  /**
   * Ngày sinh đầu vào (dạng Date, chuỗi ISO YYYY-MM-DD, DD/MM/YYYY, v.v.)
   */
  dobInput?: Date | string | null;

  /**
   * Bí danh tương thích cho dobInput (chuỗi ngày hoặc Date object)
   */
  dateOfBirth?: Date | string | null;

  /**
   * Cờ chỉ tính toán dựa trên năm sinh (age = currentYear - birthYear)
   */
  birthYearOnly?: boolean;

  /**
   * Bí danh tương thích cho birthYearOnly (dùng trong DailyIntakesService)
   */
  onlyBirthYear?: boolean;

  /**
   * Ngày tham chiếu để so sánh tuổi (mặc định là ngày hiện tại)
   */
  referenceDate?: Date | string | null;
}
