import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * ParseBigIntPipe: Chuyển đổi an toàn @Param('id') thành BigInt
 * Bắt lỗi sớm trước khi vào Service, chặn hoàn toàn SyntaxError 500 khi gặp 'abc', 'null', 'NaN' (TC-S4-06)
 */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (value === undefined || value === null) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tham số định danh ID không được để trống',
      });
    }

    const strVal = String(value).trim();
    if (!/^\d+$/.test(strVal)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Tham số ID "${value}" không phải là số nguyên dương hợp lệ`,
      });
    }

    try {
      return BigInt(strVal);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Tham số ID "${value}" không thể ép kiểu BigInt`,
      });
    }
  }
}
