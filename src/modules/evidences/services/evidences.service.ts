import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EvidenceStorageService } from './evidence-storage.service';
import { UserRole, isAdminRole } from '../../../config/enums/role.enum';
import { MAX_FILE_SIZE_BYTES } from '../../../config/upload.constants';

@Injectable()
export class EvidencesService {
  private readonly logger = new Logger(EvidencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: EvidenceStorageService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  private async findAndCheckPermission(
    evidenceId: string | number,
    currentUser: { id: string; role?: string },
  ) {
    const evidence = await this.prisma.minh_chung.findUnique({
      where: { id: BigInt(evidenceId) },
      include: {
        de_xuat_nguyen_lieu: { select: { nguoi_tao_id: true } },
        yeu_cau_thanh_toan: { select: { nguoi_dung_id: true } },
      },
    });

    if (!evidence) {
      throw new HttpException(
        { code: 'EVID_001', message: 'Không tìm thấy tài liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (this.isAdmin(currentUser)) {
      return evidence;
    }

    const isUploader = evidence.nguoi_upload_id === currentUser.id;
    const isProposalOwner = evidence.de_xuat_nguyen_lieu?.nguoi_tao_id === currentUser.id;
    const isPaymentOwner = evidence.yeu_cau_thanh_toan?.nguoi_dung_id === currentUser.id;

    if (!isUploader && !isProposalOwner && !isPaymentOwner) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      );
    }

    return evidence;
  }

  async generatePreviewUrl(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<string> {
    const evidence = await this.findAndCheckPermission(id, currentUser);

    if (evidence.link_ngoai && !evidence.object_key) {
      return evidence.link_ngoai;
    }

    if (!evidence.object_key) {
      throw new HttpException(
        { code: 'EVID_002', message: 'Yêu cầu tài liệu không hợp lệ' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (evidence.dung_luong != null && Number(evidence.dung_luong) > MAX_FILE_SIZE_BYTES) {
      throw new HttpException(
        { code: 'PROP_013', message: 'File vượt quá kích thước cho phép.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.storageService.generatePreviewUrl(evidence.object_key);
  }

  async generateDownloadUrl(
    id: string | number,
    currentUser: { id: string; role?: string },
  ): Promise<string> {
    const evidence = await this.findAndCheckPermission(id, currentUser);

    if (evidence.link_ngoai && !evidence.object_key) {
      return evidence.link_ngoai;
    }

    if (!evidence.object_key) {
      throw new HttpException(
        { code: 'EVID_002', message: 'Yêu cầu tài liệu không hợp lệ' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.storageService.generateDownloadUrl(
      evidence.object_key,
      evidence.ten_file_goc || undefined,
    );
  }
}
