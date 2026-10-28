import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { DailyIntakeExcelService } from '../../src/modules/daily-intakes/services/daily-intake-excel.service';
import { DailyIntakeClinicalReportType, Gender } from '../../src/config/enums/domain.enum';

describe('DailyIntakeExcelService', () => {
  let service: DailyIntakeExcelService;
  let mockPrisma: any;
  let mockCacheService: any;

  const mockIngredients = [
    {
      id: BigInt(1),
      ten_nguyen_lieu: 'Bánh phở',
      edible: 100,
      protein: 3.2,
      fat: 0.3,
      carbohydrate: 32.1,
      fiber: 0.2,
      energy: 144,
      calci: 15,
      iron: 0.6,
      vitaminC: 0,
    },
    {
      id: BigInt(2),
      ten_nguyen_lieu: 'Thịt bò bắp',
      edible: 100,
      protein: 21.0,
      fat: 7.5,
      carbohydrate: 0,
      fiber: 0,
      energy: 151,
      calci: 12,
      iron: 2.7,
      vitaminC: 1,
    },
    {
      id: BigInt(3),
      ten_nguyen_lieu: 'Gạo tẻ',
      edible: 100,
      protein: 7.9,
      fat: 0.7,
      carbohydrate: 76.2,
      fiber: 0.4,
      energy: 342,
      calci: 30,
      iron: 1.2,
      vitaminC: 0,
    },
  ];

  const mockPatient = {
    id: BigInt(10),
    nguoi_dung_id: 'doctor-001',
    ho_ten: 'Trần Thị Bích',
    ma_benh_nhan_bv: 'BN-2026-999',
    gioi_tinh: Gender.NU,
    can_nang: 54.0,
    chieu_cao: 158.0,
    ngay_sinh: new Date('1988-08-20'),
    he_so_hoat_dong: 1.3,
  };

  const mockIntakeData = {
    id: BigInt(99),
    ngay_an: new Date('2026-10-26'),
    benh_nhan_id: BigInt(10),
    benh_nhan: mockPatient,
    khau_phan_24h_bua_an: [
      {
        id: BigInt(101),
        ten_bua: 'Bữa sáng',
        gio_an: '07:00',
        thu_tu_bua: 1,
        khau_phan_24h_nguyen_lieu: [
          {
            id: BigInt(201),
            khoi_luong_song_sach: 150,
            nguyen_lieu: mockIngredients[0],
          },
          {
            id: BigInt(202),
            khoi_luong_song_sach: 50,
            nguyen_lieu: mockIngredients[1],
          },
        ],
      },
      {
        id: BigInt(102),
        ten_bua: 'Bữa trưa',
        gio_an: '12:00',
        thu_tu_bua: 2,
        khau_phan_24h_nguyen_lieu: [
          {
            id: BigInt(203),
            khoi_luong_song_sach: 100,
            nguyen_lieu: mockIngredients[2],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      benh_nhan: {
        findFirst: jest.fn().mockResolvedValue(mockPatient),
      },
      nguyen_lieu: {
        findMany: jest.fn().mockResolvedValue(mockIngredients),
      },
      khau_phan_24h: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: BigInt(999), ...data })),
        delete: jest.fn().mockResolvedValue({ id: BigInt(99) }),
      },
      khau_phan_24h_bua_an: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: BigInt(888), ...data })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      khau_phan_24h_nguyen_lieu: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: BigInt(777), ...data })),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockCacheService = {
      generateKey: jest.fn((prefix, params) => `cache:${prefix}:${JSON.stringify(params)}`),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidateTag: jest.fn().mockResolvedValue(undefined),
    };

    service = new DailyIntakeExcelService(mockPrisma, undefined, mockCacheService);
  });

  describe('1. generateTemplate', () => {
    it('tạo template nhập liệu 24h đầy đủ 3 sheets (Khau_phan_24h, DS_nguyen_lieu, Huong_dan) và lưu cache', async () => {
      const buffer = await service.generateTemplate();
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      expect(wb.getWorksheet('Khau_phan_24h')).toBeDefined();
      expect(wb.getWorksheet('DS_nguyen_lieu')).toBeDefined();
      expect(wb.getWorksheet('Huong_dan')).toBeDefined();

      // Kiểm tra CacheService được gọi để lưu template
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('trả về template từ cache ngay lập tức nếu đã có sẵn (0ms response)', async () => {
      const fakeBase64 = Buffer.from('CACHED_TEMPLATE').toString('base64');
      mockCacheService.get.mockResolvedValueOnce(fakeBase64);

      const buffer = await service.generateTemplate();
      expect(buffer.toString()).toBe('CACHED_TEMPLATE');
      expect(mockPrisma.nguyen_lieu.findMany).not.toHaveBeenCalled();
    });
  });

  describe('2. importDailyIntakeExcel (Atomic Batch Import với Zod)', () => {
    it('nhập thành công file Excel hợp lệ vào database trong 1 atomic transaction', async () => {
      // Tạo một file Excel giả lập với dữ liệu chuẩn
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Khau_phan_24h');
      sheet.addRow(['Bữa ăn', 'Giờ ăn', 'Tên nguyên liệu', 'Khối lượng sống sạch (g)', 'Ghi chú']);
      sheet.addRow(['Bữa sáng', '07:00', 'Bánh phở', 150, 'Phở sáng']);
      sheet.addRow(['', '', 'Thịt bò bắp', 60, '']);
      sheet.addRow(['Bữa trưa', '12:00', 'Gạo tẻ', 90, 'Cơm trưa']);

      const fileBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await service.importDailyIntakeExcel({
        fileBuffer,
        options: {
          patientId: 10,
          userId: 'doctor-001',
          date: '2026-10-26',
        },
      });

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(3);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockCacheService.invalidateTag).toHaveBeenCalledWith('daily_intake:10');
    });

    it('phát hiện lỗi Zod & nghiệp vụ, trả về danh sách lỗi chi tiết kèm file Excel đánh dấu dòng lỗi', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Khau_phan_24h');
      sheet.addRow(['Bữa ăn', 'Giờ ăn', 'Tên nguyên liệu', 'Khối lượng sống sạch (g)', 'Ghi chú']);
      // Dòng 2: Giờ ăn sai format, Khối lượng âm
      sheet.addRow(['Bữa sáng', '25:99', 'Bánh phở', -50, '']);
      // Dòng 3: Nguyên liệu không tồn tại trong hệ thống
      sheet.addRow(['', '', 'Thịt cá sấu bảy màu không tồn tại', 80, '']);

      const fileBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await service.importDailyIntakeExcel({
        fileBuffer,
        options: {
          patientId: 10,
          userId: 'doctor-001',
        },
      });

      expect(result.success).toBe(false);
      expect(result.errorsCount).toBeGreaterThan(0);
      expect(result.errorRows).toBeDefined();
      expect(result.errorFileBuffer).toBeDefined();

      // Kiểm tra file lỗi có thể đọc lại bằng ExcelJS
      const errWb = new ExcelJS.Workbook();
      await errWb.xlsx.load(result.errorFileBuffer as any);
      const errSheet = errWb.getWorksheet('Ket_qua_kiem_tra');
      expect(errSheet).toBeDefined();
      expect(errSheet.getCell('F1').value).toContain('Validation Errors');
    });

    it('ném lỗi DAILY_INTAKE_DUPLICATE nếu đã có bản ghi cùng ngày và không bật overwrite', async () => {
      mockPrisma.khau_phan_24h.findFirst.mockResolvedValueOnce({ id: BigInt(88) });

      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Khau_phan_24h');
      sheet.addRow(['Bữa ăn', 'Giờ ăn', 'Tên nguyên liệu', 'Khối lượng sống sạch (g)', 'Ghi chú']);
      sheet.addRow(['Bữa sáng', '07:00', 'Bánh phở', 150, '']);
      const fileBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      await expect(
        service.importDailyIntakeExcel({
          fileBuffer,
          options: {
            patientId: 10,
            userId: 'doctor-001',
            date: '2026-10-26',
            overwrite: false,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('3. exportClinicalReport (4 Mẫu báo cáo lâm sàng)', () => {
    it('xuất Mẫu 1: Đối chiếu RDA Viện Dinh Dưỡng Quốc Gia (RDA_COMPARISON)', async () => {
      const buffer = await service.exportClinicalReport(
        mockIntakeData,
        DailyIntakeClinicalReportType.RDA_COMPARISON,
      );

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Doi_chieu_RDA');
      expect(sheet).toBeDefined();
      expect(sheet.getCell('A1').value).toContain('BÁO CÁO ĐỐI CHIẾU VI CHẤT KHẨU PHẦN 24H');
    });

    it('xuất Mẫu 2: Cơ cấu năng lượng P:L:C (PLC_STRUCTURE)', async () => {
      const buffer = await service.exportClinicalReport(
        mockIntakeData,
        DailyIntakeClinicalReportType.PLC_STRUCTURE,
      );

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Co_cau_PLC');
      expect(sheet).toBeDefined();
      expect(sheet.getCell('A1').value).toContain('BÁO CÁO CƠ CẤU NĂNG LƯỢNG SINH CHẤT');
    });

    it('xuất Mẫu 3: Phân bố năng lượng theo bữa ăn (MEAL_DISTRIBUTION)', async () => {
      const buffer = await service.exportClinicalReport(
        mockIntakeData,
        DailyIntakeClinicalReportType.MEAL_DISTRIBUTION,
      );

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Phan_bo_bua_an');
      expect(sheet).toBeDefined();
      expect(sheet.getCell('A1').value).toContain('BÁO CÁO PHÂN BỐ NĂNG LƯỢNG VÀ VI CHẤT');
    });

    it('xuất Mẫu 4: Bảng chi tiết nguyên liệu thực phẩm tiêu thụ (INGREDIENT_DETAILS)', async () => {
      const buffer = await service.exportClinicalReport(
        mockIntakeData,
        DailyIntakeClinicalReportType.INGREDIENT_DETAILS,
      );

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('Chi_tiet_nguyen_lieu');
      expect(sheet).toBeDefined();
      expect(sheet.getCell('A1').value).toContain('BẢNG KÊ CHI TIẾT NGUYÊN LIỆU THỰC PHẨM');
    });

    it('xuất Mẫu ALL_IN_ONE: Tập hợp đầy đủ cả 4 sheets báo cáo y khoa chuyên sâu', async () => {
      const buffer = await service.exportClinicalReport(
        mockIntakeData,
        DailyIntakeClinicalReportType.ALL_IN_ONE,
      );

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      expect(wb.getWorksheet('Doi_chieu_RDA')).toBeDefined();
      expect(wb.getWorksheet('Co_cau_PLC')).toBeDefined();
      expect(wb.getWorksheet('Phan_bo_bua_an')).toBeDefined();
      expect(wb.getWorksheet('Chi_tiet_nguyen_lieu')).toBeDefined();
    });

    it('stream báo cáo lâm sàng trực tiếp ra Writable stream an toàn bộ nhớ (Anti-OOM)', async () => {
      const passThrough = new PassThrough();
      const chunks: Buffer[] = [];
      passThrough.on('data', (c) => chunks.push(c));

      await service.streamClinicalReport(
        mockIntakeData,
        passThrough,
        DailyIntakeClinicalReportType.RDA_COMPARISON,
      );

      const fullBuffer = Buffer.concat(chunks);
      expect(fullBuffer.length).toBeGreaterThan(0);
    });
  });
});
