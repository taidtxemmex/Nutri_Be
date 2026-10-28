import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import {
  QueryUsersDto,
  UserInfoRequestDto,
  UpdateUserInfoReqDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  BatchUserIdsDto,
  BatchUpdateUserStatusDto,
  BatchCreateUsersDto,
  UserListItemDto,
  UserDetailResponseDto,
  BatchOperationResponseDto,
} from '../dto';
import {
  Roles,
  CurrentUser,
  CurrentUserId,
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

@ApiController('Users', 'users', { auth: true })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản và hồ sơ của người dùng hiện tại' })
  @ApiStandardResponse({
    type: UserDetailResponseDto,
    description: 'Lấy thông tin tài khoản và hồ sơ thành công',
  })
  async getMe(@CurrentUserId() userId: string) {
    return this.usersService.getMe({ currentUserId: userId });
  }

  @Put('me')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ của người dùng hiện tại' })
  @ApiStandardResponse({ description: 'Cập nhật hồ sơ cá nhân thành công' })
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserInfoReqDto) {
    dto.userId = user.id;
    return this.usersService.updateUserInfo({ dto, currentUser: user });
  }

  @Post('batch')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Tạo hàng loạt người dùng theo batch transaction (Admin only - Rule 20)',
  })
  @ApiStandardResponse({
    status: 201,
    type: BatchOperationResponseDto,
    description: 'Tạo hàng loạt người dùng thành công',
  })
  async createBatch(
    @Body() dto: BatchCreateUsersDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.createBatch({ dtoList: dto.users, currentUser });
  }

  @Post(['getInfo', '/api/users/getInfo'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết người dùng và chuyên môn (Vá lỗ hổng IDOR PII)',
  })
  @ApiStandardResponse({
    description: 'Trả về cấu trúc viewUser và viewJob cho InfomationUser.jsx',
  })
  async getUserInfo(
    @Body() dto: UserInfoRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.getUserInfo({ targetUserId: dto.userId, currentUser });
  }

  @Put(['update-info', '/api/users/update-info'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân và nghề nghiệp (Tương thích FE cũ)' })
  @ApiStandardResponse({ description: 'Cập nhật thông tin thành công' })
  async updateUserInfo(
    @Body() dto: UpdateUserInfoReqDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.updateUserInfo({ dto, currentUser });
  }

  @Get('')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách người dùng phân trang (Dành cho Quản trị viên)' })
  @ApiPaginatedResponse({
    type: UserListItemDto,
    description: 'Danh sách người dùng chuẩn phân trang',
  })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll({ query });
  }

  @Put([':id/role', 'update-role'])
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Phân quyền vai trò người dùng (Admin only)' })
  @ApiParam({ name: 'id', required: false, description: 'User ID' })
  @ApiStandardResponse({ description: 'Cập nhật vai trò thành công' })
  async updateRole(
    @Param('id') paramId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const targetUserId = paramId || dto.userId || dto.keycloakUserId;
    if (!targetUserId) {
      throw new BadRequestException('Vui lòng cung cấp ID người dùng cần phân quyền.');
    }
    return this.usersService.updateRole({ targetUserId, newRole: dto.newRole, currentUser });
  }

  @Put('batch-status')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Cập nhật trạng thái hoạt động hàng loạt người dùng theo batch (Admin only)',
  })
  @ApiStandardResponse({
    type: BatchOperationResponseDto,
    description: 'Cập nhật trạng thái batch thành công',
  })
  async updateStatusBatch(
    @Body() dto: BatchUpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.updateStatusBatch({
      userIds: dto.userIds,
      isActive: dto.isActive,
      currentUser,
    });
  }

  @Put([':id/status', 'update-user-active-satus'])
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật trạng thái hoạt động (khóa/mở khóa) người dùng' })
  @ApiParam({ name: 'id', required: false, description: 'User ID' })
  @ApiStandardResponse({ description: 'Cập nhật trạng thái thành công' })
  async updateStatus(
    @Param('id') paramId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const targetUserId = paramId || dto.userId || dto.keycloakUserId;
    if (!targetUserId) {
      throw new BadRequestException('Vui lòng cung cấp ID người dùng cần cập nhật trạng thái.');
    }
    const isActive = dto.isActive !== undefined ? dto.isActive : dto.active;
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('Vui lòng cung cấp giá trị boolean cho isActive/active.');
    }
    return this.usersService.updateStatus({ targetUserId, isActive, currentUser });
  }

  @Get(['check-profile', '/api/users/check-profile'])
  @ApiOperation({
    summary: 'Kiểm tra trạng thái hoàn thiện hồ sơ của người dùng (Tương thích FE cũ)',
  })
  @ApiStandardResponse({ description: 'Trả về profileComplete boolean' })
  async checkProfile(@CurrentUserId() userId: string) {
    return this.usersService.checkProfile({ userId });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết người dùng theo ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiStandardResponse({
    type: UserDetailResponseDto,
    description: 'Chi tiết tài khoản người dùng',
  })
  async findById(@Param('id') id: string) {
    return this.usersService.findById({ id });
  }

  @Delete('batch')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Xóa mềm hàng loạt người dùng theo batch (Admin only)' })
  @ApiStandardResponse({
    type: BatchOperationResponseDto,
    description: 'Xóa mềm batch thành công',
  })
  async softDeleteBatch(
    @Body() dto: BatchUserIdsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.softDeleteBatch({ userIds: dto.userIds, currentUser });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Xóa mềm người dùng và thu hồi mọi phiên đăng nhập (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiStandardResponse({ description: 'Xóa mềm người dùng thành công' })
  async softDelete(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.softDeleteUser({ targetUserId: id, currentUser });
  }
}
