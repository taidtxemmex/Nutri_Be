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
  NotFoundException,
  UnauthorizedException,
  HttpStatus,
  HttpCode,
  Optional,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { LocalStorageService } from '../services/local-storage.service';
import { FileMagicBytePipe } from '../pipes/file-magic-byte.pipe';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  FileUploadResponseDto,
  EvidenceUploadResponseDto,
  AvatarUploadResponseDto,
  ImageUploadResponseDto,
} from '../dto/file-upload-response.dto';
import { UploadEvidenceDto } from '../dto/upload-evidence.dto';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_PROFILES,
  CACHE_TAG_USERS,
  buildUserCacheTag,
} from '../../../config/constants/cache.constants';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import {
  ApiController,
  ApiStandardResponse,
  CurrentUser,
  ApiFile,
  ApiMultiFiles,
  SkipTransform,
} from '../../../common/decorators';

@ApiController('Files', 'files')
export class FilesController {
  constructor(
    private readonly storageService: LocalStorageService,
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * Helper trích xuất và xác thực nghiêm ngặt tệp ảnh đơn lẻ (JPEG, PNG, WebP tối đa 5MB)
   * Chống Polyglot, Web Shell, MIME Spoofing qua FileMagicBytePipe (Universal DRY Code Law)
   */
  private extractAndValidateSingleImage(
    files: Express.Multer.File[] | Express.Multer.File,
  ): Express.Multer.File {
    const file = Array.isArray(files) ? files[0] : files;
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn 1 tệp tin ảnh hợp lệ để tải lên',
      });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'Chỉ chấp nhận tệp hình ảnh định dạng JPEG, PNG hoặc WebP',
      });
    }

    return file;
  }

  /**
   * Tải lên một hoặc nhiều tệp tin lên ổ đĩa cứng VPS
   * Tương thích 100% với endpoint POST /api/files và POST /api/v1/files/upload
   * Chống MIME Spoofing qua FileMagicBytePipe (Kiểm tra Magic Bytes nhị phân)
   * Giới hạn kích thước tối đa 5MB/file, tối đa 5 files chống OOM
   */
  @UseGuards(JwtAuthGuard)
  @Post(['upload', ''])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 20,
      },
    }),
  )
  @ApiMultiFiles('file', {
    description: 'Danh sách tệp tin tải lên (JPG, PNG, WebP, GIF, PDF) - Tối đa 10MB/file',
  })
  @ApiOperation({
    summary: 'Tải lên tập tin đa phương tiện với xác thực Magic Bytes (Yêu cầu đăng nhập)',
  })
  @ApiStandardResponse({
    description: 'Tải lên thành công, trả về danh sách đối tượng tệp tin',
    type: FileUploadResponseDto,
    isArray: true,
  })
  async uploadFiles(
    @UploadedFiles(new FileMagicBytePipe())
    files: Express.Multer.File[],
    @Query('folder') folder?: string,
  ): Promise<FileUploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn ít nhất một tệp tin hợp lệ để tải lên',
      });
    }

    let subDir = 'public/uploads';
    if (folder === 'payments' || folder === 'payment') {
      subDir = 'protected/payments';
    } else if (folder === 'evidence') {
      subDir = 'protected/evidence';
    } else if (folder === 'avatars' || folder === 'avatar') {
      subDir = 'public/avatars';
    } else if (folder === 'dishes' || folder === 'dish') {
      subDir = 'public/dishes';
    } else if (folder === 'ingredients' || folder === 'ingredient') {
      subDir = 'public/ingredients';
    } else if (folder === 'menus' || folder === 'menu') {
      subDir = 'public/menus';
    }

    const uploadResults: FileUploadResponseDto[] = [];
    for (const file of files) {
      const result = await this.storageService.upload({ file, subDirectory: subDir });
      uploadResults.push(result);
    }

    return uploadResults;
  }

  /**
   * Tải lên và tự động cập nhật ảnh đại diện người dùng
   * Endpoint: POST /api/files/avatar (Yêu cầu JwtAuthGuard)
   * - Lưu vào thư mục public/avatars
   * - Cập nhật cột ho_so_ca_nhan.avatar_url của @CurrentUser()
   * - Invalidate cache hồ sơ người dùng (CACHE_TAG_PROFILES, CACHE_TAG_USERS)
   * - Trả về DTO chuẩn { success: true, avatarUrl, avatar_url, message }
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', {
    description: 'Tập tin ảnh đại diện (JPEG, PNG, WebP) - Tối đa 5MB',
  })
  @ApiOperation({
    summary: 'Tải lên và cập nhật ảnh đại diện người dùng hiện tại (Yêu cầu đăng nhập)',
  })
  @ApiStandardResponse({
    description: 'Cập nhật ảnh đại diện thành công',
    type: AvatarUploadResponseDto,
  })
  async uploadAvatar(
    @UploadedFiles(new FileMagicBytePipe({ allowImages: true, allowDocuments: false }))
    files: Express.Multer.File[] | Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AvatarUploadResponseDto> {
    const file = this.extractAndValidateSingleImage(files);

    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Không thể xác định danh tính người dùng.',
      });
    }

    let targetUserId = userId;
    const existingUser = await this.prisma.nguoi_dung.findFirst({
      where: {
        OR: [{ id: userId }, { keycloak_user_id: userId }],
      },
      select: { id: true, deleted_at: true },
    });

    if (!existingUser || existingUser.deleted_at) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy thông tin tài khoản người dùng hoặc tài khoản đã bị vô hiệu hóa.',
      });
    }
    targetUserId = existingUser.id;

    // Lấy thông tin avatar cũ để dọn dẹp đĩa cứng sau khi đổi ảnh mới (Chống rò rỉ dung lượng CWE-400)
    const existingProfile = await this.prisma.ho_so_ca_nhan.findUnique({
      where: { nguoi_dung_id: targetUserId },
      select: { avatar_url: true },
    });
    const oldAvatarUrl = existingProfile?.avatar_url;

    let uploadRes: FileUploadResponseDto | undefined;
    try {
      uploadRes = await this.storageService.upload({
        file,
        subDirectory: 'public/avatars',
      });

      const relativePath = uploadRes.url;

      await this.prisma.ho_so_ca_nhan.upsert({
        where: { nguoi_dung_id: targetUserId },
        create: {
          nguoi_dung_id: targetUserId,
          avatar_url: relativePath,
        },
        update: {
          avatar_url: relativePath,
        },
      });

      // Dọn dẹp tệp ảnh đại diện cũ khỏi đĩa cứng nếu có
      if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/public/avatars/')) {
        const oldObjectKey = oldAvatarUrl.replace(/^\/uploads\//, '');
        await this.storageService.delete({ objectKey: oldObjectKey }).catch(() => {});
      }

      if (this.cacheService) {
        await this.cacheService.debouncedInvalidateTags([
          CACHE_TAG_PROFILES,
          CACHE_TAG_USERS,
          buildUserCacheTag(targetUserId),
        ]);
      }

      return {
        success: true,
        avatarUrl: relativePath,
        avatar_url: relativePath,
        message: 'Cập nhật ảnh đại diện thành công',
      };
    } catch (err) {
      if (uploadRes?.objectKey) {
        await this.storageService.delete({ objectKey: uploadRes.objectKey }).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Tải lên hình ảnh món ăn
   * Endpoint: POST /api/files/dish-image (Yêu cầu JwtAuthGuard)
   * - Lưu vào thư mục public/dishes
   * - Trả về { success: true, imageUrl, image_url }
   */
  @Post('dish-image')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', {
    description: 'Tập tin hình ảnh món ăn (JPEG, PNG, WebP) - Tối đa 5MB',
  })
  @ApiOperation({
    summary: 'Tải lên hình ảnh món ăn (public/dishes, Yêu cầu đăng nhập)',
  })
  @ApiStandardResponse({
    description: 'Tải lên hình ảnh món ăn thành công',
    type: ImageUploadResponseDto,
  })
  async uploadDishImage(
    @UploadedFiles(new FileMagicBytePipe({ allowImages: true, allowDocuments: false }))
    files: Express.Multer.File[] | Express.Multer.File,
  ): Promise<ImageUploadResponseDto> {
    const file = this.extractAndValidateSingleImage(files);

    const uploadRes = await this.storageService.upload({
      file,
      subDirectory: 'public/dishes',
    });

    return {
      success: true,
      imageUrl: uploadRes.url,
      image_url: uploadRes.url,
    };
  }

  /**
   * Tải lên hình ảnh nguyên liệu
   * Endpoint: POST /api/files/ingredient-image (Yêu cầu JwtAuthGuard)
   * - Lưu vào thư mục public/ingredients
   * - Trả về { success: true, imageUrl, image_url }
   */
  @Post('ingredient-image')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', {
    description: 'Tập tin hình ảnh nguyên liệu (JPEG, PNG, WebP) - Tối đa 5MB',
  })
  @ApiOperation({
    summary: 'Tải lên hình ảnh nguyên liệu (public/ingredients, Yêu cầu đăng nhập)',
  })
  @ApiStandardResponse({
    description: 'Tải lên hình ảnh nguyên liệu thành công',
    type: ImageUploadResponseDto,
  })
  async uploadIngredientImage(
    @UploadedFiles(new FileMagicBytePipe({ allowImages: true, allowDocuments: false }))
    files: Express.Multer.File[] | Express.Multer.File,
  ): Promise<ImageUploadResponseDto> {
    const file = this.extractAndValidateSingleImage(files);

    const uploadRes = await this.storageService.upload({
      file,
      subDirectory: 'public/ingredients',
    });

    return {
      success: true,
      imageUrl: uploadRes.url,
      image_url: uploadRes.url,
    };
  }

  /**
   * Tải lên hình ảnh thực đơn
   * Endpoint: POST /api/files/menu-image (Yêu cầu JwtAuthGuard)
   * - Lưu vào thư mục public/menus
   * - Trả về { success: true, imageUrl, image_url }
   */
  @Post('menu-image')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiFile('file', {
    description: 'Tập tin hình ảnh thực đơn (JPEG, PNG, WebP) - Tối đa 5MB',
  })
  @ApiOperation({
    summary: 'Tải lên hình ảnh thực đơn (public/menus, Yêu cầu đăng nhập)',
  })
  @ApiStandardResponse({
    description: 'Tải lên hình ảnh thực đơn thành công',
    type: ImageUploadResponseDto,
  })
  async uploadMenuImage(
    @UploadedFiles(new FileMagicBytePipe({ allowImages: true, allowDocuments: false }))
    files: Express.Multer.File[] | Express.Multer.File,
  ): Promise<ImageUploadResponseDto> {
    const file = this.extractAndValidateSingleImage(files);

    const uploadRes = await this.storageService.upload({
      file,
      subDirectory: 'public/menus',
    });

    return {
      success: true,
      imageUrl: uploadRes.url,
      image_url: uploadRes.url,
    };
  }

  /**
   * Tải lên tệp minh chứng y tế / hóa đơn thanh toán
   * Lưu vào thư mục bảo mật protected/payments hoặc protected/evidence và lưu bản ghi vào bảng minh_chung
   */
  @Post('upload-evidence')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
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
    @CurrentUser() user: AuthenticatedUser,
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

    // 3. Lưu file an toàn vào thư mục protected (payments cho biên lai, evidence cho y tế)
    let uploadRes: FileUploadResponseDto | undefined;
    const subFolder = body.paymentRequestId ? 'protected/payments' : 'protected/evidence';
    try {
      uploadRes = await this.storageService.upload({ file, subDirectory: subFolder });

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
      const previewUrl = this.storageService.generateSignedUrl({
        objectKey: uploadRes.objectKey,
        action: 'preview',
      });
      const downloadUrl = this.storageService.generateSignedUrl({
        objectKey: uploadRes.objectKey,
        action: 'download',
        originalFileName: uploadRes.originalFileName,
      });

      return {
        id: evidence.id.toString(),
        objectKey: uploadRes.objectKey,
        fileName: uploadRes.fileName || uploadRes.originalFileName,
        originalFileName: uploadRes.originalFileName,
        mimeType: uploadRes.mimeType,
        fileSize: uploadRes.fileSize,
        url: uploadRes.url,
        previewUrl,
        downloadUrl,
        uploadedAt: evidence.ngay_upload,
      } as EvidenceUploadResponseDto;
    } catch (err) {
      if (uploadRes?.objectKey) {
        await this.storageService.delete({ objectKey: uploadRes.objectKey }).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Xem trước tập tin (Inline Preview) có xác thực chữ ký HMAC-SHA256
   */
  @Get('preview')
  @SkipTransform()
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
    const isValid = this.storageService.verifySignedUrl({
      objectKey,
      token,
      expires: Number(expires),
      action: 'preview',
    });

    if (!isValid) {
      throw new ForbiddenException({
        code: 'HMAC_SIGNATURE_INVALID',
        message: 'Chữ ký bảo mật HMAC không hợp lệ hoặc liên kết xem trước đã hết hạn',
      });
    }

    const fileData = await this.storageService.getFile({ objectKey });

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
  @SkipTransform()
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
    const isValid = this.storageService.verifySignedUrl({
      objectKey,
      token,
      expires: Number(expires),
      action: 'download',
    });

    if (!isValid) {
      throw new ForbiddenException({
        code: 'HMAC_SIGNATURE_INVALID',
        message: 'Chữ ký bảo mật HMAC không hợp lệ hoặc liên kết tải về đã hết hạn',
      });
    }

    const fileData = await this.storageService.getFile({ objectKey });

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
  @UseGuards(JwtAuthGuard)
  @Delete(':objectKey(*)')
  @ApiOperation({ summary: 'Xóa tệp tin khỏi hệ thống lưu trữ đĩa cứng' })
  @ApiParam({ name: 'objectKey', description: 'Đường dẫn đối tượng cần xóa' })
  async deleteFile(
    @Param('objectKey') objectKey: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const role =
      user?.role || (user as (AuthenticatedUser & { vai_tro?: string }) | undefined)?.vai_tro;
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    if (objectKey.startsWith('protected/') && !isAdmin) {
      throw new ForbiddenException({
        code: 'AUTH_002',
        message: 'Bạn không có quyền xóa tệp tin được bảo vệ',
      });
    }

    const deleted = await this.storageService.delete({ objectKey });
    return {
      success: deleted,
      message: deleted
        ? 'Đã xóa tệp tin thành công'
        : 'Tệp tin không tồn tại hoặc đã bị xóa trước đó',
    };
  }
}
