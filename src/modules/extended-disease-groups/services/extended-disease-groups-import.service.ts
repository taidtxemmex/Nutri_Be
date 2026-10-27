import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { CACHE_TAG_EXTENDED_DISEASE_GROUPS } from '../../../config/constants/cache.constants';
import { ImportResultDto } from '../dto/import-result.dto';
import { ExcelStreamReader, ErrorRowItem } from '../../../core/excel-engine';

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
   * Tích hợp bộ đệm CacheService 30 phút (0ms) & file tĩnh trên đĩa
   */
  async getTemplate(): Promise<Buffer> {
    const cacheKey = 'extended-disease-groups:template';
    if (this.cacheService && typeof this.cacheService.get === 'function') {
      const cached = await this.cacheService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('🚀 [Cache Hit] Trả về template nhóm bệnh mở rộng từ CacheService (0ms)');
        return Buffer.from(cached, 'base64');
      }
    }

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

      const generated = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(generated);

    if (
      this.cacheService &&
      typeof this.cacheService.set === 'function' &&
      buffer &&
      buffer.length <= 5 * 1024 * 1024
    ) {
      await this.cacheService.set(
        cacheKey,
        buffer.toString('base64'),
        1800,
        CACHE_TAG_EXTENDED_DISEASE_GROUPS,
      );
      this.logger.debug('💾 Đã lưu template nhóm bệnh mở rộng vào CacheService (tag=extended_disease_groups)');
    }

    return buffer;
  }

  /**
   * Import nhóm bệnh mở rộng nguyên tử (Atomic transaction - 1 row lỗi là rollback toàn bộ)
   * Sử dụng ExcelStreamReader streaming O(1) RAM và Smart Sheet Signature Detection.
   */
  async importExcel(userId: string, file: Express.Multer.File): Promise<ImportResultDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE',
        message: 'File không đúng định dạng hoặc rỗng',
      });
    }

    // 1. Tra cứu trước danh sách nhóm bệnh cha và mã hiện có trong DB (O(1) in-memory lookup)
    const [allParents, existingRecords] = await Promise.all([
      this.prisma.nhom_benh.findMany({
        select: { id: true, ma_nhom: true, ten_nhom: true },
      }),
      this.prisma.nhom_benh_mo_rong.findMany({
        where: { nguoi_dung_id: userId },
        select: { ma_nhom_mo_rong: true },
      }),
    ]);

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

    const existingCodes = new Set<string>(
      existingRecords.map((r) => (r.ma_nhom_mo_rong || '').trim().toLowerCase()),
    );

    // 2. Khởi tạo reader streaming
    let reader: any;
    try {
      reader = ExcelStreamReader.createReader(file.buffer);
    } catch {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE',
        message: 'File không đúng định dạng Excel (.xlsx)',
      });
    }

    const codesInFile = new Set<string>();
    const validRecords: Array<{
      nguoi_dung_id: string;
      ma_nhom_cha: number;
      ma_nhom_mo_rong: string;
      ten_hien_thi: string;
    }> = [];
    const errorRowItems: ErrorRowItem[] = [];

    let hasAnyError = false;
    let dataRowCount = 0;
    let targetWorksheetFound = false;

    try {
      for await (const worksheetReader of reader) {
        let isTargetSheet = false;

        for await (const row of worksheetReader) {
          const rowNumber = row.number;

          if (rowNumber === 1) {
            const col1 = (row.getCell(1).value?.toString() || '').trim();
            const col2 = (row.getCell(2).value?.toString() || '').trim();
            const col3 = (row.getCell(3).value?.toString() || '').trim();

            if (
              col1 === ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[0] &&
              col2 === ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[1] &&
              col3 === ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS[2]
            ) {
              isTargetSheet = true;
              targetWorksheetFound = true;
            }
            continue;
          }

          if (!isTargetSheet) continue;

          const rawParent = (row.getCell(1).value?.toString() || '').trim();
          const rawCode = (row.getCell(2).value?.toString() || '').trim();
          const rawName = ExcelStreamReader.readCellString(row.getCell(3), true) || '';

          // Bỏ qua dòng trống hoàn toàn
          if (!rawParent && !rawCode && !rawName) continue;

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

          if (errors.length > 0) {
            hasAnyError = true;
          } else if (matchedParent) {
            validRecords.push({
              nguoi_dung_id: userId,
              ma_nhom_cha: matchedParent.id,
              ma_nhom_mo_rong: fullCode,
              ten_hien_thi: rawName,
            });
          }

          errorRowItems.push({
            rowNumber,
            rawValues: [rawParent, rawCode, rawName],
            errors,
            successNote: 'Hợp lệ',
          });
        }
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE',
        message: 'File không đúng định dạng Excel (.xlsx)',
      });
    }

    if (!targetWorksheetFound) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_TEMPLATE',
        message: 'Template không đúng. Vui lòng dùng file mẫu tải từ hệ thống',
      });
    }

    if (dataRowCount === 0) {
      throw new BadRequestException({
        code: 'IMPORT_EMPTY_FILE',
        message: 'File không có dữ liệu để import',
      });
    }

    // Có bất kỳ lỗi nào -> Không lưu, trả file kết quả kèm lỗi (All-or-Nothing)
    if (hasAnyError) {
      const errorBuffer = await ExcelStreamReader.generateErrorWorkbook({
        headers: ExtendedDiseaseGroupsImportService.EXPECTED_HEADERS,
        rows: errorRowItems,
        sheetName: ExtendedDiseaseGroupsImportService.DATA_SHEET,
        resultHeaderTitle: ExtendedDiseaseGroupsImportService.RESULT_HEADER,
      });

      return {
        success: false,
        message: 'Import thất bại, vui lòng tải file để xem lỗi',
        totalImported: 0,
        total: dataRowCount,
        imported: 0,
        skipped: 0,
        totalErrors: errorRowItems.filter((i) => i.errors.length > 0).length,
        errorFileName: 'extended_disease_group_import_result.xlsx',
        errorFileBytes: errorBuffer,
      };
    }

    // Không có lỗi -> Lưu toàn bộ vào DB atomically theo BATCH_SIZE=100 (Rule 20)
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const chunk = validRecords.slice(i, i + BATCH_SIZE);
      await this.prisma.nhom_benh_mo_rong.createMany({
        data: chunk,
      });
    }

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
      total: validRecords.length,
      imported: validRecords.length,
      skipped: 0,
      totalErrors: 0,
    };
  }
}
