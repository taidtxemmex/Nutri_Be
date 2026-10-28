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
  ExportMarketPlanDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
} from '../../../common/decorators';
import { MenuExportType } from '../../../config/enums/domain.enum';

@ApiController('Menus', ['menus', 'menu'])
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
    return this.menusService.getAll({ query, currentUser: user });
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
    return this.menusService.getById({
      id,
      weekNo: week ? Number(week) : undefined,
      dayOfWeek: day ? Number(day) : undefined,
      currentUser: user,
    });
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
    return this.menusService.getFullMenu({ id, currentUser: user });
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
    return this.menusService.create({ dto, currentUser: user });
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
    return this.menusService.update({ id, dto, currentUser: user });
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Xóa an toàn thực đơn' })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.menusService.delete({ id, currentUser: user });
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
    return this.menusService.clone({ id, currentUser: user });
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
    return this.menusService.resolveDishForMenu({ dto, currentUser: user });
  }

  @Post(':id/export/market-plan')
  @Get(':id/export/market-plan')
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary: 'Xuất kế hoạch đi chợ chuẩn 14 nhóm thực phẩm Bộ Y Tế dạng Stream O(1) RAM',
  })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiBody({ type: ExportMarketPlanDto, required: false })
  async exportMarketPlan(
    @Param('id') id: string,
    @Body() bodyDto: ExportMarketPlanDto,
    @Query() queryDto: ExportMarketPlanDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const servings = bodyDto?.servings || queryDto?.servings || 1;
    const cycle = bodyDto?.cycle || queryDto?.cycle || 'ALL';
    const week = bodyDto?.week || queryDto?.week;
    const day = bodyDto?.day || queryDto?.day;

    await this.menuExcelService.streamMarketPlanExcel({
      menuIdOrData: BigInt(id),
      outputStream: res,
      options: {
        servings: Number(servings),
        cycle,
        week: week ? Number(week) : undefined,
        day: day ? Number(day) : undefined,
        userId: user?.id,
      },
    });
  }

  @Post(':id/export/weekly')
  @Get(':id/export/weekly')
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary: 'Xuất thực đơn tuần / chuyên sâu đa chế độ (FULL, NET, NET_NUTRITION, RAW, COOKED)',
  })
  @ApiParam({ name: 'id', description: 'ID thực đơn' })
  @ApiBody({ type: ExportMenuDto, required: false })
  async exportMenuWeekly(
    @Param('id') id: string,
    @Body() bodyDto: ExportMenuDto,
    @Query('exportType') qExportType: MenuExportType,
    @Query('servings') qServings: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    return this.executeExportMenu({ id, bodyDto, qExportType, qServings, user, res });
  }

  @Post(':id/export')
  @Get(':id/export')
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary:
      'Xuất file Excel thực đơn lâm sàng đa chế độ (FULL, NET, NET_NUTRITION, RAW, COOKED) dạng Stream O(1) RAM',
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
    return this.executeExportMenu({ id, bodyDto, qExportType, qServings, user, res });
  }

  private async executeExportMenu({
    id,
    bodyDto,
    qExportType,
    qServings,
    user,
    res,
  }: {
    id: string;
    bodyDto?: ExportMenuDto;
    qExportType?: MenuExportType;
    qServings?: number;
    user?: any;
    res: Response;
  }): Promise<void> {
    const exportType = bodyDto?.exportType || qExportType || MenuExportType.FULL;
    const servings = bodyDto?.servings || (qServings ? Number(qServings) : 1);
    const columns = bodyDto?.columns;

    await this.menuExcelService.streamMenuExcel({
      menuIdOrData: BigInt(id),
      outputStream: res,
      options: {
        exportType,
        servings,
        columns,
        userId: user?.id,
      },
    });
  }
}
