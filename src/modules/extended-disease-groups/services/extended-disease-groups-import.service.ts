import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TAG_EXTENDED_DISEASE_GROUPS } from '../../../config/constants/cache.constants';
import { ImportResultDto } from '../dto/import-result.dto';

@Injectable()
export class ExtendedDiseaseGroupsImportService {
  private readonly logger = new Logger(ExtendedDiseaseGroupsImportService.name);

  private static readonly DATA_SHEET = 'Nhom_benh_mo_rong';
  private static readonly PARENT_SHEET = 'Nhom_benh_cha';
  private static readonly RESULT_HEADER = 'Kết quả import';
  private static readonly MAX_ROWS = 1000;
  private static readonly MAX_CODE_LENGTH = 20;
  private static readonly MAX_NAME_LENGTH = 255;
  private static readonly EXPECTED_HEADERS = ['Nhóm bệnh cha', 'Mã nhóm mở rộng', 'Tên hiển thị'];

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Sinh file mẫu Excel (.xlsx) với danh sách dropdown nhóm bệnh cha động
   */
  async getTemplate(): Promise<Buffer> {
    const parents = await this.prisma.nhom_benh.findMany({
      orderBy: { ma_nhom: 'asc' },
      select: { id: true, ma_nhom: true, ten_nhom: true },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TrueNutri Clinical System';
    workbook.created = new Date();

    const dataSheet = workbook.addWorksheet(ExtendedDiseaseGroupsImportService.DATA_SHEET);
    const parentSheet = workbook.addWorksheet(ExtendedDiseaseGroupsImportService.PARENT_SHEET);

    // 1. Data Sheet Header
    dataSheet.columns = [
      { header: ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[0], key: 'parent', width: 40 },
      { header: ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[1], key: 'code', width: 25 },
      { header: ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[2], key: 'name', width: 40 },
    ];

    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }, // Blue primary
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Set text format for column B (code) to avoid dropping leading zeros
    dataSheet.getColumn(2).numFmt = '@';

    // 2. Parent Sheet Header & Data
    parentSheet.columns = [{ header: 'Nhóm bệnh cha', key: 'parent', width: 45 }];
    const parentHeader = parentSheet.getRow(1);
    parentHeader.font = { bold: true };

    for (const p of parents) {
      const label = `${(p.ma_nhom || '').trim()} - ${(p.ten_nhom || '').trim()}`;
      parentSheet.addRow([label]);
    }

    // 3. Dropdown Validation for Sheet 1
    if (parents.length > 0) {
      const formula = `'${ExtendedDiseaseGroupsImportService.PARENT_SHEET}'!$A$2:$A$${parents.length + 1}`;
      for (let rowIdx = 2; rowIdx <= 100; rowIdx++) {
        dataSheet.getCell(`A${rowIdx}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Nhóm bệnh cha',
          error: 'Vui lòng chọn từ danh sách nhóm bệnh cha',
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Import nhóm bệnh mở rộng nguyên tử (Atomic transaction - 1 row lỗi là rollback toàn bộ)
   */
  async importExcel(userId: string, file: Express.Multer.File): Promise<ImportResultDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE',
        message: 'File không đúng định dạng hoặc rỗng',
      });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE',
        message: 'File không đúng định dạng Excel (.xlsx)',
      });
    }

    const sheet =
      workbook.getWorksheet(ExtendedDiseaseGroupsImportService.DATA_SHEET) ||
      workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_TEMPLATE',
        message: 'Template không đúng. Vui lòng dùng file mẫu tải từ hệ thống',
      });
    }

    // Kiểm tra header
    const headerRow = sheet.getRow(1);
    const col1 = (headerRow.getCell(1).value?.toString() || '').trim();
    const col2 = (headerRow.getCell(2).value?.toString() || '').trim();
    const col3 = (headerRow.getCell(3).value?.toString() || '').trim();

    if (
      col1 !== ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[0] ||
      col2 !== ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[1] ||
      col3 !== ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[2]
    ) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_TEMPLATE',
        message: 'Template không đúng. Vui lòng dùng file mẫu tải từ hệ thống',
      });
    }

    // Tra cứu danh sách nhóm bệnh cha trong DB
    const allParents = await this.prisma.nhom_benh.findMany({
      select: { id: true, ma_nhom: true, ten_nhom: true },
    });

    const parentsByLabel = new Map<string, { id: number; code: string; name: string }>();
    const parentsByCode = new Map<string, { id: number; code: string; name: string }>();

    for (const p of allParents) {
      const code = (p.ma_nhom || '').trim().toLowerCase();
      const name = (p.ten_nhom || '').trim().toLowerCase();
      const label = `${code} - ${name}`;
      const item = { id: p.id, code: (p.ma_nhom || '').trim(), name: (p.ten_nhom || '').trim() };
      parentsByLabel.set(label, item);
      parentsByCode.set(code, item);
    }

    // Danh sách mã đã có của user trong DB
    const existingRecords = await this.prisma.nhom_benh_mo_rong.findMany({
      where: { nguoi_dung_id: userId },
      select: { ma_nhom_mo_rong: true },
    });
    const existingCodes = new Set<string>(
      existingRecords.map((r) => (r.ma_nhom_mo_rong || '').trim().toLowerCase()),
    );

    const codesInFile = new Set<string>();
    const validRecords: Array<{
      nguoi_dung_id: string;
      ma_nhom_cha: number;
      ma_nhom_mo_rong: string;
      ten_hien_thi: string;
    }> = [];

    let hasAnyError = false;
    let dataRowCount = 0;

    // Cột kết quả
    const resultColIdx = 4;
    headerRow.getCell(resultColIdx).value = ExtendedDiseaseGroupsImportService.RESULT_HEADER;
    headerRow.getCell(resultColIdx).font = { bold: true };
    sheet.getColumn(resultColIdx).width = 35;

    // Duyệt qua từng dòng dữ liệu
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawParent = (row.getCell(1).value?.toString() || '').trim();
      const rawCode = (row.getCell(2).value?.toString() || '').trim();
      const rawName = (row.getCell(3).value?.toString() || '').trim();

      // Bỏ qua dòng trống hoàn toàn
      if (!rawParent && !rawCode && !rawName) return;

      dataRowCount++;
      if (dataRowCount > ExtendedDiseaseGroupsImportService.MAX_ROWS) {
        throw new BadRequestException({
          code: 'IMPORT_TOO_MANY_ROWS',
          message: `Chỉ cho phép import tối đa ${ExtendedDiseaseGroupsImportService.MAX_ROWS} nhóm bệnh / file`,
        });
      }

      const errors: string[] = [];

      // 1. Validate Parent
      let matchedParent: { id: number; code: string; name: string } | undefined;
      if (!rawParent) {
        errors.push('Nhóm bệnh cha trống');
      } else {
        const lowerParent = rawParent.toLowerCase();
        matchedParent = parentsByLabel.get(lowerParent) || parentsByCode.get(lowerParent);
        if (!matchedParent) {
          // Thử tìm theo prefix "A -"
          for (const [, val] of parentsByLabel.entries()) {
            if (lowerParent.startsWith(val.code.toLowerCase())) {
              matchedParent = val;
              break;
            }
          }
        }
        if (!matchedParent) {
          errors.push('Nhóm bệnh cha không tồn tại, chọn từ danh sách');
        }
      }

      // 2. Validate Code
      let fullCode = '';
      if (!rawCode) {
        errors.push('Mã nhóm mở rộng trống');
      } else if (matchedParent) {
        const prefix = `${matchedParent.code}-`;
        if (
          rawCode.toLowerCase().startsWith(prefix.toLowerCase()) &&
          rawCode.length > prefix.length
        ) {
          fullCode = rawCode;
        } else {
          fullCode = prefix + rawCode;
        }

        const codeKey = fullCode.toLowerCase();
        if (fullCode.length > ExtendedDiseaseGroupsImportService.MAX_CODE_LENGTH) {
          errors.push(
            `Mã nhóm mở rộng quá dài (${fullCode} vượt ${ExtendedDiseaseGroupsImportService.MAX_CODE_LENGTH} ký tự)`,
          );
        } else if (codesInFile.has(codeKey)) {
          errors.push(`Trùng mã ${fullCode} trong file`);
        } else if (existingCodes.has(codeKey)) {
          errors.push(`Mã ${fullCode} đã tồn tại trong hệ thống`);
        } else {
          codesInFile.add(codeKey);
        }
      }

      // 3. Validate Name
      if (!rawName) {
        errors.push('Tên hiển thị trống');
      } else if (rawName.length > ExtendedDiseaseGroupsImportService.MAX_NAME_LENGTH) {
        errors.push(
          `Tên hiển thị quá dài (tối đa ${ExtendedDiseaseGroupsImportService.MAX_NAME_LENGTH} ký tự)`,
        );
      }

      // Ghi kết quả vào ô kết quả
      const resultCell = row.getCell(resultColIdx);
      if (errors.length > 0) {
        hasAnyError = true;
        resultCell.value = errors.join('; ');
        resultCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Red
      } else {
        resultCell.value = 'Hợp lệ';
        resultCell.font = { color: { argb: 'FF2E7D32' }, bold: true }; // Green
        if (matchedParent) {
          validRecords.push({
            nguoi_dung_id: userId,
            ma_nhom_cha: matchedParent.id,
            ma_nhom_mo_rong: fullCode,
            ten_hien_thi: rawName,
          });
        }
      }
    });

    if (dataRowCount === 0) {
      throw new BadRequestException({
        code: 'IMPORT_EMPTY_FILE',
        message: 'File không có dữ liệu để import',
      });
    }

    // Có bất kỳ lỗi nào -> Không lưu, trả file kết quả kèm lỗi
    if (hasAnyError) {
      const errorBuffer = await workbook.xlsx.writeBuffer();
      return {
        success: false,
        message: 'Import thất bại, vui lòng tải file để xem lỗi',
        totalImported: 0,
        totalErrors: dataRowCount - validRecords.length,
        errorFileName: 'extended_disease_group_import_result.xlsx',
        errorFileBytes: Buffer.from(errorBuffer),
      };
    }

    // Không có lỗi -> Lưu toàn bộ vào DB atomically (Chunked batch insert - Rule 20)
    await this.prisma.nhom_benh_mo_rong.createMany({
      data: validRecords,
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([CACHE_TAG_EXTENDED_DISEASE_GROUPS]);
    }

    this.logger.log(
      `IMPORT EXTENDED DISEASE GROUP SUCCESS | userId=${userId} | total=${validRecords.length}`,
    );

    return {
      success: true,
      message: `Import thành công ${validRecords.length} nhóm bệnh mở rộng`,
      totalImported: validRecords.length,
      totalErrors: 0,
    };
  }
}
