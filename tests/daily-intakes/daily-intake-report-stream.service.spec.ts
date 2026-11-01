import { HttpException, HttpStatus } from '@nestjs/common';
import { DailyIntakeReportStreamService } from '../../src/modules/daily-intakes/services/daily-intake-report-stream.service';
import { DailyIntakeExportRequestDto } from '../../src/modules/daily-intakes/dto/daily-intake-export-request.dto';
import { DailyIntakesController } from '../../src/modules/daily-intakes/controllers/daily-intakes.controller';
import { MenusController } from '../../src/modules/menus/controllers/menus.controller';
import { IngredientsController } from '../../src/modules/ingredients/controllers/ingredients.controller';
import { DishesController } from '../../src/modules/dishes/controllers/dishes.controller';
import { PassThrough } from 'stream';

describe('Task 6.4: Daily Intake Multi-Patient Export & Route Aliases', () => {
  let service: DailyIntakeReportStreamService;
  let mockPrisma: any;
  const mockUser = { id: 'user-uuid-1', role: 'USER' };

  // Giả lập mock Response của Express kế thừa PassThrough stream
  const createMockResponse = () => {
    const stream = new PassThrough() as any;
    stream.setHeader = jest.fn();
    stream.set = jest.fn();
    stream.status = jest.fn().mockReturnThis();
    stream.json = jest.fn().mockReturnThis();
    return stream;
  };

  beforeEach(() => {
    mockPrisma = {
      danh_muc: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ten_danh_muc: 'Ngũ cốc' },
          { id: 2, ten_danh_muc: 'Thịt và sản phẩm từ thịt' },
          { id: 3, ten_danh_muc: 'Rau củ' },
        ]),
      },
      benh_nhan: {
        findFirst: jest.fn(),
      },
      khau_phan_24h: {
        findMany: jest.fn(),
      },
    };

    service = new DailyIntakeReportStreamService(mockPrisma);
  });

  describe('1. DailyIntakeExportRequestDto Validation & Dải ngày y tế <= 31 ngày', () => {
    it('ném lỗi 422 EXPORT_DATE_RANGE_EXCEEDED khi dải ngày vượt quá 31 ngày', () => {
      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 1;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-11-05'; // 36 ngày > 31 ngày

      try {
        dto.validateDateRange();
        fail('Lẽ ra phải ném lỗi EXPORT_DATE_RANGE_EXCEEDED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY); // 422
        const res = err.getResponse();
        expect(res.code).toBe('EXPORT_DATE_RANGE_EXCEEDED');
        expect(res.message).toBe('Dải ngày xuất báo cáo không được vượt quá 31 ngày');
      }
    });

    it('chấp nhận dải ngày hợp lệ (31 ngày)', () => {
      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 1;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-31'; // Đúng 31 ngày

      expect(() => dto.validateDateRange()).not.toThrow();
    });

    it('ném lỗi 400 INVALID_DATE_RANGE khi fromDate > toDate', () => {
      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 1;
      dto.fromDate = '2026-10-20';
      dto.toDate = '2026-10-10';

      try {
        dto.validateDateRange();
        fail('Lẽ ra phải ném lỗi INVALID_DATE_RANGE');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse().code).toBe('INVALID_DATE_RANGE');
      }
    });

    it('kiểm tra bắt buộc patientId và mode cho templateType = 3', () => {
      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 3;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-07';

      // Thiếu patientId
      expect(() => dto.validateDateRange()).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'EXPORT_PATIENT_REQUIRED' }),
        }),
      );

      // Có patientId nhưng thiếu mode
      dto.patientId = '10';
      expect(() => dto.validateDateRange()).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'EXPORT_MODE_REQUIRED' }),
        }),
      );

      // Đầy đủ
      dto.mode = 'BY_MEAL';
      expect(() => dto.validateDateRange()).not.toThrow();
    });
  });

  describe('2. Mẫu 1: streamTotalFoodGroupMultiPatients', () => {
    it('ném lỗi 404 EXPORT_NO_DATA khi không có dữ liệu khẩu phần trong dải ngày', async () => {
      mockPrisma.khau_phan_24h.findMany.mockResolvedValue([]);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 1;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-05';

      const res = createMockResponse();

      await expect(service.streamTotalFoodGroupMultiPatients(dto, res, mockUser)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'EXPORT_NO_DATA' }),
        }),
      );
    });

    it('xuất báo cáo Mẫu 1 thành công khi có dữ liệu khẩu phần', async () => {
      mockPrisma.khau_phan_24h.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ngay_an: new Date('2026-10-15T00:00:00.000Z'),
          benh_nhan: {
            id: BigInt(10),
            ma_benh_nhan_bv: 'BN001',
            ho_ten: 'Nguyễn Văn A',
            gioi_tinh: 'NAM',
            ngay_sinh: new Date('1990-01-01'),
          },
          khau_phan_24h_bua_an: [
            {
              khau_phan_24h_nguyen_lieu: [
                {
                  khoi_luong_song_sach: 150,
                  nguyen_lieu: {
                    id: BigInt(101),
                    ten_nguyen_lieu: 'Gạo tẻ',
                    danh_muc: 1,
                    loai_protein: 'THUC_VAT',
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: { ten_danh_muc: 'Ngũ cốc' },
                    water: 13.8,
                    protein: 7.9,
                    fat: 0.7,
                    ash: 0.6,
                    fiber: 0.4,
                  },
                },
                {
                  khoi_luong_song_sach: 100,
                  nguyen_lieu: {
                    id: BigInt(102),
                    ten_nguyen_lieu: 'Thịt bò',
                    danh_muc: 2,
                    loai_protein: 'DONG_VAT',
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      ten_danh_muc: 'Thịt và sản phẩm từ thịt',
                    },
                    water: 72.0,
                    protein: 21.5,
                    fat: 4.5,
                    ash: 1.0,
                    fiber: 0.0,
                  },
                },
              ],
            },
          ],
        },
      ]);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 1;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-20';

      const res = createMockResponse();
      await expect(
        service.streamTotalFoodGroupMultiPatients(dto, res, mockUser),
      ).resolves.not.toThrow();
    });
  });

  describe('3. Mẫu 2: streamAvgGroupWeightPerPatient', () => {
    it('thống kê khối lượng trung bình từng nhóm thực phẩm / đầu người thành công', async () => {
      mockPrisma.khau_phan_24h.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ngay_an: new Date('2026-10-15T00:00:00.000Z'),
          benh_nhan_id: BigInt(10),
          khau_phan_24h_bua_an: [
            {
              khau_phan_24h_nguyen_lieu: [
                {
                  khoi_luong_song_sach: 200,
                  nguyen_lieu: {
                    danh_muc: 1,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: { ten_danh_muc: 'Ngũ cốc' },
                  },
                },
              ],
            },
          ],
        },
        {
          id: BigInt(2),
          ngay_an: new Date('2026-10-15T00:00:00.000Z'),
          benh_nhan_id: BigInt(11),
          khau_phan_24h_bua_an: [
            {
              khau_phan_24h_nguyen_lieu: [
                {
                  khoi_luong_song_sach: 100,
                  nguyen_lieu: {
                    danh_muc: 1,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: { ten_danh_muc: 'Ngũ cốc' },
                  },
                },
              ],
            },
          ],
        },
      ]);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 2;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-20';

      const res = createMockResponse();
      await expect(
        service.streamAvgGroupWeightPerPatient(dto, res, mockUser),
      ).resolves.not.toThrow();
    });
  });

  describe('4. Mẫu 3: streamPatientDailyNutrition', () => {
    it('ném lỗi 404 PATIENT_NOT_FOUND khi bệnh nhân không tồn tại', async () => {
      mockPrisma.benh_nhan.findFirst.mockResolvedValue(null);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 3;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-05';
      dto.patientId = '9999';
      dto.mode = 'BY_MEAL';

      const res = createMockResponse();
      await expect(service.streamPatientDailyNutrition(dto, res, mockUser)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'PATIENT_NOT_FOUND' }),
        }),
      );
    });

    it('xuất chi tiết khẩu phần bệnh nhân theo bữa ăn (BY_MEAL) có dòng TỔNG BỮA và TỔNG NGÀY', async () => {
      mockPrisma.benh_nhan.findFirst.mockResolvedValue({
        id: BigInt(10),
        ma_benh_nhan_bv: 'BN001',
        ho_ten: 'Trần Thị B',
        gioi_tinh: 'NU',
        ngay_sinh: new Date('1985-05-15'),
      });

      mockPrisma.khau_phan_24h.findMany.mockResolvedValue([
        {
          id: BigInt(100),
          ngay_an: new Date('2026-10-10T00:00:00.000Z'),
          kieu_nhap: 'BY_MEAL',
          khau_phan_24h_bua_an: [
            {
              id: BigInt(1),
              thu_tu_bua: 1,
              ten_bua: 'Bữa sáng',
              khau_phan_24h_nguyen_lieu: [
                {
                  khoi_luong_song_sach: 80,
                  nguyen_lieu: {
                    id: BigInt(5),
                    ten_nguyen_lieu: 'Trứng gà',
                    danh_muc: 2,
                    loai_protein: 'DONG_VAT',
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
                      ten_danh_muc: 'Thịt và sản phẩm từ thịt',
                    },
                    water: 74.0,
                    protein: 13.0,
                    fat: 11.0,
                    ash: 1.0,
                    fiber: 0.0,
                  },
                },
              ],
            },
          ],
        },
      ]);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 3;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-15';
      dto.patientId = '10';
      dto.mode = 'BY_MEAL';

      const res = createMockResponse();
      await expect(service.streamPatientDailyNutrition(dto, res, mockUser)).resolves.not.toThrow();
    });
  });

  describe('5. Mẫu 4: streamTotalWeightFoodGroupMultiPatients', () => {
    it('xuất 2 trang tính TONG_KL_NHOM_THUC_PHAM và TRUNG_BINH thành công', async () => {
      mockPrisma.khau_phan_24h.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ngay_an: new Date('2026-10-15T00:00:00.000Z'),
          benh_nhan: {
            id: BigInt(10),
            ma_benh_nhan_bv: 'BN001',
            ho_ten: 'Lê Văn C',
            gioi_tinh: 'NAM',
            ngay_sinh: new Date('1995-03-20'),
          },
          khau_phan_24h_bua_an: [
            {
              khau_phan_24h_nguyen_lieu: [
                {
                  khoi_luong_song_sach: 120,
                  nguyen_lieu: {
                    danh_muc: 1,
                    danh_muc_nguyen_lieu_danh_mucTodanh_muc: { ten_danh_muc: 'Ngũ cốc' },
                  },
                },
              ],
            },
          ],
        },
      ]);

      const dto = new DailyIntakeExportRequestDto();
      dto.templateType = 4;
      dto.fromDate = '2026-10-01';
      dto.toDate = '2026-10-20';

      const res = createMockResponse();
      await expect(
        service.streamTotalWeightFoodGroupMultiPatients(dto, res, mockUser),
      ).resolves.not.toThrow();
    });
  });

  describe('6. Route Aliases Verification (Requirement 2)', () => {
    it('khẳng định DailyIntakesController có metadata path: daily-intakes và daily-intake', () => {
      const paths = Reflect.getMetadata('path', DailyIntakesController);
      expect(paths).toEqual(expect.arrayContaining(['daily-intakes', 'daily-intake']));
    });

    it('khẳng định MenusController có metadata path: menus và menu', () => {
      const paths = Reflect.getMetadata('path', MenusController);
      expect(paths).toEqual(expect.arrayContaining(['menus', 'menu']));
    });

    it('khẳng định IngredientsController có metadata path: ingredients và ingredient', () => {
      const paths = Reflect.getMetadata('path', IngredientsController);
      expect(paths).toEqual(expect.arrayContaining(['ingredients', 'ingredient']));
    });

    it('khẳng định DishesController có metadata path: dishes và dish', () => {
      const paths = Reflect.getMetadata('path', DishesController);
      expect(paths).toEqual(expect.arrayContaining(['dishes', 'dish']));
    });
  });
});
