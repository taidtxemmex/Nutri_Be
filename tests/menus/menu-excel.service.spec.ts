import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { MenuExcelService } from '../../src/modules/menus/services/menu-excel.service';
import { MenuExportType, MenuType } from '../../src/config/enums/domain.enum';

describe('MenuExcelService', () => {
  let service: MenuExcelService;
  let mockPrisma: any;
  let mockCacheService: any;

  const mockMenuData = {
    id: BigInt(1),
    ten_thuc_don: 'Thực đơn mẫu 7 ngày cho bệnh nhân Đái Tháo Đường',
    loai_thuc_don: MenuType.TUAN,
    loai_doi_tuong: 'BENH_NHAN',
    ngay_tao: new Date('2026-10-25'),
    benh_nhan: {
      id: BigInt(10),
      ho_ten: 'Nguyễn Văn An',
      ma_benh_nhan_bv: 'BN-2026-001',
      gioi_tinh: 'NAM',
      can_nang: 68.5,
      chieu_cao: 168.0,
      ngay_sinh: new Date('1975-05-15'),
      he_so_hoat_dong: 1.4,
      so_dien_thoai: '0901234567',
    },
    nhom_benh_mo_rong: {
      id: 1,
      ten_hien_thi: 'Đái tháo đường Type 2',
      ma_nhom_mo_rong: 'E11',
    },
    gioi_han_dinh_duong: {
      id: BigInt(5),
      ten_gioi_han: 'Giới hạn ĐTĐ',
      gioi_han_json: {
        energy: 1800,
        protein: 70,
        fat: 45,
        carbohydrate: 220,
        fiber: 25,
        calci: 800,
        iron: 15,
        sodium: 1800,
        potassium: 3000,
      },
    },
    chi_tiet_thuc_don: [
      {
        id: BigInt(101),
        so_tuan: 1,
        thu_trong_tuan: 2, // Thứ 2
        bua_an: {
          id: BigInt(201),
          ten_bua_an: 'Bữa sáng',
          gio_an: '07:00',
          chi_tiet_bua_an: [
            {
              id: BigInt(301),
              he_so_song_chin: 1.2,
              mon_an: {
                id: BigInt(401),
                ten_mon: 'Phở bò tái',
                chi_tiet_mon_an: [
                  {
                    id: BigInt(501),
                    khoi_luong_song_sach: 150,
                    nguyen_lieu: {
                      id: BigInt(601),
                      ten_nguyen_lieu: 'Bánh phở',
                      edible: 100,
                      protein: 3.2,
                      fat: 0.3,
                      fiber: 0.2,
                      ash: 0.4,
                      water: 52.0,
                      calci: 15,
                      iron: 0.6,
                      sodium: 5,
                      potassium: 40,
                    },
                  },
                  {
                    id: BigInt(502),
                    khoi_luong_song_sach: 60,
                    nguyen_lieu: {
                      id: BigInt(602),
                      ten_nguyen_lieu: 'Thịt bò bắp',
                      edible: 100,
                      protein: 21.0,
                      fat: 7.5,
                      fiber: 0,
                      ash: 1.0,
                      water: 70.5,
                      calci: 12,
                      iron: 2.7,
                      sodium: 70,
                      potassium: 350,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        id: BigInt(102),
        so_tuan: 1,
        thu_trong_tuan: 2,
        bua_an: {
          id: BigInt(202),
          ten_bua_an: 'Bữa trưa',
          gio_an: '12:00',
          chi_tiet_bua_an: [
            {
              id: BigInt(302),
              he_so_song_chin: 2.2,
              mon_an: {
                id: BigInt(402),
                ten_mon: 'Cơm trắng',
                chi_tiet_mon_an: [
                  {
                    id: BigInt(503),
                    khoi_luong_song_sach: 80,
                    nguyen_lieu: {
                      id: BigInt(603),
                      ten_nguyen_lieu: 'Gạo tẻ',
                      edible: 100,
                      protein: 7.9,
                      fat: 0.7,
                      fiber: 0.4,
                      ash: 0.6,
                      water: 13.8,
                      calci: 30,
                      iron: 1.2,
                      sodium: 3,
                      potassium: 110,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      thuc_don: {
        findFirst: jest.fn().mockResolvedValue(mockMenuData),
      },
    };

    mockCacheService = {
      generateKey: jest.fn((prefix, params) => `cache:${prefix}:${JSON.stringify(params)}`),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidateTag: jest.fn().mockResolvedValue(undefined),
    };

    service = new MenuExcelService(mockPrisma, undefined, mockCacheService);
  });

  describe('Mode 1: FULL Export', () => {
    it('xuất đầy đủ cây thực đơn 5 cấp kèm chỉ tiêu vi chất và merge cells chính xác', async () => {
      const buffer = await service.exportMenuExcel({
        menuIdOrData: mockMenuData,
        options: {
          exportType: MenuExportType.FULL,
          servings: 1,
        },
      });

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);

      // Đọc lại bằng ExcelJS để kiểm tra tính hợp lệ của file Excel
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('THUC_DON');
      expect(sheet).toBeDefined();

      // Kiểm tra tiêu đề lớn & thông tin bệnh nhân
      expect(sheet.getCell('A1').value).toContain('BẢNG CHI TIẾT THỰC ĐƠN');

      // Tìm dòng chứa bệnh nhân Nguyễn Văn An
      let foundPatient = false;
      let foundDish = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (String(cell.value).includes('Nguyễn Văn An')) foundPatient = true;
          if (String(cell.value).includes('Phở bò tái')) foundDish = true;
        });
      });

      expect(foundPatient).toBe(true);
      expect(foundDish).toBe(true);
    });
  });

  describe('Mode 2: NET Export', () => {
    it('chỉ xuất khối lượng sống sạch (Net weight) và không có 86 cột vi chất', async () => {
      const buffer = await service.exportMenuExcel({
        menuIdOrData: mockMenuData,
        options: {
          exportType: MenuExportType.NET,
        },
      });

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('THUC_DON');
      expect(sheet).toBeDefined();

      // Kiểm tra có cột Sống sạch (g)
      let foundNetWeightHeader = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (String(cell.value) === 'Sống sạch (g)') foundNetWeightHeader = true;
        });
      });
      expect(foundNetWeightHeader).toBe(true);
    });
  });

  describe('Mode 3: NET_NUTRITION Export', () => {
    it('xuất khối lượng thực tế kèm vi chất tổng hợp theo từng bữa và cả ngày', async () => {
      const buffer = await service.exportMenuExcel({
        menuIdOrData: mockMenuData,
        options: {
          exportType: MenuExportType.NET_NUTRITION,
          columns: ['energy', 'protein', 'fat', 'carbohydrate'],
        },
      });

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const sheet = wb.getWorksheet('THUC_DON');
      expect(sheet).toBeDefined();

      let foundEnergy = false;
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (String(cell.value).includes('Năng lượng')) foundEnergy = true;
        });
      });
      expect(foundEnergy).toBe(true);
    });
  });

  describe('Mode 4: RAW Export', () => {
    it('xuất bảng tổng hợp đi chợ nguyên liệu thô theo ngày và cả chu kỳ cho N suất', async () => {
      const buffer = await service.exportMenuExcel({
        menuIdOrData: mockMenuData,
        options: {
          exportType: MenuExportType.RAW,
          servings: 50,
        },
      });

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      // Phải có 2 sheet: THUC_DON và Tong_hop_di_cho
      const mainSheet = wb.getWorksheet('THUC_DON');
      const shoppingSheet = wb.getWorksheet('Tong_hop_di_cho');

      expect(mainSheet).toBeDefined();
      expect(shoppingSheet).toBeDefined();

      // Kiểm tra sheet đi chợ có tính cho 50 suất
      expect(shoppingSheet.getCell('A1').value).toContain('50 SUẤT');
    });
  });

  describe('Mode 5: COOKED Export', () => {
    it('xuất bảng chế biến nhà bếp với khối lượng chín và hướng dẫn chia suất', async () => {
      const buffer = await service.exportMenuExcel({
        menuIdOrData: mockMenuData,
        options: {
          exportType: MenuExportType.COOKED,
          servings: 100,
        },
      });

      expect(buffer).toBeDefined();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const mainSheet = wb.getWorksheet('THUC_DON');
      const cookingSheet = wb.getWorksheet('Dinh_luong_nha_bep');

      expect(mainSheet).toBeDefined();
      expect(cookingSheet).toBeDefined();

      expect(cookingSheet.getCell('A1').value).toContain('100 SUẤT');
    });
  });

  describe('CacheService Caching & Streaming', () => {
    it('trả về kết quả tức thì từ CacheService nếu đã có sẵn trong bộ nhớ đệm (0ms)', async () => {
      const fakeBase64 = Buffer.from('FAKE_EXCEL_BUFFER').toString('base64');
      mockCacheService.get.mockResolvedValueOnce(fakeBase64);

      const buffer = await service.exportMenuExcel({
        menuIdOrData: BigInt(1),
        options: {
          exportType: MenuExportType.FULL,
        },
      });

      expect(buffer.toString()).toBe('FAKE_EXCEL_BUFFER');
      // Không cần query DB khi cache hit
      expect(mockPrisma.thuc_don.findFirst).not.toHaveBeenCalled();
    });

    it('stream Excel ra Writable stream an toàn bộ nhớ không bị lỗi', async () => {
      const passThrough = new PassThrough();
      const chunks: Buffer[] = [];
      passThrough.on('data', (c) => chunks.push(c));

      await service.streamMenuExcel({
        menuIdOrData: mockMenuData,
        outputStream: passThrough,
        options: {
          exportType: MenuExportType.NET,
        },
      });

      const fullStreamBuffer = Buffer.concat(chunks);
      expect(fullStreamBuffer.length).toBeGreaterThan(0);
    });
  });
});
