import { Get, Post, Put, Delete, Body, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { MenusService } from '../services/menus.service';
import { MenuExcelService } from '../services/menu-excel.service';
import {
  CreateMenuDto,
  UpdateMenuDto,
  MenuQueryDto,
  MenuListDto,
  MenuDetailResponseDto,
  MenuFullResponseDto,
  MenuMutationResponseDto,
  ResolveDishDto,
  ExportMenuDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
} from '../../../common/decorators';
import { MenuExportType } from '../../../config/enums/domain.enum';

@ApiController('Menus', ['menu', 'menus'])
export class MenusController {
  constructor(
    private readonly menusService: MenusService,
    private readonly menuExcelService: MenuExcelService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách thực đơn phân trang (Anti-Overfetching)' })
  @ApiStandardResponse({
    type: MenuListDto,
    isArray: true,
    description: 'Lấy danh sách thành công',
  })
  async getAll(
    @Query() query: MenuQueryDto,
    @CurrentUser() user: any,
  ): Promise<{ items: MenuListDto[]; total: number; page: number; limit: number }> {
    return this.menusService.getAll(query, user);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Lấy chi tiết thực đơn theo ngày/tuần' })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiQuery({ name: 'week', required: false, description: 'Tuần số (nếu là thực đơn tuần/tháng)' })
  @ApiQuery({ name: 'day', required: false, description: 'Thứ trong tuần (1..7)' })
  @ApiStandardResponse({
    type: MenuDetailResponseDto,
    description: 'Lấy chi tiết thực đơn thành công',
  })
  async getById(
    @Param('id') id: string,
    @Query('week') week: number | undefined,
    @Query('day') day: number | undefined,
    @CurrentUser() user: any,
  ): Promise<MenuDetailResponseDto> {
    return this.menusService.getById(
      id,
      week ? Number(week) : undefined,
      day ? Number(day) : undefined,
      user,
    );
  }

  @Get(':id/full')
  @Auth()
  @ApiOperation({
    summary: 'Lấy toàn bộ cây 5 cấp thực đơn (Dành cho hộp thoại chỉnh sửa / Snapshot)',
  })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiStandardResponse({
    type: MenuFullResponseDto,
    description: 'Lấy cây thực đơn thành công',
  })
  async getFullMenu(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<MenuFullResponseDto> {
    return this.menusService.getFullMenu(id, user);
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Tạo mới thực đơn lồng 5 cấp trong 1 Transaction nguyên tử' })
  @ApiStandardResponse({
    type: MenuMutationResponseDto,
    status: HttpStatus.CREATED,
    description: 'Tạo thực đơn thành công',
  })
  async create(
    @Body() dto: CreateMenuDto,
    @CurrentUser() user: any,
  ): Promise<MenuMutationResponseDto> {
    return this.menusService.create(dto, user);
  }

  @Put(':id')
  @Auth()
  @ApiOperation({ summary: 'Cập nhật thực đơn với cơ chế Copy-on-Write cho bữa ăn dùng chung' })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiStandardResponse({
    type: MenuMutationResponseDto,
    description: 'Cập nhật thực đơn thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
    @CurrentUser() user: any,
  ): Promise<MenuMutationResponseDto> {
    return this.menusService.update(id, dto, user);
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Xóa an toàn thực đơn' })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.menusService.delete(id, user);
  }

  @Post(':id/clone')
  @Auth()
  @ApiOperation({ summary: 'Nhân bản thực đơn sâu (Clone Menu Deep Copy)' })
  @ApiParam({ name: 'id', description: 'ID thực đơn gốc cần nhân bản' })
  @ApiStandardResponse({
    type: MenuMutationResponseDto,
    status: HttpStatus.CREATED,
    description: 'Nhân bản thực đơn thành công',
  })
  async clone(@Param('id') id: string, @CurrentUser() user: any): Promise<MenuMutationResponseDto> {
    return this.menusService.clone(id, user);
  }

  @Post(':id/resolve-dish')
  @Auth()
  @ApiOperation({
    summary: 'Xử lý tạo món ăn nhanh inline hoặc liên kết món có sẵn theo recipe hash',
  })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  async resolveDish(
    @Param('id') id: string,
    @Body() dto: ResolveDishDto,
    @CurrentUser() user: any,
  ): Promise<{ dishId: string; name: string; recipeHash?: string | null }> {
    return this.menusService.resolveDishForMenu(dto, user);
  }

  @Post(':id/export')
  @Get(':id/export')
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary: 'Xuất file Excel thực đơn lâm sàng đa chế độ (FULL, NET, NET_NUTRITION, RAW, COOKED)',
  })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiBody({ type: ExportMenuDto, required: false })
  async exportMenu(
    @Param('id') id: string,
    @Body() bodyDto: ExportMenuDto,
    @Query('exportType') qExportType: MenuExportType,
    @Query('servings') qServings: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const exportType = bodyDto?.exportType || qExportType || MenuExportType.FULL;
    const servings = bodyDto?.servings || (qServings ? Number(qServings) : 1);
    const columns = bodyDto?.columns;

    const buffer = await this.menuExcelService.exportMenuExcel(BigInt(id), {
      exportType,
      servings,
      columns,
      userId: user?.id,
    });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="thuc_don_${id}_${exportType.toLowerCase()}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
