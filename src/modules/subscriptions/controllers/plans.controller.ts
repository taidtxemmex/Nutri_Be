import { Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  Public,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Plans', ['plans', 'package', 'packages'])
export class PlansController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get(['active', 'getAll'])
  @ApiOperation({ summary: 'Lấy danh sách các gói cước đang kích hoạt để người dùng đăng ký' })
  @ApiStandardResponse({
    type: PlanResponseDto,
    isArray: true,
    description: 'Danh sách gói cước kích hoạt',
  })
  async getActivePlans(): Promise<PlanResponseDto[]> {
    return this.subscriptionsService.findAllPlans({ activeOnly: true });
  }

  @Public()
  @Get(['all', ''])
  @ApiOperation({
    summary: 'Lấy danh sách gói cước (Admin xem tất cả, Guest/User xem gói kích hoạt)',
  })
  @ApiStandardResponse({
    type: PlanResponseDto,
    isArray: true,
    description: 'Danh sách gói cước',
  })
  async getAllPlans(@CurrentUser() user?: any): Promise<PlanResponseDto[]> {
    const isAdmin =
      user &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.SUPERADMIN ||
        user.role === 'ADMIN' ||
        user.role === 'SUPERADMIN');
    return this.subscriptionsService.findAllPlans({ activeOnly: !isAdmin });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một gói cước theo ID' })
  @ApiParam({ name: 'id', description: 'ID gói cước' })
  @ApiStandardResponse({
    type: PlanResponseDto,
    description: 'Chi tiết gói cước',
  })
  async getPlanById(@Param('id') id: string): Promise<PlanResponseDto> {
    return this.subscriptionsService.findPlanById({ id });
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Post(['create', ''])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin tạo mới gói cước' })
  @ApiStandardResponse({
    type: PlanResponseDto,
    description: 'Tạo gói cước thành công',
  })
  async createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser() admin: any,
  ): Promise<PlanResponseDto> {
    return this.subscriptionsService.createPlan({ dto, adminUser: admin });
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Put('update-package')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Legacy alias: Cập nhật gói cước theo ID trong body' })
  @ApiStandardResponse({
    type: PlanResponseDto,
    description: 'Cập nhật gói cước thành công',
  })
  async updatePackageLegacy(
    @Body() dto: UpdatePlanDto,
    @CurrentUser() admin: any,
  ): Promise<PlanResponseDto> {
    const id = dto.id;
    if (!id) {
      throw new Error('ID gói cước không được để trống khi gọi update-package');
    }
    return this.subscriptionsService.updatePlan({ id, dto, adminUser: admin });
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Put(['update/:id', ':id'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin cập nhật thông tin gói cước theo ID' })
  @ApiParam({ name: 'id', description: 'ID gói cước' })
  @ApiStandardResponse({
    type: PlanResponseDto,
    description: 'Cập nhật gói cước thành công',
  })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() admin: any,
  ): Promise<PlanResponseDto> {
    return this.subscriptionsService.updatePlan({ id, dto, adminUser: admin });
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Delete(['delete/:id', ':id'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin xóa mềm gói cước' })
  @ApiParam({ name: 'id', description: 'ID gói cước' })
  @ApiStandardResponse({
    description: 'Xóa mềm gói cước thành công',
  })
  async deletePlan(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ): Promise<{ message: string; id: string }> {
    return this.subscriptionsService.deletePlan({ id, adminUser: admin });
  }
}
