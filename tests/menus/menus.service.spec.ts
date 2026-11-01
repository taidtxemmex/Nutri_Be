import { HttpException } from '@nestjs/common';
import { MenusService } from '../../src/modules/menus/services/menus.service';
import { MenuType, TargetType } from '../../src/config/enums/domain.enum';

describe('MenusService', () => {
  let service: MenusService;
  let mockPrisma: any;
  let mockCache: any;
  let mockNutritionCalculator: any;

  const mockUser = { id: 'user-uuid-1', role: 'USER' };
  const _mockAdmin = { id: 'admin-uuid-1', role: 'ADMIN' };

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      thuc_don: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bua_an: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      chi_tiet_thuc_don: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      chi_tiet_bua_an: {
        create: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      mon_an: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      chi_tiet_mon_an: {
        create: jest.fn(),
      },
      benh_nhan: {
        findFirst: jest.fn(),
      },
      de_xuat_thuc_don: {
        findFirst: jest.fn(),
      },
    };

    mockCache = {
      invalidateTag: jest.fn().mockResolvedValue(true),
    };

    mockNutritionCalculator = {
      calculateMealNutrition: jest.fn().mockReturnValue({
        dishes: [
          {
            dishWeight: 150,
            nutrients: { energy: 250, protein: 20 },
            ingredientBreakdown: [],
          },
        ],
        nutrients: { energy: 250, protein: 20 },
      }),
      getMenuEnergyDisplay: jest.fn().mockReturnValue('1800 - 2000 kcal'),
    };

    service = new MenusService(mockPrisma, mockCache, mockNutritionCalculator);
  });

  describe('1. create', () => {
    it('tạo thực đơn ngày lồng 5 cấp thành công trong 1 transaction và cập nhật tổng năng lượng', async () => {
      mockPrisma.thuc_don.create.mockResolvedValue({
        id: BigInt(10),
        ten_thuc_don: 'Thực đơn ngày 1',
        loai_thuc_don: MenuType.NGAY,
      });

      mockPrisma.bua_an.create.mockResolvedValue({ id: BigInt(101) });
      mockPrisma.mon_an.findFirst.mockResolvedValue({ id: BigInt(201) });
      mockPrisma.chi_tiet_thuc_don.create.mockResolvedValue({ id: BigInt(1) });
      mockPrisma.thuc_don.update.mockResolvedValue({});

      // Mock loadFullMenuEntityForCalculation
      mockPrisma.thuc_don.findUnique.mockResolvedValue({
        id: BigInt(10),
        ten_thuc_don: 'Thực đơn ngày 1',
        loai_thuc_don: MenuType.NGAY,
        chi_tiet_thuc_don: [],
      });

      const res = await service.create({
        dto: {
          menuName: 'Thực đơn ngày 1',
          menuType: MenuType.NGAY,
          targetType: TargetType.BENH_NHAN,
          meals: [
            {
              mealName: 'Bữa sáng',
              time: '07:00',
              dishes: [{ dishId: '201', coefficient: 1.0 }],
            },
          ],
        },
        currentUser: mockUser,
      });

      expect(res.id).toBe('10');
      expect(res.menuName).toBe('Thực đơn ngày 1');
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menus');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('2. getAll (Anti-Overfetching)', () => {
    it('lấy danh sách thực đơn với explicit select projection và đúng cấu trúc phân trang', async () => {
      mockPrisma.thuc_don.count.mockResolvedValue(1);
      mockPrisma.thuc_don.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          ten_thuc_don: 'Thực đơn test',
          loai_thuc_don: MenuType.NGAY,
          loai_doi_tuong: TargetType.BENH_NHAN,
          ngay_tao: new Date(),
          tong_nang_luong: '2000 kcal',
          nguoi_dung_id: mockUser.id,
          benh_nhan_id: BigInt(1),
          nhom_benh_id: null,
          gioi_han_dinh_duong_id: null,
          benh_nhan: { id: BigInt(1), ho_ten: 'Bệnh nhân A' },
          nhom_benh_mo_rong: null,
          nguoi_dung: {
            id: mockUser.id,
            ten_dang_nhap: 'bs_tai',
            ho_so_ca_nhan: { ho_ten: 'Bác sĩ Tài' },
          },
        },
      ]);

      const result = await service.getAll({ query: { page: 1, limit: 10 }, currentUser: mockUser });

      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('10');
      expect(result.items[0].patientName).toBe('Bệnh nhân A');
      expect(result.items[0].createdBy).toBe('Bác sĩ Tài');
    });
  });

  describe('3. update với Copy-on-Write (CoW)', () => {
    it('áp dụng Copy-on-Write: nếu bữa ăn được chia sẻ ở thực đơn khác (usageCount > 0), tách bản sao mới', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: mockUser.id,
        ten_thuc_don: 'Thực đơn cũ',
        loai_thuc_don: MenuType.NGAY,
      });

      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue(null);

      mockPrisma.thuc_don.update.mockResolvedValue({
        id: BigInt(10),
        ten_thuc_don: 'Thực đơn mới',
        loai_thuc_don: MenuType.NGAY,
      });

      // Meal 500 đang được dùng bởi menu khác
      mockPrisma.bua_an.findUnique.mockResolvedValue({
        id: BigInt(500),
        nguoi_dung_id: mockUser.id,
        ten_bua_an: 'Bữa trưa chia sẻ',
        gio_an: '12:00',
        chi_tiet_bua_an: [{ mon_an_id: BigInt(201), he_so_song_chin: 1.0 }],
      });

      mockPrisma.chi_tiet_thuc_don.count.mockResolvedValue(2); // > 0 -> CoW!
      mockPrisma.bua_an.create.mockResolvedValue({ id: BigInt(999) }); // Bản sao mới
      mockPrisma.mon_an.findFirst.mockResolvedValue({ id: BigInt(201) });

      // Mock calculation reload
      mockPrisma.thuc_don.findUnique.mockResolvedValue({
        id: BigInt(10),
        ten_thuc_don: 'Thực đơn mới',
        loai_thuc_don: MenuType.NGAY,
        chi_tiet_thuc_don: [],
      });

      const res = await service.update({
        id: '10',
        dto: {
          menuName: 'Thực đơn mới',
          meals: [
            {
              mealId: '500',
              mealName: 'Bữa trưa sửa',
              time: '12:30',
              dishes: [{ dishId: '201', coefficient: 1.0 }],
            },
          ],
        },
        currentUser: mockUser,
      });

      expect(res.id).toBe('10');
      expect(mockPrisma.bua_an.create).toHaveBeenCalled(); // Xác nhận CoW tạo bữa ăn mới
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menus');
    });

    it('từ chối sửa nếu thực đơn đang có đề xuất chờ duyệt (REQ-P02)', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: mockUser.id,
      });

      mockPrisma.de_xuat_thuc_don.findFirst.mockResolvedValue({ id: BigInt(1) });

      await expect(
        service.update({ id: '10', dto: { menuName: 'Thực đơn sửa' }, currentUser: mockUser }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('4. clone', () => {
    it('nhân bản sâu toàn bộ thực đơn và các bữa ăn con sang ID mới', async () => {
      mockPrisma.thuc_don.findFirst.mockResolvedValue({
        id: BigInt(10),
        nguoi_dung_id: 'user-uuid-1',
        ten_thuc_don: 'Thực đơn chuẩn',
        loai_thuc_don: MenuType.NGAY,
        loai_doi_tuong: TargetType.NHOM_BENH,
        benh_nhan_id: null,
        nhom_benh_id: 1,
        gioi_han_dinh_duong_id: null,
        chi_tiet_thuc_don: [
          {
            bua_an_id: BigInt(100),
            so_tuan: null,
            thu_trong_tuan: null,
            thu_tu_trong_tuan: 1,
            bua_an: {
              id: BigInt(100),
              ten_bua_an: 'Bữa sáng',
              gio_an: '07:00',
              chi_tiet_bua_an: [{ mon_an_id: BigInt(201), he_so_song_chin: 1.0 }],
            },
          },
        ],
      });

      mockPrisma.thuc_don.create.mockResolvedValue({
        id: BigInt(20),
        nguoi_dung_id: 'user-uuid-1',
        ten_thuc_don: '[Bản sao] Thực đơn chuẩn',
        loai_thuc_don: MenuType.NGAY,
      });

      mockPrisma.bua_an.create.mockResolvedValue({ id: BigInt(101) });

      mockPrisma.thuc_don.findUnique.mockResolvedValue({
        id: BigInt(20),
        nguoi_dung_id: 'user-uuid-1',
        ten_thuc_don: '[Bản sao] Thực đơn chuẩn',
        loai_thuc_don: MenuType.NGAY,
        chi_tiet_thuc_don: [],
      });

      const res = await service.clone({ id: '10', currentUser: mockUser });

      expect(res.id).toBe('20');
      expect(res.menuName).toBe('[Bản sao] Thực đơn chuẩn');
      expect(mockCache.invalidateTag).toHaveBeenCalledWith('menus');
    });
  });
});
