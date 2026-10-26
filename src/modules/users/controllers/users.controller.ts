import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import {
  QueryUsersDto,
  UserInfoRequestDto,
  UpdateUserInfoReqDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from '../dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../config/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản và hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin thành công' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserInfoReqDto) {
    dto.userId = user.id;
    return this.usersService.updateUserInfo(dto, user);
  }

  @Post(['getInfo', '/api/users/getInfo'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết người dùng và chuyên môn (Vá lỗ hổng IDOR PII)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về cấu trúc viewUser và viewJob cho InfomationUser.jsx',
  })
  @ApiResponse({
    status: 403,
    description: 'Bị chặn IDOR khi cố tình truy cập thông tin của người dùng khác',
  })
  async getUserInfo(
    @Body() dto: UserInfoRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.getUserInfo(dto.userId, currentUser);
  }

  @Put(['update-info', '/api/users/update-info'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân và nghề nghiệp (Tương thích FE cũ)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công' })
  async updateUserInfo(
    @Body() dto: UpdateUserInfoReqDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.updateUserInfo(dto, currentUser);
  }

  @Get('')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách người dùng phân trang (Dành cho Quản trị viên)' })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng chuẩn phân trang' })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Put([':id/role', 'update-role'])
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Phân quyền vai trò người dùng (Admin only)' })
  @ApiParam({ name: 'id', required: false, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật vai trò thành công' })
  async updateRole(
    @Param('id') paramId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const targetUserId = paramId || dto.userId || dto.keycloakUserId;
    if (!targetUserId) {
      throw new BadRequestException('Vui lòng cung cấp ID người dùng cần phân quyền.');
    }
    return this.usersService.updateRole(targetUserId, dto.newRole, currentUser);
  }

  @Put([':id/status', 'update-user-active-satus'])
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật trạng thái hoạt động (khóa/mở khóa) người dùng' })
  @ApiParam({ name: 'id', required: false, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
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
    return this.usersService.updateStatus(targetUserId, isActive, currentUser);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết người dùng theo ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết người dùng' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
