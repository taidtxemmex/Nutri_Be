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
  HttpStatus,
  HttpCode,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { setExcelResponseHeaders } from '../../../core/excel-engine';
import { DailyIntakesService } from '../services/daily-intakes.service';
import { DailyIntakeExcelService } from '../services/daily-intake-excel.service';
import {
  CreateDailyIntakeDto,
  UpdateDailyIntakeDto,
  DailyIntakeQueryDto,
  DailyIntakeResponseDto,
  DailyIntakeListDto,
  ExportDailyIntakeDto,
  ImportDailyIntakeQueryDto,
  DailyIntakeExportRequestDto,
} from '../dto';
import { DailyIntakeReportStreamService } from '../services/daily-intake-report-stream.service';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
  ApiFile,
} from '../../../common/decorators';
import { DailyIntakeClinicalReportType } from '../../../config/enums/domain.enum';

@ApiController('DailyIntakes', ['daily-intakes', 'daily-intake'])
export class DailyIntakesController {
  constructor(
    private readonly service: DailyIntakesService,
    private readonly excelService: DailyIntakeExcelService,
    private readonly reportStreamService: DailyIntakeReportStreamService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách khẩu phần 24h theo bệnh nhân / ngày phân trang' })
  @ApiStandardResponse({
    type: DailyIntakeListDto,
    isArray: true,
    description: 'Lấy danh sách thành công',
  })
  async getAll(
    @Query() query: DailyIntakeQueryDto,
    @CurrentUser() user: any,
  ): Promise<{ items: DailyIntakeListDto[]; total: number; page: number; limit: number }> {
    return this.service.getAll({ query, currentUser: user });
  }

  @Get(['template', 'import-template'])
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary: 'Tải file Excel mẫu để nhập liệu khẩu phần 24h (theo bữa hoặc theo ngày)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['BY_MEAL', 'INGREDIENT_ONLY'],
    description: 'Loại template: BY_MEAL (theo bữa) hoặc INGREDIENT_ONLY (theo ngày)',
  })
  async downloadTemplate(
    @Query('type') type: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const normalizedType =
      type?.toUpperCase() === 'INGREDIENT_ONLY' ? 'INGREDIENT_ONLY' : 'BY_MEAL';
    const fileName =
      normalizedType === 'INGREDIENT_ONLY'
        ? 'Template_import_khau_phan_24h_theo_ngay.xlsx'
        : 'Template_import_khau_phan_24h_theo_bua.xlsx';
    const safeFileName = path.basename(fileName);
    const filePath = path.resolve(process.cwd(), 'public/uploads/public/templates', safeFileName);

    setExcelResponseHeaders({ res, filename: safeFileName });

    if (fs.existsSync(filePath)) {
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const buffer = await this.excelService.generateTemplate({ type });
    res.end(buffer);
  }

  @Get('patient/:patientId')
  @Auth()
  @ApiOperation({ summary: 'Lấy danh sách lịch sử khẩu phần 24h của bệnh nhân' })
  @ApiParam({ name: 'patientId', description: 'ID bệnh nhân' })
  @ApiStandardResponse({
    type: DailyIntakeListDto,
    isArray: true,
    description: 'Lấy lịch sử khẩu phần thành công',
  })
  async getByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ): Promise<DailyIntakeListDto[]> {
    return this.service.getByPatient({ patientId, currentUser: user });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Lấy chi tiết khẩu phần 24h kèm bảng tính dinh dưỡng 86 vi chất' })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  @ApiStandardResponse({
    type: DailyIntakeResponseDto,
    description: 'Lấy chi tiết thành công',
  })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<DailyIntakeResponseDto> {
    return this.service.getById({ id, currentUser: user });
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Ghi nhận khẩu phần ăn 24h thực tế (BY_MEAL hoặc INGREDIENT_ONLY)' })
  @ApiStandardResponse({
    type: DailyIntakeResponseDto,
    status: HttpStatus.CREATED,
    description: 'Ghi nhận khẩu phần thành công',
  })
  async create(
    @Body() dto: CreateDailyIntakeDto,
    @CurrentUser() user: any,
  ): Promise<DailyIntakeResponseDto> {
    return this.service.create({ dto, currentUser: user });
  }

  @Put(':id')
  @Auth()
  @ApiOperation({ summary: 'Cập nhật khẩu phần 24h' })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  @ApiStandardResponse({
    type: DailyIntakeResponseDto,
    description: 'Cập nhật thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyIntakeDto,
    @CurrentUser() user: any,
  ): Promise<DailyIntakeResponseDto> {
    return this.service.update({ id, dto, currentUser: user });
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Xóa khẩu phần 24h' })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.service.delete({ id, currentUser: user });
  }

  @Get(':id/rda-report')
  @Auth()
  @ApiOperation({
    summary: 'Báo cáo đánh giá RDA/DRI lâm sàng đối chiếu chuẩn Viện Dinh Dưỡng Quốc Gia',
  })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  @ApiQuery({
    name: 'limitSetId',
    required: false,
    description: 'ID bộ giới hạn dinh dưỡng tùy biến',
  })
  @ApiQuery({
    name: 'physiologicalStatus',
    required: false,
    description:
      'Tình trạng sinh lý đặc thù (PREGNANT_T1, PREGNANT_T2, PREGNANT_T3, LACTATING_0_6M, LACTATING_7_12M)',
  })
  async getRdaReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('limitSetId') limitSetId?: string,
    @Query('physiologicalStatus') physiologicalStatus?: string,
  ): Promise<any> {
    return this.service.getRdaReport({
      id,
      currentUser: user,
      options: { limitSetId, physiologicalStatus },
    });
  }

  @Post('import')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', { description: 'Tập tin Excel nhập khẩu phần 24h' })
  @ApiOperation({ summary: 'Nhập khẩu phần ăn 24h từ file Excel' })
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ImportDailyIntakeQueryDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!file || !file.buffer) {
      throw new HttpException(
        { code: 'FILE_REQUIRED', message: 'Vui lòng đính kèm file Excel (.xlsx)' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.excelService.importDailyIntakeExcel({
      fileBuffer: file.buffer,
      options: {
        patientId: query.patientId,
        userId: user.id,
        userRole: user.role,
        date: query.date,
        overwrite: query.overwrite,
      },
    });

    if (!result.success && result.errorFileBuffer) {
      setExcelResponseHeaders({
        res,
        filename: result.errorFileName || 'error_import_intake.xlsx',
      });
      res.end(result.errorFileBuffer);
      return;
    }

    res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: result.message || 'Import khẩu phần thành công',
      data: {
        total: result.total ?? result.importedCount,
        imported: result.imported ?? result.importedCount,
        skipped: result.skipped ?? 0,
        dailyIntakeId: result.dailyIntakeId ? String(result.dailyIntakeId) : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  @Get(':id/export')
  @Post(':id/export')
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary:
      'Xuất 4 mẫu báo cáo lâm sàng khẩu phần 24h (ALL_IN_ONE, RDA_COMPARISON, PLC_STRUCTURE, MEAL_DISTRIBUTION)',
  })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  async exportClinicalReport(
    @Param('id') id: string,
    @Body() bodyDto: ExportDailyIntakeDto,
    @Query('reportType') qReportType: DailyIntakeClinicalReportType,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const reportType =
      bodyDto?.reportType || qReportType || DailyIntakeClinicalReportType.ALL_IN_ONE;

    await this.excelService.streamClinicalReport({
      intakeIdOrData: BigInt(id),
      outputStream: res,
      reportType,
      currentUserId: user?.id,
    });
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @SkipTransform()
  @ApiOperation({
    summary:
      'Xuất 4 mẫu báo cáo khẩu phần đa bệnh nhân (1: TOTAL_FOOD_GROUP_MULTI_PATIENTS, 2: AVG_GROUP_WEIGHT_PER_PATIENT, 3: DAILY_NUTRIENT_INTAKE_PATIENT, 4: TOTAL_WEIGHT_FOOD_GROUP_MULTI_PATIENTS)',
  })
  async exportDailyIntakes(
    @Body() body: any,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    // 1. Tương thích ngược: Nếu request gửi { id / dailyIntakeId } mà KHÔNG có templateType
    const targetId = body?.id || body?.dailyIntakeId;
    if (!body?.templateType && targetId) {
      const reportType = body.reportType || DailyIntakeClinicalReportType.ALL_IN_ONE;

      await this.excelService.streamClinicalReport({
        intakeIdOrData: BigInt(targetId),
        outputStream: res,
        reportType,
        currentUserId: user?.id,
      });
      return;
    }

    // 2. Mẫu xuất đa bệnh nhân chuẩn Sprint 6 & đối chiếu Java Spring Boot
    const dto = Object.assign(new DailyIntakeExportRequestDto(), body);
    await this.reportStreamService.export({ dto, res, user });
  }
}
