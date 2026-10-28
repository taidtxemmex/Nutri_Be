import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { setExcelResponseHeaders } from '../../../core/excel-engine';
import { DishesService } from '../services/dishes.service';
import { DishExcelService } from '../services/dish-excel.service';
import {
  CreateDishDto,
  UpdateDishDto,
  DishSummaryDto,
  DishResponseDto,
  DishCloneRequestDto,
  DishCloneResponseDto,
  RejectDishDto,
  ExportDishDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
  ApiFile,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Dishes', ['dishes', 'dish'])
export class DishesController {
  constructor(
    private readonly dishesService: DishesService,
    private readonly excelService: DishExcelService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách món ăn cá nhân (lọc theo statuses)' })
  @ApiQuery({
    name: 'statuses',
    required: false,
    description: 'Danh sách trạng thái phân cách bằng dấu phẩy',
  })
  @ApiStandardResponse({
    type: DishSummaryDto,
    isArray: true,
    description: 'Lấy danh sách món ăn thành công',
  })
  async getUserDishes(
    @Query('statuses') statuses: string | string[] | undefined,
    @CurrentUser() user: any,
  ): Promise<DishSummaryDto[]> {
    return this.dishesService.getUserDishes({ currentUser: user, statuses: statuses as any });
  }

  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách món ăn công khai đã duyệt' })
  @ApiStandardResponse({
    type: DishSummaryDto,
    isArray: true,
    description: 'Lấy danh sách món công khai thành công',
  })
  async getPublicDishes(@CurrentUser() user?: any): Promise<DishSummaryDto[]> {
    return this.dishesService.getPublicDishes({ currentUserId: user?.id });
  }

  @Get('admin')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy danh sách món ăn cho quản trị viên (Admin/SuperAdmin)' })
  @ApiQuery({ name: 'statuses', required: false })
  @ApiStandardResponse({
    type: DishSummaryDto,
    isArray: true,
    description: 'Lấy danh sách món admin thành công',
  })
  async getAdminDishes(
    @Query('statuses') statuses: string | string[] | undefined,
    @CurrentUser() user: any,
  ): Promise<DishSummaryDto[]> {
    return this.dishesService.getAdminDishes({ currentUser: user, statuses: statuses as any });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Tìm kiếm gợi ý món ăn nhanh (Autocomplete)' })
  @ApiQuery({ name: 'dishName', required: true, description: 'Từ khóa tên món' })
  @ApiQuery({ name: 'limit', required: false, description: 'Giới hạn số lượng (mặc định 10)' })
  @ApiStandardResponse({
    type: DishSummaryDto,
    isArray: true,
    description: 'Gợi ý món ăn thành công',
  })
  async autocomplete(
    @Query('dishName') dishName: string,
    @Query('limit') limit?: number,
    @CurrentUser() user?: any,
  ): Promise<DishSummaryDto[]> {
    return this.dishesService.autocomplete({
      keyword: dishName,
      limit: limit || 10,
      currentUser: user,
    });
  }

  @Get('import-template')
  @SkipTransform()
  @ApiOperation({ summary: 'Tải tập tin Excel mẫu để nhập danh sách món ăn' })
  async downloadImportTemplate(@Res() res: Response) {
    const safeFileName = path.basename('Template_import_mon_an.xlsx');
    const filePath = path.resolve(process.cwd(), 'public/uploads/public/templates', safeFileName);

    setExcelResponseHeaders({ res, filename: safeFileName });

    if (fs.existsSync(filePath)) {
      return fs.createReadStream(filePath).pipe(res);
    }

    const buffer = await this.excelService.generateTemplate();
    fs.promises.writeFile(filePath, buffer).catch(() => {});
    return res.end(buffer);
  }

  @Post('import')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', { description: 'Tập tin Excel danh sách món ăn (.xlsx)' })
  @ApiOperation({ summary: 'Nhập danh sách món ăn từ tập tin Excel' })
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    if (!file || !file.buffer) {
      throw new HttpException(
        { code: 'FILE_REQUIRED', message: 'Vui lòng tải lên tập tin Excel (.xlsx)' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.excelService.importExcel({
      fileBuffer: file.buffer,
      userId: user?.id,
    });

    if (!result.success && result.errorFileBuffer) {
      setExcelResponseHeaders({
        res,
        filename: result.errorFileName || 'dish_import_errors.xlsx',
      });
      return res.end(result.errorFileBuffer);
    }

    return res.status(HttpStatus.OK).json({
      status: 200,
      message: result.message || 'Import thành công',
      data: {
        total: result.importedCount ?? result.total ?? 0,
        imported: result.importedCount ?? result.imported ?? 0,
        skipped: result.skipped ?? 0,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @SkipTransform()
  @ApiOperation({ summary: 'Xuất danh sách món ăn ra tập tin Excel' })
  async exportDishes(@Body() dto: ExportDishDto, @CurrentUser() user: any, @Res() res: Response) {
    await this.excelService.streamExportDishes({
      dtoOrDishes: dto,
      currentUser: user,
      stream: res,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết món ăn (đầy đủ 86 chỉ tiêu vi chất)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({
    type: DishResponseDto,
    description: 'Lấy chi tiết món ăn thành công',
  })
  async getById(@Param('id') id: string, @CurrentUser() user?: any): Promise<DishResponseDto> {
    return this.dishesService.findById({ id, currentUser: user });
  }

  @Post()
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Tạo món ăn mới (lưu chi tiết món trong 1 transaction, tính recipe_hash và 86 vi chất)',
  })
  @ApiStandardResponse({
    type: DishResponseDto,
    description: 'Tạo món ăn thành công',
  })
  async create(@Body() dto: CreateDishDto, @CurrentUser() user: any): Promise<DishResponseDto> {
    return this.dishesService.create({ dto, currentUser: user });
  }

  @Put(':id')
  @Auth()
  @ApiOperation({ summary: 'Cập nhật món ăn (chặn sửa nếu đã duyệt hoặc món hệ thống)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({
    type: DishResponseDto,
    description: 'Cập nhật món ăn thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDishDto,
    @CurrentUser() user: any,
  ): Promise<DishResponseDto> {
    return this.dishesService.update({ id, dto, currentUser: user });
  }

  @Post(':id/clone')
  @Auth()
  @ApiOperation({ summary: 'Nhân bản (clone) món ăn sang món riêng tư' })
  @ApiParam({ name: 'id', description: 'ID món ăn gốc' })
  @ApiStandardResponse({
    type: DishCloneResponseDto,
    description: 'Nhân bản món ăn thành công',
  })
  async cloneDish(
    @Param('id') id: string,
    @Body() dto: DishCloneRequestDto,
    @CurrentUser() user: any,
  ): Promise<DishCloneResponseDto> {
    return this.dishesService.cloneDish({ dishId: id, request: dto, currentUser: user });
  }

  @Put(':id/propose')
  @Auth()
  @ApiOperation({ summary: 'Gửi đề xuất công khai món ăn (chuyển RIENG_TU -> CHO_DUYET)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Đã gửi đề xuất thành công' })
  async proposeDish(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.proposeDish({ dishId: id, currentUser: user });
  }

  @Post(':id/propose')
  @Auth()
  @ApiOperation({ summary: 'Gửi đề xuất công khai món ăn (alias POST)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Đã gửi đề xuất thành công' })
  async proposeDishPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.proposeDish({ dishId: id, currentUser: user });
  }

  @Put(':id/approve')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Phê duyệt món ăn đề xuất (Admin)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Phê duyệt thành công' })
  async approveDish(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.approveDish({ id, adminUser: user });
  }

  @Post(':id/approve')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Phê duyệt món ăn đề xuất (alias POST)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Phê duyệt thành công' })
  async approveDishPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.approveDish({ id, adminUser: user });
  }

  @Put(':id/reject')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Từ chối đề xuất món ăn (Admin)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Từ chối đề xuất thành công' })
  async rejectDish(
    @Param('id') id: string,
    @Body() dto: RejectDishDto,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.rejectDish({ id, reason: dto.reason, adminUser: user });
  }

  @Post(':id/reject')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Từ chối đề xuất món ăn (alias POST)' })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Từ chối đề xuất thành công' })
  async rejectDishPost(
    @Param('id') id: string,
    @Body() dto: RejectDishDto,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    return this.dishesService.rejectDish({ id, reason: dto.reason, adminUser: user });
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({
    summary: 'Xóa món ăn (chặn xóa nếu là món công khai hoặc đang được dùng trong thực đơn)',
  })
  @ApiParam({ name: 'id', description: 'ID món ăn' })
  @ApiStandardResponse({ description: 'Xóa món ăn thành công' })
  async delete(@Param('id') id: string, @CurrentUser() user: any): Promise<{ message: string }> {
    return this.dishesService.delete({ id, currentUser: user });
  }
}
