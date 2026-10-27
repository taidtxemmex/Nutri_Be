import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ExtendedDiseaseGroupsService } from '../services/extended-disease-groups.service';
import { ExtendedDiseaseGroupsImportService } from '../services/extended-disease-groups-import.service';
import {
  CreateExtendedDiseaseGroupDto,
  UpdateExtendedDiseaseGroupDto,
  ExtendedDiseaseGroupQueryDto,
  ExtendedDiseaseGroupResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  CurrentUserId,
  SkipTransform,
  ApiFile,
} from '../../../common/decorators';

@ApiController('ExtendedDiseaseGroups', ['extended-disease-groups'], { auth: true })
export class ExtendedDiseaseGroupsController {
  constructor(
    private readonly service: ExtendedDiseaseGroupsService,
    private readonly importService: ExtendedDiseaseGroupsImportService,
  ) {}

  @Get('')
  @ApiOperation({ summary: 'Lấy danh sách nhóm bệnh mở rộng của người dùng hiện tại' })
  @ApiPaginatedResponse({
    type: ExtendedDiseaseGroupResponseDto,
    description: 'Danh sách nhóm bệnh mở rộng',
  })
  async findAll(@CurrentUserId() userId: string, @Query() query: ExtendedDiseaseGroupQueryDto) {
    return this.service.findAll(userId, query);
  }

  @Get('import-template')
  @SkipTransform()
  @ApiOperation({ summary: 'Tải file Excel mẫu để import nhóm bệnh mở rộng' })
  async downloadTemplate(@Res() res: Response) {
    const safeFileName = path.basename('Template_import_nhom_benh_mo_rong.xlsx');
    const filePath = path.resolve(process.cwd(), 'public/uploads/public/templates', safeFileName);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
    });

    if (fs.existsSync(filePath)) {
      return fs.createReadStream(filePath).pipe(res);
    }

    const buffer = await this.importService.getTemplate();
    fs.promises.writeFile(filePath, buffer).catch(() => {});
    return res.send(buffer);
  }

  @Post('import')
  @SkipTransform()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import danh sách nhóm bệnh mở rộng từ file Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiFile('file')
  async importGroups(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.importService.importExcel(userId, file);

    // Có lỗi -> trả file Excel kèm cột "Kết quả import" cho frontend download
    if (!result.success && result.errorFileBytes) {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${result.errorFileName || 'extended_disease_group_import_result.xlsx'}`,
      });
      return res.send(result.errorFileBytes);
    }

    // Thành công -> trả JSON chuẩn
    res.set({ 'Content-Type': 'application/json' });
    const traceId = (req.headers['x-trace-id'] as string) || 'trace-local';
    return res.status(HttpStatus.OK).json({
      status: 200,
      message: result.message,
      data: {
        total: result.totalImported ?? 0,
        imported: result.totalImported ?? 0,
        skipped: 0,
        totalImported: result.totalImported ?? 0,
        totalErrors: 0,
        success: true,
        message: result.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        traceId,
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết nhóm bệnh mở rộng theo ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh mở rộng' })
  @ApiStandardResponse({
    type: ExtendedDiseaseGroupResponseDto,
    description: 'Chi tiết nhóm bệnh mở rộng',
  })
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentUserId() userId: string) {
    return this.service.findById(id, userId);
  }

  @Post('')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tạo mới nhóm bệnh mở rộng cho người dùng hiện tại' })
  @ApiStandardResponse({
    type: ExtendedDiseaseGroupResponseDto,
    description: 'Tạo nhóm bệnh mở rộng thành công',
  })
  async create(@CurrentUserId() userId: string, @Body() dto: CreateExtendedDiseaseGroupDto) {
    return this.service.create(userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật nhóm bệnh mở rộng' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh mở rộng' })
  @ApiStandardResponse({
    type: ExtendedDiseaseGroupResponseDto,
    description: 'Cập nhật nhóm bệnh mở rộng thành công',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateExtendedDiseaseGroupDto,
  ) {
    return this.service.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa nhóm bệnh mở rộng' })
  @ApiParam({ name: 'id', type: Number, description: 'ID nhóm bệnh mở rộng' })
  @ApiStandardResponse({
    description: 'Xóa nhóm bệnh mở rộng thành công',
  })
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUserId() userId: string) {
    return this.service.delete(id, userId);
  }
}
