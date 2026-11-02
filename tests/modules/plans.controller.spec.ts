import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PlansController } from '../../src/modules/subscriptions/controllers/plans.controller';
import { SubscriptionsService } from '../../src/modules/subscriptions/services/subscriptions.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from '../../src/modules/subscriptions/dto';

describe('PlansController - Subscription Plans Management', () => {
  let controller: PlansController;
  let mockSubscriptionsService: {
    findAllPlans: jest.Mock;
    findPlanById: jest.Mock;
    createPlan: jest.Mock;
    updatePlan: jest.Mock;
    deletePlan: jest.Mock;
  };

  const samplePlan: PlanResponseDto = {
    id: 'plan-1',
    ma_goi: 'PRO_1M',
    packageCode: 'PRO_1M',
    ten_goi: 'Gói Chuyên Gia',
    packageName: 'Gói Chuyên Gia',
    gia_tien: 500000,
    price: 500000,
    so_ngay_su_dung: 30,
    usageDays: 30,
    trang_thai: 'ACTIVE',
    packageStatus: 'ACTIVE',
    ngay_tao: new Date(),
    ngay_cap_nhat: new Date(),
  };

  const adminUser = {
    id: 'admin-uuid',
    username: 'admin',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    mockSubscriptionsService = {
      findAllPlans: jest.fn(),
      findPlanById: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      deletePlan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
  });

  describe('getActivePlans', () => {
    it('should query active plans only', async () => {
      mockSubscriptionsService.findAllPlans.mockResolvedValueOnce([samplePlan]);

      const result = await controller.getActivePlans();

      expect(result).toEqual([samplePlan]);
      expect(mockSubscriptionsService.findAllPlans).toHaveBeenCalledWith({ activeOnly: true });
    });
  });

  describe('getAllPlans', () => {
    it('should query all plans including inactive ones', async () => {
      mockSubscriptionsService.findAllPlans.mockResolvedValueOnce([samplePlan]);

      const result = await controller.getAllPlans();

      expect(result).toEqual([samplePlan]);
      expect(mockSubscriptionsService.findAllPlans).toHaveBeenCalledWith(false);
    });
  });

  describe('getPlanById', () => {
    it('should retrieve plan by id', async () => {
      mockSubscriptionsService.findPlanById.mockResolvedValueOnce(samplePlan);

      const result = await controller.getPlanById('plan-1');

      expect(result).toEqual(samplePlan);
      expect(mockSubscriptionsService.findPlanById).toHaveBeenCalledWith({ id: 'plan-1' });
    });
  });

  describe('createPlan', () => {
    it('should allow admin to create a new plan', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        ten_goi: 'Gói Mới',
        gia_tien: 200000,
        so_ngay_su_dung: 30,
      });

      mockSubscriptionsService.createPlan.mockResolvedValueOnce({
        id: 'plan-new',
        ...dto,
      });

      const result = await controller.createPlan(dto, adminUser);

      expect(result.id).toBe('plan-new');
      expect(mockSubscriptionsService.createPlan).toHaveBeenCalledWith({
        dto,
        adminUser,
      });
    });
  });

  describe('updatePlan & updatePackageLegacy', () => {
    it('should update plan by id param', async () => {
      const dto = plainToInstance(UpdatePlanDto, {
        ten_goi: 'Gói VIP Cập Nhật',
        gia_tien: 600000,
      });

      mockSubscriptionsService.updatePlan.mockResolvedValueOnce({
        ...samplePlan,
        ten_goi: 'Gói VIP Cập Nhật',
        packageName: 'Gói VIP Cập Nhật',
      });

      const result = await controller.updatePlan('plan-1', dto, adminUser);

      expect(result.ten_goi).toBe('Gói VIP Cập Nhật');
      expect(mockSubscriptionsService.updatePlan).toHaveBeenCalledWith({
        id: 'plan-1',
        dto,
        adminUser,
      });
    });

    it('should throw BadRequestException if legacy update-package lacks id in body', async () => {
      const dto = plainToInstance(UpdatePlanDto, {
        ten_goi: 'Missing ID',
      });

      await expect(controller.updatePackageLegacy(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should succeed legacy update-package when id is present in body', async () => {
      const dto = plainToInstance(UpdatePlanDto, {
        id: 'plan-1',
        ten_goi: 'Legacy Updated',
      });

      mockSubscriptionsService.updatePlan.mockResolvedValueOnce({
        ...samplePlan,
        ten_goi: 'Legacy Updated',
      });

      const result = await controller.updatePackageLegacy(dto, adminUser);

      expect(result.ten_goi).toBe('Legacy Updated');
      expect(mockSubscriptionsService.updatePlan).toHaveBeenCalledWith({
        id: 'plan-1',
        dto,
        adminUser,
      });
    });
  });

  describe('deletePlan', () => {
    it('should soft-delete plan by id', async () => {
      mockSubscriptionsService.deletePlan.mockResolvedValueOnce({
        message: 'Deleted successfully',
        id: 'plan-1',
      });

      const result = await controller.deletePlan('plan-1', adminUser);

      expect(result.id).toBe('plan-1');
      expect(mockSubscriptionsService.deletePlan).toHaveBeenCalledWith({
        id: 'plan-1',
        adminUser,
      });
    });
  });
});
