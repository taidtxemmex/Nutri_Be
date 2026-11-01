import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

export interface ApiFileOptions {
  required?: boolean;
  description?: string;
}

export interface ApiFileParamDto {
  fieldName?: string;
  options?: ApiFileOptions;
}

export interface ApiMultiFilesParamDto {
  fieldName?: string;
  options?: ApiFileOptions;
}

/**
 * Decorator Swagger cho endpoint tải lên 1 tập tin (Upload Single File)
 *
 * Cách dùng:
 * @Post('avatar')
 * @ApiFile('file', { description: 'Hình ảnh đại diện (PNG, JPG)' })
 * async uploadAvatar(@UploadedFile() file: Express.Multer.File) { ... }
 */
export function ApiFile(
  paramOrFieldName: ApiFileParamDto | string = 'file',
  legacyOptions: ApiFileOptions = {},
) {
  let fieldName = 'file';
  let options: ApiFileOptions = {};

  if (typeof paramOrFieldName === 'object') {
    fieldName = paramOrFieldName.fieldName || 'file';
    options = paramOrFieldName.options || {};
  } else {
    fieldName = paramOrFieldName;
    options = legacyOptions;
  }

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
export function ApiMultiFiles(
  paramOrFieldName: ApiMultiFilesParamDto | string = 'files',
  legacyOptions: ApiFileOptions = {},
) {
  let fieldName = 'files';
  let options: ApiFileOptions = {};

  if (typeof paramOrFieldName === 'object') {
    fieldName = paramOrFieldName.fieldName || 'files';
    options = paramOrFieldName.options || {};
  } else {
    fieldName = paramOrFieldName;
    options = legacyOptions;
  }

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
