import { ValidationPipe, ValidationError, BadRequestException, Optional } from '@nestjs/common';
import { I18nService } from '../../core/i18n/i18n.service';

export class CustomValidationPipe extends ValidationPipe {
  constructor(@Optional() private readonly i18nService?: I18nService) {
    super({
      whitelist: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = this.flattenErrors(errors);
        return new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: this.i18nService
            ? this.i18nService.translate('error.validation.failed')
            : 'Dữ liệu gửi lên không hợp lệ',
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
        for (const [code, rawMessage] of Object.entries(error.constraints)) {
          const message =
            this.i18nService && this.i18nService.hasKey(rawMessage)
              ? this.i18nService.translate(rawMessage)
              : rawMessage;

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
