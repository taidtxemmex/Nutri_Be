import {
  ValidationPipe,
  ValidationError,
  BadRequestException,
} from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = this.flattenErrors(errors);
        return new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Dữ liệu gửi lên không hợp lệ',
          details,
        });
      },
    });
  }

  private flattenErrors(
    errors: ValidationError[],
    parentField = '',
  ): Array<{ field: string; code: string; message: string }> {
    let result: Array<{ field: string; code: string; message: string }> = [];

    for (const error of errors) {
      const fieldPath = parentField ? `${parentField}.${error.property}` : error.property;

      if (error.constraints) {
        for (const [code, message] of Object.entries(error.constraints)) {
          result.push({
            field: fieldPath,
            code: code.toUpperCase(),
            message,
          });
        }
      }

      if (error.children && error.children.length > 0) {
        result = result.concat(this.flattenErrors(error.children, fieldPath));
      }
    }

    return result;
  }
}
