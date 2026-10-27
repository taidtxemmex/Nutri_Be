import {
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PatientsService } from '../services/patients.service';
import { PatientExcelService } from '../services/patient-excel.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientQueryDto,
  PatientResponseDto,
  PatientCodePreviewDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  Auth,
  CurrentUser,
} from '../../../common/decorators';
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe';

@ApiController('Patients', ['patients'], { auth: true })
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly patientExcelService: PatientExcelService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bệnh nhân phân trang & tìm kiếm' })
  @ApiPaginatedResponse({
    type: PatientResponseDto,
    description: 'Danh sách bệnh nhân',
  })
  async findAll(@Query() query: PatientQueryDto, @CurrentUser() user: any) {
    return this.patientsService.findAll(query, user);
  }

  @Get('code-preview')
  @ApiOperation({ summary: 'Gợi ý mã bệnh nhân dựa trên số điện thoại' })
  @ApiQuery({ name: 'phone', required: false })
  @ApiQuery({ name: 'excludeId', required: false })
  async previewCode(
    @Query('phone') phone?: string,
    @Query('excludeId') excludeId?: string,
    @CurrentUser() user?: any,
  ): Promise<PatientCodePreviewDto> {
    return this.patientsService.previewCode(phone, excludeId, user);
  }

  @Get('import-template')
  @ApiOperation({ summary: 'Tải file mẫu Excel import bệnh nhân' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.patientExcelService.getTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Template_import_benh_nhan.xlsx',
    );
    return res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import bệnh nhân từ file Excel (trả về file nếu có lỗi)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    if (!file || !file.buffer) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: HttpStatus.BAD_REQUEST,
        message: 'Vui lòng đính kèm file Excel (.xlsx)',
      });
    }

    const result = await this.patientExcelService.importExcel(file.buffer, user);

    if (!result.success && result.errorFileBuffer) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${result.errorFileName || 'patient_import_result.xlsx'}`,
      );
      return res.end(result.errorFileBuffer);
    }

    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: result.message,
      data: { count: result.count },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hồ sơ bệnh nhân' })
  @ApiParam({ name: 'id', description: 'ID bệnh nhân' })
  @ApiStandardResponse({
    type: PatientResponseDto,
    description: 'Chi tiết hồ sơ bệnh nhân',
  })
  async findById(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: any,
  ): Promise<PatientResponseDto> {
    return this.patientsService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới hồ sơ bệnh nhân' })
  @ApiStandardResponse({
    type: PatientResponseDto,
    status: 201,
    description: 'Tạo mới bệnh nhân thành công',
  })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: any,
  ): Promise<PatientResponseDto> {
    return this.patientsService.create(dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ bệnh nhân' })
  @ApiParam({ name: 'id', description: 'ID bệnh nhân' })
  @ApiStandardResponse({
    type: PatientResponseDto,
    description: 'Cập nhật bệnh nhân thành công',
  })
  async update(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: any,
  ): Promise<PatientResponseDto> {
    return this.patientsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa hồ sơ bệnh nhân (chỉ khi không có thực đơn/khẩu phần)' })
  @ApiParam({ name: 'id', description: 'ID bệnh nhân' })
  @ApiStandardResponse({
    description: 'Xóa hồ sơ bệnh nhân thành công',
  })
  async delete(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.patientsService.delete(id, user);
  }
}
