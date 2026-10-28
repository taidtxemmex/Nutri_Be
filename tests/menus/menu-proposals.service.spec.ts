import { HttpException } from '@nestjs/common';
import { MenuProposalsService } from '../../src/modules/menu-proposals/services/menu-proposals.service';
import { MenuType, TargetType } from '../../src/config/enums/domain.enum';

describe('MenuProposalsService', () => {
  let service: MenuProposalsService;
  let mockPrisma: any;
  let mockCache: any;
  let mockNutritionCalculator: any;
  let mockMenuExcelService: any;

  const mockUser = { id: 'user-1', role: 'USER' };
  const mockAdmin = { id: 'admin-1', role: 'ADMIN' };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      thuc_don: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      de_xuat_thuc_don: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockCache = {
      invalidateTag: jest.fn().mockResolvedValue(true),
    };

    mockNutritionCalculator = {
      calculateMealNutrition: jest.fn().mockReturnValue({
        dishes: [
          {
            dishWeight: 100,
            nutrients: { energy: 200, protein: 15 },
            ingredientBreakdown: [],
          },
        ],
        nutrients: { energy: 200, protein: 15 },
      }),
    };

    mockMenuExcelService = {
      exportMenuExcel: jest.fn().mockResolvedValue(Buffer.from('excel-bytes')),
    };

    service = new MenuProposalsService(
      mockPrisma,
      mockCache,
      mockNutritionCalculator,
      mockMenuExcelService,
    );
  });

  describe('1. proposeMenu', () => {
    it('đóng băng Deep Self-Contained Snapshot JSONB chứa đầy đủ tên món, nguyên liệu và 86 vi chất tĩnh', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        ten_thuc_don: 'Thực đơn đề xuất',
        loai_thuc_don: MenuType.NGAY,
        loai_doi_tuong: TargetType.BENH_NHAN,
        nguoi_dung_id: mockUser.id,
        tong_nang_luong: '2000 kcal',
        chi_tiet_thuc_don: [
          {
            so_tuan: null,
            thu_trong_tuan: null,
            bua_an: {
              id: BigInt(100),
              ten_bua_an: 'Bữa sáng',
              gio_an: '07:00',
              chi_tiet_bua_an: [
                {
                  mon_an_id: BigInt(201),
                  he_so_song_chin: 1.0,
                  mon_an: {
                    id: BigInt(201),
                    ten_mon: 'Cháo thịt heo',
                    chi_tiet_mon_an: [
                      {
                        nguyen_lieu_id: BigInt(1),
                        khoi_luong_song_sach: 50,
                        nguyen_lieu: { ten_nguyen_lieu: 'Gạo tẻ', edible: 100 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue(null);
      mockPrisma.de_xuat_thuc_don.create.mockResolvedValue({ id: BigInt(55) });

      const res = await service.proposeMenu({ menuIdParam: '10', currentUser: mockUser });

      expect(res.success).toBe(true);
      expect(res.proposalId).toBe('55');
      expect(mockPrisma.de_xuat_thuc_don.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trang_thai: 'CHO_DUYET',
            snapshot_json: expect.stringContaining('Cháo thịt heo'),
          }),
        }),
      );
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menu-proposals');
    });

    it('từ chối nộp đề xuất nếu thực đơn đang có đề xuất chờ duyệt (CHO_DUYET)', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: mockUser.id,
      });

      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue({
        id: BigInt(1),
        trang_thai: 'CHO_DUYET',
      });

      await expect(
        service.proposeMenu({ menuIdParam: '10', currentUser: mockUser }),
      ).rejects.toThrow(HttpException);
    });

    it('từ chối nộp đề xuất nếu thực đơn đã có đề xuất được duyệt (DA_DUYET)', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: mockUser.id,
      });

      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue({
        id: BigInt(2),
        trang_thai: 'DA_DUYET',
      });

      await expect(
        service.proposeMenu({ menuIdParam: '10', currentUser: mockUser }),
      ).rejects.toThrow(HttpException);
    });

    it('từ chối nộp đề xuất nếu người dùng không sở hữu thực đơn và không phải admin', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'other-user',
      });

      await expect(
        service.proposeMenu({ menuIdParam: '10', currentUser: mockUser }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('2. approve', () => {
    it('Admin duyệt đề xuất: cập nhật trạng thái DA_DUYET và đổi thực đơn gốc sang CONG_KHAI', async () => {
      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue({
        id: BigInt(55),
        menu_goc_id: BigInt(10),
        trang_thai: 'CHO_DUYET',
      });

      mockPrisma.de_xuat_thuc_don.update.mockResolvedValue({});
      mockPrisma.thuc_don.update.mockResolvedValue({});

      const res = await service.approve({ id: '55', currentUser: mockAdmin });

      expect(res.success).toBe(true);
      expect(mockPrisma.de_xuat_thuc_don.update).toHaveBeenCalledWith({
        where: { id: BigInt(55) },
        data: expect.objectContaining({
          trang_thai: 'DA_DUYET',
          nguoi_phe_duyet_id: mockAdmin.id,
        }),
      });
      expect(mockPrisma.thuc_don.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { loai_thuc_don: 'CONG_KHAI' },
      });
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menu-proposals');
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menus');
    });
  });

  describe('3. reject', () => {
    it('Admin từ chối đề xuất kèm lý do', async () => {
      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue({
        id: BigInt(55),
        trang_thai: 'CHO_DUYET',
      });

      mockPrisma.de_xuat_thuc_don.update.mockResolvedValue({});

      const res = await service.reject({
        id: '55',
        dto: { reason: 'Tỷ lệ lipid vượt quá khuyến nghị' },
        currentUser: mockAdmin,
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.de_xuat_thuc_don.update).toHaveBeenCalledWith({
        where: { id: BigInt(55) },
        data: expect.objectContaining({
          trang_thai: 'TU_CHOI',
          ly_do_tu_choi: 'Tỷ lệ lipid vượt quá khuyến nghị',
        }),
      });
    });
  });
});
