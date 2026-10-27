import {
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SubscriptionsService } from '../services/subscriptions.service';
import {
  SubscriptionRequestDto,
  SubscriptionApproveDto,
  SubscriptionResponseDto,
} from '../dto';
import { ApiController, ApiStandardResponse, Auth, CurrentUser } from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Subscriptions', ['subscriptions', 'subscription', 'admin/subscriptions'], { auth: true })
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post(['request', 'payment-request'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Người dùng yêu cầu đăng ký / nâng cấp gói cước PRO' })
  @ApiStandardResponse({
    type: SubscriptionResponseDto,
    description: 'Tạo yêu cầu thanh toán thành công',
  })
  async requestSubscription(
    @Body() dto: SubscriptionRequestDto,
    @CurrentUser() user: any,
  ): Promise<SubscriptionResponseDto> {
    const userId = user?.id || user?.sub;
    return this.subscriptionsService.requestSubscription(userId, dto);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Người dùng xem danh sách yêu cầu nâng cấp của chính mình' })
  @ApiStandardResponse({
    type: SubscriptionResponseDto,
    isArray: true,
    description: 'Danh sách yêu cầu thanh toán của tôi',
  })
  async getMyRequests(@CurrentUser() user: any): Promise<SubscriptionResponseDto[]> {
    const userId = user?.id || user?.sub;
    return this.subscriptionsService.listUserRequests(userId);
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Get(['list', ''])
  @ApiOperation({ summary: 'Admin xem danh sách toàn bộ yêu cầu thanh toán' })
  @ApiQuery({
    name: 'statuses',
    required: false,
    description: 'Lọc theo trạng thái (PENDING, APPROVED, REJECTED...)',
  })
  @ApiStandardResponse({
    type: SubscriptionResponseDto,
    isArray: true,
    description: 'Danh sách yêu cầu thanh toán toàn hệ thống',
  })
  async listAllRequests(
    @Query('statuses') statuses?: string | string[],
  ): Promise<SubscriptionResponseDto[]> {
    return this.subscriptionsService.listAllRequests(statuses);
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Admin phê duyệt yêu cầu nạp tiền (Khóa bi quan + Cộng dồn thời hạn PRO + Nâng role USERPRO)',
  })
  @ApiParam({ name: 'id', description: 'ID yêu cầu thanh toán' })
  @ApiStandardResponse({
    type: SubscriptionResponseDto,
    description: 'Phê duyệt yêu cầu nâng cấp thành công',
  })
  async approveSubscription(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ): Promise<SubscriptionResponseDto> {
    const adminId = admin?.id || admin?.sub;
    return this.subscriptionsService.approveSubscription(id, adminId);
  }

  @Auth(UserRole.SUPERADMIN, UserRole.ADMIN)
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin từ chối yêu cầu nạp tiền kèm lý do' })
  @ApiParam({ name: 'id', description: 'ID yêu cầu thanh toán' })
  @ApiStandardResponse({
    type: SubscriptionResponseDto,
    description: 'Từ chối yêu cầu nâng cấp thành công',
  })
  async rejectSubscription(
    @Param('id') id: string,
    @Body() dto: SubscriptionApproveDto,
    @CurrentUser() admin: any,
  ): Promise<SubscriptionResponseDto> {
    const adminId = admin?.id || admin?.sub;
    return this.subscriptionsService.rejectSubscription(id, adminId, dto);
  }
}
