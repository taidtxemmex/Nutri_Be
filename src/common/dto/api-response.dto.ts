import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata chuẩn hóa cho Single Entity và Mutation Responses (Rule 10)
 */
export class SingleMetaDto {
  @ApiProperty({ example: '2026-10-26T06:20:00.000Z', description: 'ISO 8601 Timestamp' })
  timestamp: string;

  @ApiPropertyOptional({ example: 'trace-local', description: 'Trace ID for observability' })
  traceId?: string;
}

/**
 * Metadata chuẩn hóa cho Paginated List Responses (Rule 10)
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Trang hiện tại (1-based index)' })
  page: number;

  @ApiProperty({ example: 20, description: 'Số lượng phần tử trên mỗi trang' })
  limit: number;

  @ApiProperty({ example: 100, description: 'Tổng số phần tử trên toàn bộ hệ thống' })
  totalItems: number;

  @ApiProperty({ example: 5, description: 'Tổng số trang' })
  totalPages: number;

  @ApiProperty({ example: true, description: 'Có trang tiếp theo hay không' })
  hasNextPage: boolean;

  @ApiProperty({ example: false, description: 'Có trang trước đó hay không' })
  hasPreviousPage: boolean;

  @ApiProperty({ example: '2026-10-26T06:20:00.000Z', description: 'ISO 8601 Timestamp' })
  timestamp: string;

  @ApiPropertyOptional({ example: 'trace-local', description: 'Trace ID for observability' })
  traceId?: string;
}

/**
 * Chi tiết lỗi từng trường dữ liệu theo chuẩn RFC-7807 (Rule 10)
 */
export class ErrorDetailDto {
  @ApiProperty({ example: 'email', description: 'Tên trường bị lỗi xác thực' })
  field: string;

  @ApiProperty({ example: 'Email không đúng định dạng', description: 'Mô tả chi tiết lỗi' })
  message: string;

  @ApiProperty({ example: 'INVALID_EMAIL', description: 'Mã lỗi đặc tả nội bộ' })
  code: string;
}

/**
 * Thân chi tiết lỗi (Rule 10)
 */
export class ErrorContentDto {
  @ApiProperty({ example: 'BAD_REQUEST', description: 'Mã lỗi hệ thống' })
  code: string;

  @ApiProperty({ example: 'Dữ liệu không hợp lệ', description: 'Thông điệp lỗi' })
  message: string;

  @ApiPropertyOptional({
    type: [ErrorDetailDto],
    description: 'Danh sách chi tiết các trường bị lỗi',
  })
  details?: ErrorDetailDto[];
}

/**
 * Khung Envelope chuẩn cho mọi phản hồi lỗi (Rule 10)
 */
export class ErrorEnvelopeDto {
  @ApiProperty({ type: ErrorContentDto, description: 'Thông tin lỗi' })
  error: ErrorContentDto;

  @ApiProperty({ type: SingleMetaDto, description: 'Metadata' })
  meta: SingleMetaDto;
}
