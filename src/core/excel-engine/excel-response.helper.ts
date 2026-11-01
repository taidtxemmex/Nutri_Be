import { Response } from 'express';
import { EXCEL_MIME_TYPE } from '../../config/constants/excel.constants';

export interface SetExcelResponseHeadersDto {
  res: Response;
  filename: string;
}

/**
 * Chuẩn hóa thiết lập Header phản hồi tệp Excel (RFC 5987 / RFC 6266)
 * Giải quyết DRY (D8): gom 17 chỗ lặp lại Content-Type spreadsheetml về 1 điểm duy nhất.
 */
export function setExcelResponseHeaders(
  paramOrRes: SetExcelResponseHeadersDto | Response,
  legacyFilename?: string,
): void {
  let res: Response;
  let filename: string;

  if (
    paramOrRes &&
    typeof paramOrRes === 'object' &&
    'res' in paramOrRes &&
    'filename' in paramOrRes
  ) {
    res = (paramOrRes as SetExcelResponseHeadersDto).res;
    filename = (paramOrRes as SetExcelResponseHeadersDto).filename;
  } else {
    res = paramOrRes as Response;
    filename = legacyFilename!;
  }

  const safeFilename = filename.replace(/["\r\n]/g, '_');
  const encodedFilename = encodeURIComponent(safeFilename);
  res.setHeader('Content-Type', EXCEL_MIME_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
  );
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
