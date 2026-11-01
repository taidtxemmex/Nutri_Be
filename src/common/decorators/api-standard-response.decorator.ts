import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto, SingleMetaDto, ErrorEnvelopeDto } from '../dto/api-response.dto';

export interface StandardResponseOptions<T extends Type<any>> {
  type?: T;
  status?: number;
  description?: string;
  isArray?: boolean;
}

export interface PaginatedResponseOptions<T extends Type<any>> {
  type: T;
  status?: number;
  description?: string;
}

/**
 * Decorator Swagger chuẩn hóa cho các API trả về Single Entity hoặc Mutation (Rule 10)
 */
export function ApiStandardResponse<T extends Type<any>>(options: StandardResponseOptions<T> = {}) {
  const status = options.status || 200;
  const description = options.description || 'Thao tác thành công';

  if (!options.type) {
    return applyDecorators(
      ApiExtraModels(SingleMetaDto),
      ApiResponse({
        status,
        description,
        schema: {
          properties: {
            status: { type: 'number', example: status },
            message: { type: 'string', example: 'success' },
            data: { type: 'object', nullable: true, example: null },
            meta: { $ref: getSchemaPath(SingleMetaDto) },
          },
        },
      }),
    );
  }

  const dataSchema = options.isArray
    ? {
        type: 'array',
        items: { $ref: getSchemaPath(options.type) },
      }
    : {
        $ref: getSchemaPath(options.type),
      };

  return applyDecorators(
    ApiExtraModels(SingleMetaDto, options.type),
    ApiResponse({
      status,
      description,
      schema: {
        properties: {
          status: { type: 'number', example: status },
          message: { type: 'string', example: 'success' },
          data: dataSchema,
          meta: { $ref: getSchemaPath(SingleMetaDto) },
        },
      },
    }),
  );
}

/**
 * Decorator Swagger chuẩn hóa cho các API trả về danh sách phân trang (Rule 10)
 */
export function ApiPaginatedResponse<T extends Type<any>>(options: PaginatedResponseOptions<T>) {
  const status = options.status || 200;
  const description = options.description || 'Lấy danh sách phân trang thành công';

  return applyDecorators(
    ApiExtraModels(PaginationMetaDto, options.type),
    ApiResponse({
      status,
      description,
      schema: {
        properties: {
          status: { type: 'number', example: status },
          message: { type: 'string', example: 'success' },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(options.type) },
          },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}

export interface ApiErrorResponseParamDto {
  status?: number;
  description?: string;
}

/**
 * Decorator Swagger chuẩn hóa cho Error Envelope (Rule 10)
 */
export function ApiErrorResponse(
  paramOrStatus: ApiErrorResponseParamDto | number = 400,
  legacyDescription = 'Lỗi yêu cầu',
) {
  let status = 400;
  let description = 'Lỗi yêu cầu';

  if (typeof paramOrStatus === 'object') {
    status = paramOrStatus.status ?? 400;
    description = paramOrStatus.description || 'Lỗi yêu cầu';
  } else {
    status = paramOrStatus;
    description = legacyDescription;
  }

  return applyDecorators(
    ApiExtraModels(ErrorEnvelopeDto),
    ApiResponse({
      status,
      description,
      type: ErrorEnvelopeDto,
    }),
  );
}
