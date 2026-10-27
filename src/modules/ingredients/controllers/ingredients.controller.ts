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
import { ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { setExcelResponseHeaders } from '../../../core/excel-engine';
import { IngredientsService } from '../services/ingredients.service';
import { IngredientExcelService } from '../services/ingredient-excel.service';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  IngredientQueryDto,
  IngredientSummaryDto,
  IngredientListItemDto,
  IngredientDetailDto,
  ExportIngredientDto,
  CalculateSummaryDto,
  CalculateSummaryResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  Auth,
  CurrentUser,
  SkipTransform,
  ApiFile,
} from '../../../common/decorators';
import { UserRole } from '../../../config/enums/role.enum';

@ApiController('Ingredients', ['ingredients', 'ingredient'])
export class IngredientsController {
  constructor(
    private readonly ingredientsService: IngredientsService,
    private readonly excelService: IngredientExcelService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Lấy danh sách rút gọn nguyên liệu (ID & Tên) tối ưu 0ms' })
  @ApiStandardResponse({
    type: IngredientSummaryDto,
    isArray: true,
    description: 'Lấy danh sách rút gọn thành công',
  })
  async findSummary(): Promise<IngredientSummaryDto[]> {
    return this.ingredientsService.findSummary();
  }

  @Get('all')
  @ApiOperation({ summary: 'Lấy toàn bộ danh sách nguyên liệu đã duyệt (In-memory Cache FE)' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    isArray: true,
    description: 'Lấy toàn bộ danh sách nguyên liệu thành công',
  })
  async findAllUnpaginated(): Promise<IngredientDetailDto[]> {
    return this.ingredientsService.findAllUnpaginated();
  }

  @Post('calculate-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tính toán tổng hợp dinh dưỡng động danh sách nguyên liệu' })
  @ApiStandardResponse({
    type: CalculateSummaryResponseDto,
    description: 'Tính toán tổng hợp dinh dưỡng thành công',
  })
  async calculateSummary(@Body() dto: CalculateSummaryDto): Promise<CalculateSummaryResponseDto> {
    return this.ingredientsService.calculateSummary(dto);
  }

  @Get('template')
  @SkipTransform()
  @ApiOperation({ summary: 'Tải file Excel mẫu 86 cột có dropdown danh mục & loại protein' })
  async downloadTemplate(
    @Query('columns') columns: string | string[] | undefined,
    @Res() res: Response,
  ) {
    const colArray = typeof columns === 'string' ? [columns] : columns;
    const isDefault = !colArray || colArray.length === 0;

    const safeFileName = path.basename('Template_import_nguyen_lieu.xlsx');
    const filePath = path.resolve(process.cwd(), 'public/uploads/public/templates', safeFileName);

    setExcelResponseHeaders(res, safeFileName);

    if (isDefault && fs.existsSync(filePath)) {
      return fs.createReadStream(filePath).pipe(res);
    }

    const buffer = await this.excelService.generateTemplate(colArray);
    if (isDefault) {
      fs.promises.writeFile(filePath, buffer).catch(() => {});
    }
    return res.end(buffer);
  }

  @Post('import')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', { description: 'Tập tin Excel danh sách nguyên liệu (.xlsx)' })
  @ApiOperation({ summary: 'Nhập nguyên liệu từ file Excel (Admin/SuperAdmin)' })
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

    const result = await this.excelService.importExcel(file.buffer, user?.id);

    // Nếu import phát hiện lỗi ở các dòng -> Trả file Excel chứa cột chú thích lỗi cho Client
    if (!result.success && result.errorFileBuffer) {
      setExcelResponseHeaders(
        res,
        result.errorFileName || 'ingredient_import_errors.xlsx',
      );
      return res.end(result.errorFileBuffer);
    }

    return res.status(HttpStatus.OK).json({
      status: 200,
      message: result.message || 'Import thành công',
      data: {
        total: result.totalImported ?? result.total ?? 0,
        imported: result.totalImported ?? result.imported ?? 0,
        skipped: result.skipped ?? 0,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  @Post('export')
  @SkipTransform()
  @ApiOperation({ summary: 'Xuất danh sách nguyên liệu ra file Excel dạng Stream O(1) RAM' })
  async exportIngredients(@Body() dto: ExportIngredientDto, @Res() res: Response): Promise<void> {
    await this.excelService.streamExportIngredients(dto, res);
  }

  @Post('approve/:pendingId')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Phê duyệt nguyên liệu đề xuất (Admin/SuperAdmin)' })
  @ApiParam({ name: 'pendingId', description: 'ID nguyên liệu chờ duyệt' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    description: 'Phê duyệt nguyên liệu thành công',
  })
  async approvePending(@Param('pendingId') pendingId: string): Promise<IngredientDetailDto> {
    return this.ingredientsService.approve(pendingId);
  }

  @Post('reject/:pendingId')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Từ chối nguyên liệu đề xuất (Admin/SuperAdmin)' })
  @ApiParam({ name: 'pendingId', description: 'ID nguyên liệu chờ duyệt' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    description: 'Từ chối nguyên liệu thành công',
  })
  async rejectPending(@Param('pendingId') pendingId: string): Promise<IngredientDetailDto> {
    return this.ingredientsService.rejectPending(pendingId);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách nguyên liệu phân trang (Lean Projection chống tràn RAM)',
  })
  @ApiPaginatedResponse({
    type: IngredientListItemDto,
    description: 'Lấy danh sách nguyên liệu phân trang thành công',
  })
  async findAll(@Query() query: IngredientQueryDto) {
    return this.ingredientsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết nguyên liệu đầy đủ 86 chỉ tiêu vi chất' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    description: 'Lấy chi tiết nguyên liệu thành công',
  })
  async findById(@Param('id') id: string): Promise<IngredientDetailDto> {
    return this.ingredientsService.findById(id);
  }

  @Post()
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo mới nguyên liệu (User -> Chờ duyệt; Admin -> Đã duyệt)' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    description: 'Tạo nguyên liệu thành công',
  })
  async create(
    @Body() dto: CreateIngredientDto,
    @CurrentUser() user: any,
  ): Promise<IngredientDetailDto> {
    return this.ingredientsService.create(dto, user);
  }

  @Put(':id')
  @Auth()
  @ApiOperation({ summary: 'Cập nhật nguyên liệu (Yêu cầu trạng thái ĐÃ DUYỆT)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu' })
  @ApiStandardResponse({
    type: IngredientDetailDto,
    description: 'Cập nhật nguyên liệu thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: any,
  ): Promise<IngredientDetailDto> {
    return this.ingredientsService.update(id, dto, user);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Xóa nguyên liệu (Proactive Delete Guard & Soft-Delete)' })
  @ApiParam({ name: 'id', description: 'ID nguyên liệu' })
  @ApiStandardResponse({ description: 'Xóa nguyên liệu thành công' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.ingredientsService.delete(id);
  }
}
