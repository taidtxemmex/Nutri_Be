import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/modules/subscriptions/services/subscriptions.service';
import {
  CACHE_TAG_PACKAGES,
  CACHE_TAG_PLANS,
  CACHE_TAG_SUBSCRIPTIONS,
  CACHE_TAG_USERS,
  buildUserCacheTag,
} from '../../src/config/constants/cache.constants';
import { CreatePlanDto, UpdatePlanDto, SubscriptionRequestDto, SubscriptionApproveDto } from '../../src/modules/subscriptions/dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let mockPrisma: any;
  let mockCacheService: any;

  beforeEach(() => {
    mockPrisma = {
      goi: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      nguoi_dung: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      yeu_cau_thanh_toan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      minh_chung: {
        create: jest.fn(),
      },
      dang_ky: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
      $queryRaw: jest.fn(),
    };

    mockCacheService = {
      generateKey: jest.fn((prefix, params) => `cache:${prefix}:${JSON.stringify(params)}`),
      getOrSet: jest.fn(async (_k, _ttl, factory) => factory()),
      invalidateTags: jest.fn().mockResolvedValue(undefined),
      invalidateTag: jest.fn().mockResolvedValue(undefined),
    };

    service = new SubscriptionsService(mockPrisma, mockCacheService);
  });

  describe('Birthday Paradox Mitigation (Transaction Code Generator)', () => {
    it('should generate transaction code with format TX-yyMMdd-XXXXXX', () => {
      const code = service.generateTransactionCode();
      expect(code).toMatch(/^TX-\d{6}-[A-F0-9]{6}$/);
    });

    it('should generate 1000 unique codes without collision (Birthday Paradox test)', () => {
      const set = new Set<string>();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const code = service.generateTransactionCode();
        expect(set.has(code)).toBe(false);
        set.add(code);
      }
      expect(set.size).toBe(iterations);
    });
  });

  describe('Plans Management (CRUD)', () => {
    it('should create plan successfully and invalidate cache tags', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue(null);
      mockPrisma.goi.create.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        gia_tien: 199000,
        mo_ta: 'Gói thử nghiệm',
        trang_thai: 'ACTIVE',
        ngay_tao: new Date(),
        ngay_cap_nhat: new Date(),
      });

      const dto = new CreatePlanDto();
      dto.ma_goi = 'PRO_1M';
      dto.ten_goi = 'Gói Pro 1 Tháng';
      dto.so_ngay_su_dung = 30;
      dto.gia_tien = 199000;

      const result = await service.createPlan(dto);
      expect(result.id).toBe('1');
      expect(result.ma_goi).toBe('PRO_1M');
      expect(result.packageCode).toBe('PRO_1M');
      expect(result.gia_tien).toBe(199000);
      expect(mockCacheService.invalidateTags).toHaveBeenCalledWith([CACHE_TAG_PACKAGES, CACHE_TAG_PLANS]);
    });

    it('should throw ConflictException if package code already exists', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({ id: BigInt(10) });

      const dto = new CreatePlanDto();
      dto.ma_goi = 'PRO_1M';
      dto.ten_goi = 'Gói Pro';

      await expect(service.createPlan(dto)).rejects.toThrow(ConflictException);
    });

    it('should find plan by id successfully', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({
        id: BigInt(2),
        ma_goi: 'PRO_1Y',
        ten_goi: 'Gói Pro 1 Năm',
        so_ngay_su_dung: 365,
        gia_tien: 1990000,
        mo_ta: null,
        trang_thai: 'ACTIVE',
      });

      const plan = await service.findPlanById('2');
      expect(plan.id).toBe('2');
      expect(plan.ma_goi).toBe('PRO_1Y');
      expect(plan.so_ngay_su_dung).toBe(365);
    });

    it('should throw NotFoundException if plan id not found', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue(null);
      await expect(service.findPlanById('999')).rejects.toThrow(NotFoundException);
    });

    it('should update plan and invalidate cache tags', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({ id: BigInt(1), ma_goi: 'PRO_1M' });
      mockPrisma.goi.update.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro Đổi Tên',
        so_ngay_su_dung: 30,
        gia_tien: 250000,
        mo_ta: 'Updated',
        trang_thai: 'ACTIVE',
      });

      const dto = new UpdatePlanDto();
      dto.name = 'Gói Pro Đổi Tên';
      dto.price = 250000;

      const res = await service.updatePlan('1', dto);
      expect(res.ten_goi).toBe('Gói Pro Đổi Tên');
      expect(res.gia_tien).toBe(250000);
      expect(mockCacheService.invalidateTags).toHaveBeenCalled();
    });

    it('should soft delete plan and set trang_thai to INACTIVE', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({ id: BigInt(1) });
      mockPrisma.goi.update.mockResolvedValue({ id: BigInt(1) });

      const res = await service.deletePlan('1');
      expect(res.message).toContain('thành công');
      expect(mockPrisma.goi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({
            trang_thai: 'INACTIVE',
            deleted_at: expect.any(Date),
          }),
        }),
      );
      expect(mockCacheService.invalidateTags).toHaveBeenCalled();
    });
  });

  describe('Subscription Payment Requests', () => {
    it('should create subscription payment request successfully', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        gia_tien: 199000,
        trang_thai: 'ACTIVE',
      });

      mockPrisma.nguoi_dung.findFirst.mockResolvedValue({
        id: 'user-uuid-1',
        ten_dang_nhap: 'doctor_a',
        ho_so_ca_nhan: { ho_ten: 'Bác Sĩ Nguyễn' },
      });

      mockPrisma.yeu_cau_thanh_toan.findUnique
        .mockResolvedValueOnce(null) // for uniqueness check
        .mockResolvedValueOnce({
          id: BigInt(101),
          ma_giao_dich: 'TX-261027-ABC123',
          ma_goi: 'PRO_1M',
          ten_goi: 'Gói Pro 1 Tháng',
          so_ngay_su_dung: 30,
          so_tien: 199000,
          trang_thai: 'PENDING',
          ngay_tao: new Date(),
          minh_chung: [],
        });

      mockPrisma.yeu_cau_thanh_toan.create.mockResolvedValue({ id: BigInt(101) });

      const dto = new SubscriptionRequestDto();
      dto.ma_goi = 'PRO_1M';

      const res = await service.requestSubscription('user-uuid-1', dto);
      expect(res.id).toBe('101');
      expect(res.trang_thai).toBe('PENDING');
      expect(res.username).toBe('doctor_a');
      expect(res.fullName).toBe('Bác Sĩ Nguyễn');
      expect(mockCacheService.invalidateTag).toHaveBeenCalledWith(CACHE_TAG_SUBSCRIPTIONS);
    });

    it('should throw BadRequestException when requesting inactive package', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_OLD',
        trang_thai: 'INACTIVE',
      });

      const dto = new SubscriptionRequestDto();
      dto.ma_goi = 'PRO_OLD';

      await expect(service.requestSubscription('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Cumulative Extension & Pessimistic Locking on Approval', () => {
    it('Case 1: User whose PRO has expired (or null) -> new expiry is now + usageDays', async () => {
      const now = new Date('2026-10-27T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(50),
        nguoi_dung_id: 'user-expired',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'PENDING',
        ma_giao_dich: 'TX-261027-111111',
      });

      // User expired yesterday
      const yesterday = new Date('2026-10-26T10:00:00.000Z');
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'user-expired',
          vai_tro: 'USER',
          pro_expired_at: yesterday,
        },
      ]);

      mockPrisma.nguoi_dung.update.mockResolvedValue({});
      mockPrisma.dang_ky.create.mockResolvedValue({});
      mockPrisma.yeu_cau_thanh_toan.update.mockResolvedValue({
        id: BigInt(50),
        nguoi_dung_id: 'user-expired',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'APPROVED',
        ngay_phe_duyet: now,
        ma_giao_dich: 'TX-261027-111111',
        minh_chung: [],
        nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung: {
          ten_dang_nhap: 'user_exp',
          ho_so_ca_nhan: { ho_ten: 'Người Dùng Hết Hạn' },
        },
      });

      const res = await service.approveSubscription('50', 'admin-id');
      expect(res.trang_thai).toBe('APPROVED');

      // Check cumulative calculation: 30 days added to `now`
      const expectedNewExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-expired' },
          data: {
            vai_tro: 'USERPRO',
            pro_expired_at: expectedNewExpiry,
          },
        }),
      );

      // Check dang_ky record created
      expect(mockPrisma.dang_ky.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nguoi_dung_id: 'user-expired',
            ma_goi: 'PRO_1M',
            ngay_bat_dau: now,
            ngay_ket_thuc: expectedNewExpiry,
            trang_thai: 'ACTIVE',
            thanh_toan_id: BigInt(50),
          }),
        }),
      );

      // Check cache invalidation for users and user:${id}
      expect(mockCacheService.invalidateTags).toHaveBeenCalledWith(
        expect.arrayContaining([
          CACHE_TAG_USERS,
          buildUserCacheTag('user-expired'),
          CACHE_TAG_SUBSCRIPTIONS,
        ]),
      );

      jest.useRealTimers();
    });

    it('Case 2: User STILL HAS 10 DAYS remaining -> new expiry is cumulative (remaining + 30 days)', async () => {
      const now = new Date('2026-10-27T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(51),
        nguoi_dung_id: 'user-active-pro',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'PENDING',
        ma_giao_dich: 'TX-261027-222222',
      });

      // User still has 10 days left
      const existingExpiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days in future
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'user-active-pro',
          vai_tro: 'USERPRO',
          pro_expired_at: existingExpiry,
        },
      ]);

      mockPrisma.nguoi_dung.update.mockResolvedValue({});
      mockPrisma.dang_ky.create.mockResolvedValue({});
      mockPrisma.yeu_cau_thanh_toan.update.mockResolvedValue({
        id: BigInt(51),
        nguoi_dung_id: 'user-active-pro',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'APPROVED',
        ngay_phe_duyet: now,
        ma_giao_dich: 'TX-261027-222222',
        minh_chung: [],
      });

      await service.approveSubscription('51', 'admin-id');

      // CRITICAL ASSERTION: New expiry must be 10 days + 30 days = 40 days from now!
      const expectedCumulativeExpiry = new Date(existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-active-pro' },
          data: {
            vai_tro: 'USERPRO',
            pro_expired_at: expectedCumulativeExpiry,
          },
        }),
      );

      // Check dang_ky dates start from existingExpiry to expectedCumulativeExpiry
      expect(mockPrisma.dang_ky.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nguoi_dung_id: 'user-active-pro',
            ma_goi: 'PRO_1M',
            ngay_bat_dau: existingExpiry,
            ngay_ket_thuc: expectedCumulativeExpiry,
            trang_thai: 'ACTIVE',
            thanh_toan_id: BigInt(51),
          }),
        }),
      );

      jest.useRealTimers();
    });

    it('should keep ADMIN role when an ADMIN user subscribes to PRO (do not downgrade to USERPRO)', async () => {
      const now = new Date('2026-10-27T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(60),
        nguoi_dung_id: 'admin-user-id',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'PENDING',
        ma_giao_dich: 'TX-261027-333333',
      });

      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'admin-user-id',
          vai_tro: 'ADMIN',
          pro_expired_at: null,
        },
      ]);

      mockPrisma.nguoi_dung.update.mockResolvedValue({});
      mockPrisma.dang_ky.create.mockResolvedValue({});
      mockPrisma.yeu_cau_thanh_toan.update.mockResolvedValue({
        id: BigInt(60),
        nguoi_dung_id: 'admin-user-id',
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        so_tien: 199000,
        trang_thai: 'APPROVED',
        ngay_phe_duyet: now,
        ma_giao_dich: 'TX-261027-333333',
        minh_chung: [],
        nguoi_dung_yeu_cau_thanh_toan_nguoi_dung_idTonguoi_dung: {
          ten_dang_nhap: 'admin_boss',
          ho_so_ca_nhan: { ho_ten: 'Admin Boss' },
        },
      });

      await service.approveSubscription('60', 'superadmin-id');

      // Assert: Role must remain ADMIN, not USERPRO!
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'admin-user-id' },
          data: expect.objectContaining({
            vai_tro: 'ADMIN',
          }),
        }),
      );

      jest.useRealTimers();
    });

    it('should throw BadRequestException if approving an already APPROVED request', async () => {
      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(52),
        trang_thai: 'APPROVED',
      });

      await expect(service.approveSubscription('52', 'admin-id')).rejects.toThrow(BadRequestException);
    });

    it('should reject payment request and record reason', async () => {
      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(53),
        trang_thai: 'PENDING',
      });
      mockPrisma.yeu_cau_thanh_toan.update.mockResolvedValue({
        id: BigInt(53),
        trang_thai: 'REJECTED',
        ly_do_tu_choi: 'Không thấy tiền nổi',
        minh_chung: [],
      });

      const dto = new SubscriptionApproveDto();
      dto.lyDoTuChoi = 'Không thấy tiền nổi';

      const res = await service.rejectSubscription('53', 'admin-id', dto);
      expect(res.trang_thai).toBe('REJECTED');
      expect(res.ly_do_tu_choi).toBe('Không thấy tiền nổi');
      expect(mockCacheService.invalidateTag).toHaveBeenCalledWith(CACHE_TAG_SUBSCRIPTIONS);
    });

    it('should throw BadRequestException if rejecting an already REJECTED request', async () => {
      mockPrisma.yeu_cau_thanh_toan.findUnique.mockResolvedValue({
        id: BigInt(54),
        trang_thai: 'REJECTED',
      });

      const dto = new SubscriptionApproveDto();
      await expect(service.rejectSubscription('54', 'admin-id', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Document Security Validation in Request Subscription', () => {
    it('should reject request subscription if document externalLink has invalid scheme (e.g. javascript:)', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        gia_tien: 199000,
        trang_thai: 'ACTIVE',
      });
      mockPrisma.nguoi_dung.findFirst.mockResolvedValue({
        id: 'user-1',
        ten_dang_nhap: 'user_1',
      });

      const dto = new SubscriptionRequestDto();
      dto.packageCode = 'PRO_1M';
      dto.documents = [
        {
          externalLink: 'javascript:alert(1)',
        },
      ];

      await expect(service.requestSubscription('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject request subscription if document objectKey has path traversal', async () => {
      mockPrisma.goi.findFirst.mockResolvedValue({
        id: BigInt(1),
        ma_goi: 'PRO_1M',
        ten_goi: 'Gói Pro 1 Tháng',
        so_ngay_su_dung: 30,
        gia_tien: 199000,
        trang_thai: 'ACTIVE',
      });
      mockPrisma.nguoi_dung.findFirst.mockResolvedValue({
        id: 'user-1',
        ten_dang_nhap: 'user_1',
      });

      const dto = new SubscriptionRequestDto();
      dto.packageCode = 'PRO_1M';
      dto.documents = [
        {
          objectKey: '../../../etc/passwd',
        },
      ];

      await expect(service.requestSubscription('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });
});
