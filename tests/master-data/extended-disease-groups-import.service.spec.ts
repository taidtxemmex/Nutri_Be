import { ExtendedDiseaseGroupsImportService } from '../../src/modules/extended-disease-groups/services/extended-disease-groups-import.service';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

describe('ExtendedDiseaseGroupsImportService', () => {
  let service: ExtendedDiseaseGroupsImportService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      nhom_benh: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ma_nhom: 'A', ten_nhom: 'Bệnh tim mạch' },
          { id: 2, ma_nhom: 'B', ten_nhom: 'Bệnh nội tiết' },
        ]),
      },
      nhom_benh_mo_rong: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockCache = {
      debouncedInvalidateTags: jest.fn().mockResolvedValue(undefined),
    };

    service = new ExtendedDiseaseGroupsImportService(mockPrisma, mockCache);
  });

  describe('getTemplate', () => {
    it('should generate a valid Excel workbook with both sheets', async () => {
      const buffer = await service.getTemplate();
      expect(buffer).toBeInstanceOf(Buffer);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const dataSheet = workbook.getWorksheet('Nhom_benh_mo_rong');
      const parentSheet = workbook.getWorksheet('Nhom_benh_cha');

      expect(dataSheet).toBeDefined();
      expect(parentSheet).toBeDefined();

      const headerRow = dataSheet?.getRow(1);
      expect(headerRow?.getCell(1).value).toBe('Nhóm bệnh cha');
      expect(headerRow?.getCell(2).value).toBe('Mã nhóm mở rộng');
      expect(headerRow?.getCell(3).value).toBe('Tên hiển thị');
    });
  });

  describe('importExcel validation', () => {
    it('should throw BadRequestException if file is null or empty', async () => {
      await expect(service.importExcel({ userId: 'user-1', file: null as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file has invalid headers', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Sai Header 1', 'Sai Header 2']);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const mockFile: Express.Multer.File = {
        buffer,
        fieldname: 'file',
        originalname: 'test.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await expect(service.importExcel({ userId: 'user-1', file: mockFile })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully import valid rows and call createMany', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Nhom_benh_mo_rong');
      ws.addRow(['Nhóm bệnh cha', 'Mã nhóm mở rộng', 'Tên hiển thị']);
      ws.addRow(['A - Bệnh tim mạch', '01', 'Tăng huyết áp']);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const mockFile: Express.Multer.File = {
        buffer,
        fieldname: 'file',
        originalname: 'test.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.importExcel({ userId: 'user-1', file: mockFile });

      expect(result.success).toBe(true);
      expect(result.totalImported).toBe(1);
      expect(mockPrisma.nhom_benh_mo_rong.createMany).toHaveBeenCalledWith({
        data: [
          {
            nguoi_dung_id: 'user-1',
            ma_nhom_cha: 1,
            ma_nhom_mo_rong: 'A-01',
            ten_hien_thi: 'Tăng huyết áp',
          },
        ],
      });
      expect(mockCache.debouncedInvalidateTags).toHaveBeenCalledWith(['extended_disease_groups']);
    });

    it('should return success: false and errorFileBytes when rows have errors', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Nhom_benh_mo_rong');
      ws.addRow(['Nhóm bệnh cha', 'Mã nhóm mở rộng', 'Tên hiển thị']);
      ws.addRow(['Nhóm không tồn tại', '01', 'Tăng huyết áp']);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      const mockFile: Express.Multer.File = {
        buffer,
        fieldname: 'file',
        originalname: 'test.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.importExcel({ userId: 'user-1', file: mockFile });

      expect(result.success).toBe(false);
      expect(result.errorFileBytes).toBeDefined();
      expect(mockPrisma.nhom_benh_mo_rong.createMany).not.toHaveBeenCalled();
    });
  });
});
