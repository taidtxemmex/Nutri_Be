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
  CreateAnthropometryDto,
  AnthropometryQueryDto,
  AnthropometryResponseDto,
  CreateMedicalRecordDto,
  MedicalRecordQueryDto,
  MedicalRecordResponseDto,
} from '../dto';
import {
  ApiController,
  ApiStandardResponse,
  ApiPaginatedResponse,
  CurrentUser,
} from '../../../common/decorators';
import { ParseBigIntPipe } from '../../../common/pipes/parse-bigint.pipe';

const PATIENT_ID_PARAM = { name: 'id', description: 'ID bệnh nhân' };

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
    res.setHeader('Content-Disposition', 'attachment; filename=Template_import_benh_nhan.xlsx');
    return res.end(buffer);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
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
      res.status(HttpStatus.OK);
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
      success: true,
      count: result.count,
      data: { success: true, count: result.count },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hồ sơ bệnh nhân' })
  @ApiParam(PATIENT_ID_PARAM)
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
  @ApiParam(PATIENT_ID_PARAM)
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
  @ApiParam(PATIENT_ID_PARAM)
  @ApiStandardResponse({
    description: 'Xóa hồ sơ bệnh nhân thành công',
  })
  async delete(
    @Param('id', ParseBigIntPipe) id: bigint,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.patientsService.delete(id, user);
  }

  // ==========================================
  // SUB-RESOURCE ENDPOINTS (Rule 12 Decomposition)
  // ==========================================

  @Get(':id/anthropometry')
  @ApiOperation({ summary: 'Lấy lịch sử biến thiên thể trạng nhân trắc học phân trang' })
  @ApiParam(PATIENT_ID_PARAM)
  @ApiPaginatedResponse({
    type: AnthropometryResponseDto,
    description: 'Danh sách nhân trắc học phân trang sắp xếp theo ngày đo mới nhất',
  })
  async getAnthropometry(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query() query: AnthropometryQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.getAnthropometryHistory(id, query, user);
  }

  @Post(':id/anthropometry')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ghi nhận biến thiên cân nặng, chiều cao, BMI, huyết áp' })
  @ApiParam(PATIENT_ID_PARAM)
  @ApiStandardResponse({
    type: AnthropometryResponseDto,
    status: 201,
    description: 'Ghi nhận thể trạng nhân trắc học thành công',
  })
  async createAnthropometry(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateAnthropometryDto,
    @CurrentUser() user: any,
  ): Promise<AnthropometryResponseDto> {
    return this.patientsService.createAnthropometry(id, dto, user);
  }

  @Get(':id/medical-records')
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ khám bệnh lâm sàng phân trang' })
  @ApiParam(PATIENT_ID_PARAM)
  @ApiPaginatedResponse({
    type: MedicalRecordResponseDto,
    description: 'Danh sách bệnh án phân trang sắp xếp theo ngày khám mới nhất',
  })
  async getMedicalRecords(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query() query: MedicalRecordQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.getMedicalRecords(id, query, user);
  }

  @Post(':id/medical-records')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lưu hồ sơ khám bệnh, chẩn đoán, mã ICD-10 và thực đơn can thiệp' })
  @ApiParam(PATIENT_ID_PARAM)
  @ApiStandardResponse({
    type: MedicalRecordResponseDto,
    status: 201,
    description: 'Lưu hồ sơ bệnh án thành công',
  })
  async createMedicalRecord(
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: CreateMedicalRecordDto,
    @CurrentUser() user: any,
  ): Promise<MedicalRecordResponseDto> {
    return this.patientsService.createMedicalRecord(id, dto, user);
  }
}
