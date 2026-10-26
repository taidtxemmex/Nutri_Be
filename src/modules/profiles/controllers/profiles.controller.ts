import { Get, Put, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ProfilesService } from '../services/profiles.service';
import { ProfileFilterDto, UpdateProfileDto } from '../dto';
import {
  Roles,
  CurrentUserId,
  ApiController,
  ApiStandardResponse,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Profiles', ['profiles', 'profile'], { auth: true })
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(['my-profile', 'my'])
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ của người dùng hiện tại' })
  @ApiStandardResponse({ description: 'Lấy hồ sơ cá nhân thành công' })
  async getMyProfile(@CurrentUserId() userId: string) {
    return this.profilesService.getMyProfile(userId);
  }

  @Put('my-profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ của người dùng hiện tại' })
  @ApiStandardResponse({ description: 'Cập nhật hồ sơ thành công' })
  async updateMyProfile(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(userId, dto);
  }

  @Post(['getAll', '/api/v1/profile/getAll', '/api/profile/getAll'])
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy danh sách tài khoản cho Admin (Tương thích UserTable.jsx)' })
  @ApiStandardResponse({ description: 'Danh sách hồ sơ người dùng kèm phân trang' })
  async getAllProfiles(@Body() filter: ProfileFilterDto) {
    return this.profilesService.getAllProfiles(filter);
  }
}
