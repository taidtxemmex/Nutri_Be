import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

export interface ApiFileOptions {
  required?: boolean;
  description?: string;
}

/**
 * Decorator Swagger cho endpoint tải lên 1 tập tin (Upload Single File)
 *
 * Cách dùng:
 * @Post('avatar')
 * @ApiFile('file', { description: 'Hình ảnh đại diện (PNG, JPG)' })
 * async uploadAvatar(@UploadedFile() file: Express.Multer.File) { ... }
 */
export function ApiFile(fieldName = 'file', options: ApiFileOptions = {}) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: options.description || 'Tập tin tải lên',
      required: options.required !== false,
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
  );
}

/**
 * Decorator Swagger cho endpoint tải lên nhiều tập tin (Upload Multiple Files)
 */
export function ApiMultiFiles(fieldName = 'files', options: ApiFileOptions = {}) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: options.description || 'Danh sách tập tin tải lên',
      required: options.required !== false,
      schema: {
        type: 'object',
        properties: {
          [fieldName]: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      },
    }),
  );
}
