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
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiParam, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
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
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  Auth,
  CurrentUser,
  SkipTransform,
  ApiFile,
} from '../../../common/decorators';
import { DailyIntakeClinicalReportType } from '../../../config/enums/domain.enum';

@ApiController('DailyIntakes', 'daily-intakes')
export class DailyIntakesController {
  constructor(
    private readonly service: DailyIntakesService,
    private readonly excelService: DailyIntakeExcelService,
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
    return this.service.getAll(query, user);
  }

  @Get('template')
  @Get('import-template')
  @Auth()
  @SkipTransform()
  @ApiOperation({ summary: 'Tải file Excel mẫu để nhập liệu khẩu phần 24h' })
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.excelService.generateTemplate();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Template_nhap_lieu_khau_phan_24h.xlsx"',
      'Content-Length': buffer.length,
    });

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
    return this.service.getByPatient(patientId, user);
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
    return this.service.getById(id, user);
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
    return this.service.create(dto, user);
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
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Xóa khẩu phần 24h' })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.service.delete(id, user);
  }

  @Get(':id/rda-report')
  @Auth()
  @ApiOperation({
    summary: 'Báo cáo đánh giá RDA/DRI lâm sàng đối chiếu chuẩn Viện Dinh Dưỡng Quốc Gia',
  })
  @ApiParam({ name: 'id', description: 'ID khẩu phần 24h' })
  async getRdaReport(@Param('id') id: string, @CurrentUser() user: any): Promise<any> {
    return this.service.getRdaReport(id, user);
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
    const result = await this.excelService.importDailyIntakeExcel(file?.buffer, {
      patientId: query.patientId,
      userId: user.id,
      date: query.date,
      overwrite: query.overwrite,
    });

    if (!result.success && result.errorFileBuffer) {
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.errorFileName || 'error_import_intake.xlsx'}"`,
        'Content-Length': result.errorFileBuffer.length,
      });
      res.end(result.errorFileBuffer);
      return;
    }

    res.json({
      status: HttpStatus.OK,
      message: result.message || 'Import khẩu phần thành công',
      data: result,
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

    const buffer = await this.excelService.exportClinicalReport(BigInt(id), reportType, user?.id);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bao_cao_lam_sang_24h_${id}_${reportType.toLowerCase()}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Post('export')
  @Auth()
  @SkipTransform()
  @ApiOperation({ summary: 'Xuất báo cáo lâm sàng khẩu phần 24h qua POST payload' })
  async exportClinicalReportPost(
    @Body() body: any,
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<void> {
    const targetId = body.id || body.dailyIntakeId;
    const reportType = body.reportType || DailyIntakeClinicalReportType.ALL_IN_ONE;

    const buffer = await this.excelService.exportClinicalReport(
      BigInt(targetId),
      reportType,
      user?.id,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bao_cao_lam_sang_24h_${targetId}_${reportType.toLowerCase()}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
