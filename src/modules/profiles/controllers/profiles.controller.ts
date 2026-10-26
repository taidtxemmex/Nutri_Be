import { Controller, Get, Put, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from '../services/profiles.service';
import { ProfileFilterDto, UpdateProfileDto } from '../dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../config/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Profiles')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['profiles', 'profile'])
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(['my-profile', '/api/users/check-profile'])
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Lấy hồ sơ thành công' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyProfile(user.id);
  }

  @Put('my-profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  async updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(user.id, dto);
  }

  @Post(['getAll', '/api/v1/profile/getAll', '/api/profile/getAll'])
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy danh sách tài khoản cho Admin (Tương thích UserTable.jsx)' })
  @ApiResponse({ status: 200, description: 'Trả về { data: { items: [...] } }' })
  async getAllProfiles(@Body() filter: ProfileFilterDto) {
    return this.profilesService.getAllProfiles(filter);
  }
}
