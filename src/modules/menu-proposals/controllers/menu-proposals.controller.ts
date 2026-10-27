import { Get, Post, Put, Body, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MenuProposalsService } from '../services/menu-proposals.service';
import {
  RejectProposalDto,
  MenuProposalQueryDto,
  MenuProposalListDto,
  MenuProposalDetailDto,
} from '../dto';
import { MenuDetailResponseDto, ExportMenuDto } from '../../menus/dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('MenuProposals', 'menu-proposals')
export class MenuProposalsController {
  constructor(private readonly service: MenuProposalsService) {}

  @Post(':menuId')
  @Auth()
  @ApiOperation({ summary: 'Nộp đề xuất thực đơn cho Admin duyệt (Đóng băng Deep Snapshot JSONB)' })
  @ApiParam({ name: 'menuId', description: 'ID thực đơn gốc cần đề xuất' })
  @ApiStandardResponse({
    status: HttpStatus.CREATED,
    description: 'Nộp đề xuất thành công',
  })
  async propose(
    @Param('menuId') menuId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string; proposalId: string }> {
    return this.service.proposeMenu(menuId, user);
  }

  @Get()
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy danh sách đề xuất thực đơn cho Admin (lọc theo statuses)' })
  @ApiStandardResponse({
    type: MenuProposalListDto,
    isArray: true,
    description: 'Lấy danh sách đề xuất thành công',
  })
  async getAll(
    @Query() query: MenuProposalQueryDto,
  ): Promise<{ items: MenuProposalListDto[]; total: number; page: number; limit: number }> {
    return this.service.getAdminProposals(query);
  }

  @Get('my')
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách đề xuất thực đơn của chính tôi' })
  @ApiStandardResponse({
    type: MenuProposalListDto,
    isArray: true,
    description: 'Lấy danh sách đề xuất của tôi thành công',
  })
  async getMy(@CurrentUser() user: any): Promise<MenuProposalListDto[]> {
    return this.service.getMyProposals(user);
  }

  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách đề xuất thực đơn đã được duyệt công khai' })
  @ApiStandardResponse({
    type: MenuProposalListDto,
    isArray: true,
    description: 'Lấy danh sách đề xuất công khai thành công',
  })
  async getPublic(): Promise<MenuProposalListDto[]> {
    return this.service.getPublicProposals();
  }

  @Get(':id/full')
  @Auth()
  @ApiOperation({ summary: 'Lấy chi tiết toàn bộ cấu trúc đề xuất thực đơn (Đọc Snapshot)' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  @ApiStandardResponse({
    type: MenuProposalDetailDto,
    description: 'Lấy chi tiết đề xuất thành công',
  })
  async getFull(@Param('id') id: string, @CurrentUser() user: any): Promise<MenuProposalDetailDto> {
    return this.service.getDetail(id, user);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Lấy chi tiết ngày của đề xuất (Lazy load từ Snapshot)' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  @ApiQuery({ name: 'week', required: false, description: 'Tuần số' })
  @ApiQuery({ name: 'day', required: false, description: 'Thứ trong tuần' })
  @ApiStandardResponse({
    type: MenuDetailResponseDto,
    description: 'Lấy chi tiết ngày của đề xuất thành công',
  })
  async getProposalDay(
    @Param('id') id: string,
    @Query('week') week: number | undefined,
    @Query('day') day: number | undefined,
    @CurrentUser() user: any,
  ): Promise<MenuDetailResponseDto> {
    return this.service.getProposalDayDetail(
      id,
      week ? Number(week) : undefined,
      day ? Number(day) : undefined,
      user,
    );
  }

  @Put(':id/approve')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Admin phê duyệt đề xuất thực đơn (Chuyển thành mẫu công khai)' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.service.approve(id, user);
  }

  @Put(':id/reject')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Admin từ chối đề xuất thực đơn (kèm lý do)' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectProposalDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.service.reject(id, dto, user);
  }

  @Post(':id/export')
  @Auth()
  @SkipTransform()
  @ApiOperation({ summary: 'Xuất file Excel đề xuất thực đơn từ Snapshot' })
  @ApiParam({ name: 'id', description: 'ID đề xuất' })
  async exportProposal(
    @Param('id') id: string,
    @Body() req: ExportMenuDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.exportProposalExcel(id, req.columns, user);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="de_xuat_thuc_don_${id}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
