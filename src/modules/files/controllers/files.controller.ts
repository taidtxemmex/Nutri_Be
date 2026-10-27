import {
  Post,
  Get,
  Delete,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  UploadedFile,
  Body,
  Query,
  Param,
  Res,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  AnyFilesInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { LocalStorageService } from '../services/local-storage.service';
import { FileMagicBytePipe } from '../pipes/file-magic-byte.pipe';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  FileUploadResponseDto,
  EvidenceUploadResponseDto,
} from '../dto/file-upload-response.dto';
import { UploadEvidenceDto } from '../dto/upload-evidence.dto';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ApiController,
  ApiStandardResponse,
  CurrentUser,
  ApiFile,
  ApiMultiFiles,
} from '../../../common/decorators';

@ApiController('Files', 'files')
export class FilesController {
  constructor(
    private readonly storageService: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Tải lên một hoặc nhiều tệp tin lên ổ đĩa cứng VPS
   * Tương thích 100% với endpoint POST /api/files và POST /api/v1/files/upload
   * Chống MIME Spoofing qua FileMagicBytePipe (Kiểm tra Magic Bytes nhị phân)
   */
  @Post(['upload', ''])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  @ApiMultiFiles('file', {
    description: 'Danh sách tệp tin tải lên (JPG, PNG, WebP, GIF, PDF)',
  })
  @ApiOperation({
    summary: 'Tải lên tập tin đa phương tiện với xác thực Magic Bytes',
  })
  @ApiStandardResponse({
    description: 'Tải lên thành công, trả về danh sách đối tượng tệp tin',
    type: FileUploadResponseDto,
    isArray: true,
  })
  async uploadFiles(
    @UploadedFiles(new FileMagicBytePipe())
    files: Express.Multer.File[],
  ): Promise<FileUploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn ít nhất một tệp tin hợp lệ để tải lên',
      });
    }

    const uploadResults: FileUploadResponseDto[] = [];
    for (const file of files) {
      const result = await this.storageService.upload(file);
      uploadResults.push(result);
    }

    return uploadResults;
  }

  /**
   * Tải lên tệp minh chứng y tế / hóa đơn thanh toán
   * Lưu vào thư mục bảo mật protected/evidence và lưu bản ghi vào bảng minh_chung
   */
  @Post('upload-evidence')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiFile('file', {
    description: 'Tập tin minh chứng (Ảnh kết quả xét nghiệm, hóa đơn chuyển khoản)',
  })
  @ApiOperation({
    summary: 'Tải lên minh chứng y khoa / thanh toán và lưu vào CSDL',
  })
  @ApiStandardResponse({
    description: 'Lưu minh chứng thành công kèm URL có chữ ký HMAC',
    type: EvidenceUploadResponseDto,
  })
  async uploadEvidence(
    @UploadedFile(new FileMagicBytePipe())
    file: Express.Multer.File,
    @Body() body: UploadEvidenceDto,
    @CurrentUser() user: any,
  ): Promise<EvidenceUploadResponseDto> {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn tệp tin minh chứng để tải lên',
      });
    }

    // 1. Kiểm tra tính hợp lệ của paymentRequestId / proposalId TRƯỚC KHI ghi đĩa
    if (body.paymentRequestId && this.prisma.yeu_cau_thanh_toan) {
      const payment = await this.prisma.yeu_cau_thanh_toan.findUnique({
        where: { id: BigInt(body.paymentRequestId) },
        select: { id: true },
      });
      if (!payment) {
        throw new BadRequestException({
          code: 'PAYMENT_REQUEST_NOT_FOUND',
          message: 'Yêu cầu thanh toán không tồn tại',
        });
      }
    }

    if (body.proposalId && this.prisma.de_xuat_nguyen_lieu) {
      const proposal = await this.prisma.de_xuat_nguyen_lieu.findUnique({
        where: { id: BigInt(body.proposalId) },
        select: { id: true },
      });
      if (!proposal) {
        throw new BadRequestException({
          code: 'PROPOSAL_NOT_FOUND',
          message: 'Đề xuất nguyên liệu không tồn tại',
        });
      }
    }

    // 2. Xác định uploader ID từ người dùng đã xác thực
    let uploaderId = user?.id;
    if (!uploaderId) {
      const firstUser = await this.prisma.nguoi_dung.findFirst({
        select: { id: true },
      });
      uploaderId = firstUser ? firstUser.id : 'system-evidence-uploader';
    }

    // 3. Lưu file an toàn vào thư mục protected/evidence (Có rollback dọn đĩa nếu DB fail)
    let uploadRes: any;
    try {
      uploadRes = await this.storageService.upload(file, 'protected/evidence');

      const evidence = await this.prisma.minh_chung.create({
        data: {
          object_key: uploadRes.objectKey,
          ten_file_goc: uploadRes.originalFileName,
          mime_type: uploadRes.mimeType,
          dung_luong: BigInt(uploadRes.fileSize),
          bucket_name: 'vps-storage',
          ngay_upload: new Date(),
          nguoi_upload_id: uploaderId,
          de_xuat_id: body.proposalId ? BigInt(body.proposalId) : null,
          yeu_cau_id: body.paymentRequestId ? BigInt(body.paymentRequestId) : null,
        },
      });

      // 4. Sinh link HMAC xem trước và tải về có hạn 10 phút
      const previewUrl = this.storageService.generateSignedUrl(
        uploadRes.objectKey,
        'preview',
      );
      const downloadUrl = this.storageService.generateSignedUrl(
        uploadRes.objectKey,
        'download',
        undefined,
        uploadRes.originalFileName,
      );

      return {
        id: evidence.id.toString(),
        objectKey: uploadRes.objectKey,
        originalFileName: uploadRes.originalFileName,
        mimeType: uploadRes.mimeType,
        fileSize: uploadRes.fileSize,
        url: uploadRes.url,
        previewUrl,
        downloadUrl,
        uploadedAt: evidence.ngay_upload,
      };
    } catch (err) {
      if (uploadRes?.objectKey) {
        await this.storageService.delete(uploadRes.objectKey).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Xem trước tập tin (Inline Preview) có xác thực chữ ký HMAC-SHA256
   */
  @Get('preview')
  @ApiOperation({
    summary: 'Xem trước tập tin nhạy cảm có chữ ký bảo mật HMAC',
  })
  @ApiQuery({ name: 'objectKey', description: 'Đường dẫn định danh file' })
  @ApiQuery({ name: 'token', description: 'Mã chữ ký bảo mật HMAC-SHA256' })
  @ApiQuery({ name: 'expires', description: 'Thời điểm hết hạn (Unix timestamp)' })
  async previewFile(
    @Query('objectKey') objectKey: string,
    @Query('token') token: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ): Promise<void> {
    const isValid = this.storageService.verifySignedUrl(
      objectKey,
      token,
      Number(expires),
      'preview',
    );

    if (!isValid) {
      throw new ForbiddenException({
        code: 'HMAC_SIGNATURE_INVALID',
        message: 'Chữ ký bảo mật HMAC không hợp lệ hoặc liên kết xem trước đã hết hạn',
      });
    }

    const fileData = await this.storageService.getFile(objectKey);

    res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.send(fileData.buffer);
  }

  /**
   * Tải về tập tin (Attachment Download) có xác thực chữ ký HMAC-SHA256
   * Chống HTTP Header Injection (CWE-113) qua Content-Disposition
   */
  @Get('download')
  @ApiOperation({
    summary: 'Tải về tập tin an toàn có chữ ký bảo mật HMAC',
  })
  @ApiQuery({ name: 'objectKey', description: 'Đường dẫn định danh file' })
  @ApiQuery({ name: 'token', description: 'Mã chữ ký bảo mật HMAC-SHA256' })
  @ApiQuery({ name: 'expires', description: 'Thời điểm hết hạn (Unix timestamp)' })
  @ApiQuery({ name: 'filename', required: false, description: 'Tên file gốc mong muốn' })
  async downloadFile(
    @Query('objectKey') objectKey: string,
    @Query('token') token: string,
    @Query('expires') expires: string,
    @Query('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const isValid = this.storageService.verifySignedUrl(
      objectKey,
      token,
      Number(expires),
      'download',
    );

    if (!isValid) {
      throw new ForbiddenException({
        code: 'HMAC_SIGNATURE_INVALID',
        message: 'Chữ ký bảo mật HMAC không hợp lệ hoặc liên kết tải về đã hết hạn',
      });
    }

    const fileData = await this.storageService.getFile(objectKey);

    // Chống HTTP Header Injection (CWE-113): Lọc bỏ \r, \n, "
    const rawFileName = filename || path.basename(objectKey);
    const sanitizedFileName = rawFileName.replace(/["\r\n\\]/g, '_');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(sanitizedFileName)}"`,
    );
    res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(fileData.buffer);
  }

  /**
   * Xóa tệp tin an toàn khỏi hệ thống lưu trữ
   */
  @Delete(':objectKey(*)')
  @ApiOperation({ summary: 'Xóa tệp tin khỏi hệ thống lưu trữ đĩa cứng' })
  @ApiParam({ name: 'objectKey', description: 'Đường dẫn đối tượng cần xóa' })
  async deleteFile(
    @Param('objectKey') objectKey: string,
  ): Promise<{ success: boolean; message: string }> {
    const deleted = await this.storageService.delete(objectKey);
    return {
      success: deleted,
      message: deleted
        ? 'Đã xóa tệp tin thành công'
        : 'Tệp tin không tồn tại hoặc đã bị xóa trước đó',
    };
  }
}
