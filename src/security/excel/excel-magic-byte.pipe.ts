import {
  PipeTransform,
  Injectable,
  BadRequestException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { EXCEL_UPLOAD_CONFIG } from '../../config/constants/excel.constants';

export { EXCEL_UPLOAD_CONFIG };

/**
 * Cấu hình Multer chuẩn y tế cho upload file Excel (.xlsx)
 */
export function getExcelMulterOptions() {
  return {
    limits: {
      fileSize: EXCEL_UPLOAD_CONFIG.MAX_FILE_SIZE, // 10MB
      files: 1,
    },
    fileFilter: (
      _req: any,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!file || !file.originalname) {
        return cb(
          new BadRequestException({
            code: 'EXCEL_INVALID_FORMAT',
            message: 'Tệp tải lên không hợp lệ hoặc thiếu tên tệp',
          }),
          false,
        );
      }

      const name = file.originalname.toLowerCase();
      if (
        name.endsWith('.xlsm') ||
        name.endsWith('.xlsb') ||
        name.endsWith('.xltm') ||
        name.endsWith('.xla')
      ) {
        return cb(
          new BadRequestException({
            code: 'EXCEL_SECURITY_VIOLATION',
            message: 'Nghiêm cấm tải lên file chứa Macro (.xlsm) hoặc Binary Excel (.xlsb)',
          }),
          false,
        );
      }

      if (!name.endsWith('.xlsx')) {
        return cb(
          new UnsupportedMediaTypeException({
            code: 'EXCEL_INVALID_FORMAT',
            message: 'Chỉ chấp nhận tệp định dạng chuẩn .xlsx. Định dạng .xls hoặc khác bị từ chối.',
          }),
          false,
        );
      }

      cb(null, true);
    },
  };
}

/**
 * ExcelMagicByteValidationPipe
 * Bộ lọc kiểm tra Magic Bytes và cấu trúc tệp OpenXML .xlsx
 * Chặn đứng tệp giả mạo phần mở rộng, Legacy OLE2 .xls và mã độc Macro nhúng (CWE-1236, CWE-434).
 */
@Injectable()
export class ExcelMagicByteValidationPipe
  implements PipeTransform<Express.Multer.File, Promise<Express.Multer.File>>
{
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'EXCEL_INVALID_FORMAT',
        message: 'Vui lòng chọn file Excel để tải lên',
      });
    }

    // 1. Kiểm tra kích thước tệp
    if (file.buffer.length > EXCEL_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      throw new PayloadTooLargeException({
        code: 'EXCEL_INVALID_FORMAT',
        message: 'File vượt quá giới hạn tối đa 10MB',
      });
    }

    if (file.buffer.length < 4) {
      throw new BadRequestException({
        code: 'EXCEL_INVALID_FORMAT',
        message: 'File không hợp lệ hoặc kích thước quá nhỏ',
      });
    }

    const header = file.buffer.subarray(0, 4);

    // 2. Chặn đứng file Legacy XLS OLE2 (D0 CF 11 E0)
    const isOle2 =
      header[0] === EXCEL_UPLOAD_CONFIG.OLE2_MAGIC_BYTES[0] &&
      header[1] === EXCEL_UPLOAD_CONFIG.OLE2_MAGIC_BYTES[1] &&
      header[2] === EXCEL_UPLOAD_CONFIG.OLE2_MAGIC_BYTES[2] &&
      header[3] === EXCEL_UPLOAD_CONFIG.OLE2_MAGIC_BYTES[3];

    if (isOle2) {
      throw new UnsupportedMediaTypeException({
        code: 'EXCEL_INVALID_FORMAT',
        message:
          'Không hỗ trợ định dạng .xls cổ điển (OLE2 Compound Document). Vui lòng lưu tệp dưới định dạng chuẩn OpenXML .xlsx',
      });
    }

    // 3. Bắt buộc 4 bytes đầu là Zip Signature PK\x03\x04 (50 4B 03 04)
    const isZip =
      header[0] === EXCEL_UPLOAD_CONFIG.ZIP_MAGIC_BYTES[0] &&
      header[1] === EXCEL_UPLOAD_CONFIG.ZIP_MAGIC_BYTES[1] &&
      header[2] === EXCEL_UPLOAD_CONFIG.ZIP_MAGIC_BYTES[2] &&
      header[3] === EXCEL_UPLOAD_CONFIG.ZIP_MAGIC_BYTES[3];

    if (!isZip) {
      throw new BadRequestException({
        code: 'EXCEL_INVALID_FORMAT',
        message: 'Tệp tin không đúng định dạng OpenXML .xlsx (Sai mã nhận dạng tệp PK\\x03\\x04)',
      });
    }

    // 4. Chặn đứng Macro nhúng (vbaProject.bin, macroEnabled, customUI with macro)
    const content = file.buffer.toString('binary');
    if (
      content.includes('vbaProject.bin') ||
      content.includes('macroEnabled') ||
      content.includes('word/vbaData.xml') ||
      (content.includes('customUI') && content.includes('onAction'))
    ) {
      throw new BadRequestException({
        code: 'EXCEL_SECURITY_VIOLATION',
        message: 'Phát hiện Macro độc hại nhúng trong file Excel!',
      });
    }

    return file;
  }
}
