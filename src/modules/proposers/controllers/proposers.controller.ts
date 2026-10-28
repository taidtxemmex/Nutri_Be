import {
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { ProposersService } from '../services/proposers.service';
import {
  CreateProposerDto,
  UpdateProposerDto,
  ProposerQueryDto,
  ProposerResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  CurrentUser,
  CurrentUserId,
} from '../../../common/decorators';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Proposers', ['proposer', 'proposers'], { auth: true })
export class ProposersController {
  constructor(private readonly proposersService: ProposersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy hồ sơ người đề xuất của tài khoản hiện tại (Vá lỗi IDOR)' })
  @ApiStandardResponse({
    type: ProposerResponseDto,
    description: 'Hồ sơ người đề xuất cá nhân',
  })
  async getMe(@CurrentUserId() userId: string) {
    return this.proposersService.getMe({ userId });
  }

  @Put('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ người đề xuất của tài khoản hiện tại' })
  @ApiStandardResponse({
    type: ProposerResponseDto,
    description: 'Cập nhật hồ sơ thành công',
  })
  async updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateProposerDto) {
    return this.proposersService.insert({ userId, dto });
  }

  @Get('')
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ người đề xuất' })
  @ApiPaginatedResponse({
    type: ProposerResponseDto,
    description: 'Danh sách hồ sơ người đề xuất',
  })
  async findAll(@Query() query: ProposerQueryDto) {
    return this.proposersService.findAll({ query });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hồ sơ người đề xuất theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID hồ sơ người đề xuất' })
  @ApiStandardResponse({
    type: ProposerResponseDto,
    description: 'Chi tiết hồ sơ người đề xuất',
  })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.proposersService.findById({ id });
  }

  @Post('')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm mới hoặc cập nhật hồ sơ người đề xuất' })
  @ApiStandardResponse({
    type: ProposerResponseDto,
    description: 'Lưu hồ sơ người đề xuất thành công',
  })
  async insert(@CurrentUserId() userId: string, @Body() dto: CreateProposerDto) {
    return this.proposersService.insert({ userId, dto });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ người đề xuất theo ID (Kiểm soát IDOR nghiêm ngặt)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID hồ sơ người đề xuất' })
  @ApiStandardResponse({
    type: ProposerResponseDto,
    description: 'Cập nhật thành công',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProposerDto,
  ) {
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    return this.proposersService.update({ id, userId: user.id, isAdmin, dto });
  }
}
