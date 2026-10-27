import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateIngredientProposalDto } from '../dto/create-ingredient-proposal.dto';
import { UserRole, isAdminRole } from '../../../config/enums/role.enum';

@Injectable()
export class IngredientProposalsService {
  private readonly logger = new Logger(IngredientProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  /**
   * 1. POST /api/ingredient-proposals: Nộp đề xuất nguyên liệu mới
   */
  async create(
    dto: CreateIngredientProposalDto,
    currentUser: { id: string; role?: string },
  ): Promise<any> {
    const categoryId = Number(dto.categoryId);
    const category = await this.prisma.danh_muc.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new HttpException(
        { code: 'CAT_NOT_FOUND', message: 'Không tìm thấy danh mục thực phẩm' },
        HttpStatus.NOT_FOUND,
      );
    }

    const proposalType =
      dto.proposalType === 'UPDATE' || dto.proposalType === 'CAP_NHAT'
        ? 'CAP_NHAT'
        : 'THEM_MOI';

    const nutrientsJson = JSON.stringify(dto.nutrients || {});

    const proposal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: dto.ingredientName.trim(),
          danh_muc: categoryId,
          loai_protein: dto.loaiProtein || null,
          edible: dto.edible != null ? Number(dto.edible) : 100,
          ghi_chu: dto.note || null,
          gia_tri_dinh_duong_json: nutrientsJson,
          loai_de_xuat: proposalType,
          nguyen_lieu_id: dto.ingredientId ? BigInt(dto.ingredientId) : null,
          trang_thai: 'CHO_DUYET',
          nguoi_tao_id: currentUser.id,
          ngay_tao: new Date(),
        },
      });

      if (dto.evidences && Array.isArray(dto.evidences) && dto.evidences.length > 0) {
        for (const ev of dto.evidences) {
          await tx.minh_chung.create({
            data: {
              de_xuat_id: created.id,
              nguoi_upload_id: currentUser.id,
              object_key: ev.objectKey || null,
              ten_file_goc: ev.originalFileName || null,
              mime_type: ev.mimeType || null,
              dung_luong: ev.fileSize ? BigInt(ev.fileSize) : null,
              link_ngoai: ev.externalLink || null,
              ngay_upload: new Date(),
            },
          });
        }
      }

      return created;
    });

    return {
      id: proposal.id.toString(),
      ingredientName: proposal.ten_nguyen_lieu,
      status: proposal.trang_thai,
      message: 'Gửi đề xuất nguyên liệu thành công, đang chờ quản trị viên phê duyệt',
    };
  }

  /**
   * 2. GET /api/ingredient-proposals: Danh sách đề xuất
   */
  async findAll(currentUser: { id: string; role?: string }, status?: string): Promise<any[]> {
    const where: any = {};
    if (!this.isAdmin(currentUser)) {
      where.nguoi_tao_id = currentUser.id;
    }

    if (status && status.trim()) {
      where.trang_thai = status.trim();
    }

    const proposals = await this.prisma.de_xuat_nguyen_lieu.findMany({
      where,
      include: {
        danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc: { select: { ten_danh_muc: true } },
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung: { select: { ten_dang_nhap: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return proposals.map((p) => ({
      id: p.id.toString(),
      name: p.ten_nguyen_lieu,
      categoryName: p.danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || null,
      categoryId: p.danh_muc,
      proposalType: p.loai_de_xuat,
      status: p.trang_thai,
      createdAt: p.ngay_tao,
      createdBy: p.nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung?.ten_dang_nhap || null,
    }));
  }

  /**
   * 3. GET /api/ingredient-proposals/:id: Chi tiết đề xuất
   */
  async findById(id: string | number | bigint, currentUser: { id: string; role?: string }): Promise<any> {
    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_nguyen_lieu.findUnique({
      where: { id: proposalId },
      include: {
        danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc: true,
        minh_chung: true,
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung: { select: { ten_dang_nhap: true } },
      },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (proposal.nguoi_tao_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Bạn không có quyền truy cập đề xuất này' },
        HttpStatus.FORBIDDEN,
      );
    }

    let nutrients = {};
    try {
      nutrients = JSON.parse(proposal.gia_tri_dinh_duong_json || '{}');
    } catch {}

    return {
      id: proposal.id.toString(),
      name: proposal.ten_nguyen_lieu,
      ingredientName: proposal.ten_nguyen_lieu,
      categoryId: proposal.danh_muc,
      categoryName: proposal.danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || null,
      proteinType: proposal.loai_protein,
      edible: proposal.edible,
      note: proposal.ghi_chu,
      nutrients,
      status: proposal.trang_thai,
      rejectReason: proposal.ly_do_tu_choi,
      createdAt: proposal.ngay_tao,
      createdBy: proposal.nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung?.ten_dang_nhap,
      evidences: proposal.minh_chung.map((m) => ({
        id: m.id.toString(),
        objectKey: m.object_key,
        originalFileName: m.ten_file_goc,
        externalLink: m.link_ngoai,
      })),
    };
  }

  /**
   * 4. PUT /api/ingredient-proposals/:id/approve: Phê duyệt đề xuất nguyên liệu (Admin Only)
   */
  async approve(id: string | number | bigint, currentUser: { id: string; role?: string }): Promise<any> {
    if (!this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Chỉ quản trị viên mới có quyền phê duyệt đề xuất' },
        HttpStatus.FORBIDDEN,
      );
    }

    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_nguyen_lieu.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (proposal.trang_thai !== 'CHO_DUYET') {
      throw new HttpException(
        { code: 'PROPOSAL_ALREADY_PROCESSED', message: 'Đề xuất này đã được xử lý trước đó' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let nutrients: Record<string, any> = {};
    try {
      nutrients = JSON.parse(proposal.gia_tri_dinh_duong_json || '{}');
    } catch {}

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo nguyên liệu chính thức trong bảng nguyen_lieu
      const newIng = await tx.nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: proposal.ten_nguyen_lieu,
          danh_muc: proposal.danh_muc,
          loai_protein: proposal.loai_protein || 'THUC_VAT',
          edible: proposal.edible != null ? Number(proposal.edible) : 100,
          water: nutrients.water ? Number(nutrients.water) : 0,
          protein: nutrients.protein ? Number(nutrients.protein) : 0,
          fat: nutrients.fat ? Number(nutrients.fat) : 0,
          fiber: nutrients.fiber ? Number(nutrients.fiber) : 0,
          ash: nutrients.ash ? Number(nutrients.ash) : 0,
          calci: nutrients.calci ? Number(nutrients.calci) : 0,
          iron: nutrients.iron ? Number(nutrients.iron) : 0,
          sodium: nutrients.sodium ? Number(nutrients.sodium) : 0,
          potassium: nutrients.potassium ? Number(nutrients.potassium) : 0,
          trang_thai: 'DA_DUYET',
          tao_boi_id: proposal.nguoi_tao_id,
        },
      });

      // 2. Cập nhật trạng thái đề xuất và gán nguyen_lieu_id
      await tx.de_xuat_nguyen_lieu.update({
        where: { id: proposalId },
        data: {
          trang_thai: 'DA_DUYET',
          nguyen_lieu_id: newIng.id,
          nguoi_duyet_id: currentUser.id,
          ngay_duyet: new Date(),
        },
      });

      return newIng;
    });

    return {
      success: true,
      message: 'Phê duyệt đề xuất nguyên liệu thành công',
      ingredientId: result.id.toString(),
    };
  }

  /**
   * 5. PUT /api/ingredient-proposals/:id/reject: Từ chối đề xuất nguyên liệu (Admin Only)
   */
  async reject(
    id: string | number | bigint,
    reason: string,
    currentUser: { id: string; role?: string },
  ): Promise<any> {
    if (!this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'AUTH_002', message: 'Chỉ quản trị viên mới có quyền từ chối đề xuất' },
        HttpStatus.FORBIDDEN,
      );
    }

    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_nguyen_lieu.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new HttpException(
        { code: 'PROPOSAL_NOT_FOUND', message: 'Không tìm thấy đề xuất nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (proposal.trang_thai !== 'CHO_DUYET') {
      throw new HttpException(
        { code: 'PROPOSAL_ALREADY_PROCESSED', message: 'Đề xuất này đã được xử lý trước đó' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.de_xuat_nguyen_lieu.update({
      where: { id: proposalId },
      data: {
        trang_thai: 'TU_CHOI',
        ly_do_tu_choi: reason || 'Không đạt tiêu chí kiểm định lâm sàng',
        nguoi_duyet_id: currentUser.id,
        ngay_duyet: new Date(),
      },
    });

    return { success: true, message: 'Từ chối đề xuất nguyên liệu thành công' };
  }
}
