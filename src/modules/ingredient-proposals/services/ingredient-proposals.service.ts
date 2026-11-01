import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CACHE_TAG_DISHES,
  CACHE_TAG_INGREDIENTS,
  buildIngredientCacheTag,
} from '../../../config/constants/cache.constants';
import {
  CreateIngredientProposalParamsDto,
  FindAllIngredientProposalsParamsDto,
  FindIngredientProposalByIdParamsDto,
  ApproveIngredientProposalParamsDto,
  RejectIngredientProposalParamsDto,
} from '../dto';
import { isAdminRole } from '../../../config/enums/role.enum';
import { API_KEY_TO_DB_COLUMN } from '../../ingredients/services/ingredient-excel.service';

@Injectable()
export class IngredientProposalsService {
  private readonly logger = new Logger(IngredientProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return isAdminRole(user);
  }

  /**
   * Chuẩn hóa và map proposalType tương thích ngược:
   * Hỗ trợ cả 'ADD' / 'THEM_MOI' -> 'ADD'
   * Hỗ trợ cả 'UPDATE' / 'CAP_NHAT' -> 'UPDATE'
   */
  private normalizeProposalType(type?: string | null): 'ADD' | 'UPDATE' {
    if (!type) return 'ADD';
    const upper = type.toUpperCase().trim();
    if (upper === 'UPDATE' || upper === 'CAP_NHAT') {
      return 'UPDATE';
    }
    return 'ADD';
  }

  /**
   * Trích xuất 77 vi chất từ bản ghi nguyen_lieu sang object theo camelCase API key
   */
  private extractNutrientsFromIngredient(ingredient: any): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    if (!ingredient) return result;
    for (const [apiKey, dbCol] of Object.entries(API_KEY_TO_DB_COLUMN)) {
      const val = ingredient[dbCol];
      if (val !== undefined && val !== null) {
        result[apiKey] = Number(val);
      }
    }
    return result;
  }

  /**
   * Ánh xạ đầy đủ 77 chất dinh dưỡng từ JSON đề xuất sang dữ liệu DB nguyen_lieu
   */
  private mapNutrientsToDbColumns(
    nutrients: Record<string, any>,
    resetMissingToNull = false,
  ): Record<string, number | null> {
    const data: Record<string, number | null> = {};
    for (const [apiKey, dbCol] of Object.entries(API_KEY_TO_DB_COLUMN)) {
      const rawVal = nutrients ? nutrients[apiKey] : undefined;
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const num = Number(rawVal);
        data[dbCol] = isNaN(num) ? null : num;
      } else if (resetMissingToNull) {
        data[dbCol] = null;
      }
    }
    return data;
  }

  /**
   * 1. POST /api/ingredient-proposals: Nộp đề xuất nguyên liệu mới
   */
  async create({ dto, currentUser }: CreateIngredientProposalParamsDto): Promise<any> {
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

    const proposalType = this.normalizeProposalType(dto.proposalType);

    let originalIngredient: any = null;
    let oldNutrientsJson: string | null = null;

    if (proposalType === 'UPDATE' && dto.ingredientId) {
      originalIngredient = await this.prisma.nguyen_lieu.findUnique({
        where: { id: BigInt(dto.ingredientId) },
        include: {
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
        },
      });

      if (originalIngredient) {
        const oldSnapshot: Record<string, any> = {
          ...this.extractNutrientsFromIngredient(originalIngredient),
          categoryId: originalIngredient.danh_muc ?? null,
          categoryName:
            originalIngredient.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc ?? null,
          loaiProtein: originalIngredient.loai_protein ?? null,
          edible: originalIngredient.edible ?? null,
        };
        oldNutrientsJson = JSON.stringify(oldSnapshot);
      }
    }

    const ingredientName = dto.ingredientName?.trim() || originalIngredient?.ten_nguyen_lieu || '';

    const nutrientsJson = JSON.stringify(dto.nutrients || {});

    const proposal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.de_xuat_nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: ingredientName,
          danh_muc: categoryId,
          loai_protein: dto.loaiProtein || null,
          edible: dto.edible != null ? Number(dto.edible) : 100,
          ghi_chu: dto.note || null,
          gia_tri_dinh_duong_json: nutrientsJson,
          gia_tri_dinh_duong_cu_json: oldNutrientsJson,
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
  async findAll({ currentUser, status }: FindAllIngredientProposalsParamsDto): Promise<any[]> {
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
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung: {
          select: { id: true, ten_dang_nhap: true },
        },
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_duyet_idTonguoi_dung: {
          select: { id: true, ten_dang_nhap: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return proposals.map((p) => ({
      id: p.id.toString(),
      ingredientId: p.nguyen_lieu_id ? Number(p.nguyen_lieu_id) : null,
      name: p.ten_nguyen_lieu,
      ingredientName: p.ten_nguyen_lieu,
      categoryName: p.danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc ?? null,
      categoryId: p.danh_muc,
      loaiProtein: p.loai_protein,
      proteinType: p.loai_protein,
      proposalType: this.normalizeProposalType(p.loai_de_xuat),
      status: p.trang_thai,
      createdAt: p.ngay_tao,
      createdBy: p.nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung?.ten_dang_nhap ?? null,
      reviewedBy:
        p.nguoi_dung_de_xuat_nguyen_lieu_nguoi_duyet_idTonguoi_dung?.ten_dang_nhap ?? null,
      reviewedAt: p.ngay_duyet ?? null,
    }));
  }

  /**
   * 3. GET /api/ingredient-proposals/:id: Chi tiết đề xuất
   */
  async findById({ id, currentUser }: FindIngredientProposalByIdParamsDto): Promise<any> {
    const proposalId = BigInt(id);
    const proposal = await this.prisma.de_xuat_nguyen_lieu.findUnique({
      where: { id: proposalId },
      include: {
        danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc: true,
        minh_chung: true,
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung: {
          select: { id: true, ten_dang_nhap: true },
        },
        nguoi_dung_de_xuat_nguyen_lieu_nguoi_duyet_idTonguoi_dung: {
          select: { id: true, ten_dang_nhap: true },
        },
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

    let nutrients: Record<string, any> = {};
    try {
      nutrients = JSON.parse(proposal.gia_tri_dinh_duong_json || '{}');
    } catch (e: any) {
      this.logger.warn(`Lỗi parse nutrients JSON: ${e?.message}`);
    }

    const normalizedType = this.normalizeProposalType(proposal.loai_de_xuat);
    const categoryName =
      proposal.danh_muc_de_xuat_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc ?? null;

    let originalIngredient: any = null;
    if (proposal.nguyen_lieu_id) {
      originalIngredient = await this.prisma.nguyen_lieu.findUnique({
        where: { id: proposal.nguyen_lieu_id },
        include: {
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
        },
      });
    }

    let oldNutrients: Record<string, any> | null = null;
    let oldCategoryId: number | null = null;
    let oldCategoryName: string | null = null;
    let oldLoaiProtein: string | null = null;
    let oldEdible: number | null = null;
    const changedFields: Record<string, { oldValue: any; newValue: any }> = {};

    if (normalizedType === 'UPDATE') {
      let parsedOldJson: Record<string, any> | null = null;
      if (proposal.gia_tri_dinh_duong_cu_json) {
        try {
          parsedOldJson = JSON.parse(proposal.gia_tri_dinh_duong_cu_json);
        } catch (e: any) {
          this.logger.warn(`Lỗi parse old nutrients JSON: ${e?.message}`);
        }
      }

      if (parsedOldJson) {
        if (parsedOldJson.categoryId !== undefined) {
          oldCategoryId = parsedOldJson.categoryId;
        }
        if (parsedOldJson.categoryName !== undefined) {
          oldCategoryName = parsedOldJson.categoryName;
        }
        if (parsedOldJson.loaiProtein !== undefined) {
          oldLoaiProtein = parsedOldJson.loaiProtein;
        }
        if (parsedOldJson.edible !== undefined) {
          oldEdible = parsedOldJson.edible !== null ? Number(parsedOldJson.edible) : null;
        }

        oldNutrients = {};
        for (const apiKey of Object.keys(API_KEY_TO_DB_COLUMN)) {
          if (parsedOldJson[apiKey] !== undefined && parsedOldJson[apiKey] !== null) {
            oldNutrients[apiKey] = Number(parsedOldJson[apiKey]);
          }
        }
      }

      if (originalIngredient) {
        if (oldCategoryId === null) {
          oldCategoryId = originalIngredient.danh_muc ?? null;
        }
        if (oldCategoryName === null) {
          oldCategoryName =
            originalIngredient.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc ?? null;
        }
        if (oldLoaiProtein === null) {
          oldLoaiProtein = originalIngredient.loai_protein ?? null;
        }
        if (oldEdible === null) {
          oldEdible =
            originalIngredient.edible !== undefined && originalIngredient.edible !== null
              ? Number(originalIngredient.edible)
              : null;
        }
        if (!oldNutrients) {
          oldNutrients = this.extractNutrientsFromIngredient(originalIngredient);
        }
      }

      // Tính changedFields giữa giá trị cũ và giá trị mới
      if (oldNutrients) {
        const allNutrientKeys = new Set([...Object.keys(oldNutrients), ...Object.keys(nutrients)]);
        for (const key of allNutrientKeys) {
          const oldVal =
            oldNutrients[key] !== undefined && oldNutrients[key] !== null
              ? Number(oldNutrients[key])
              : null;
          const newVal =
            nutrients[key] !== undefined && nutrients[key] !== null ? Number(nutrients[key]) : null;
          if (oldVal !== newVal) {
            changedFields[key] = { oldValue: oldVal, newValue: newVal };
          }
        }
      }

      if (oldCategoryId !== null && oldCategoryId !== proposal.danh_muc) {
        changedFields.categoryId = { oldValue: oldCategoryId, newValue: proposal.danh_muc };
      }
      if (oldCategoryName !== null && oldCategoryName !== categoryName) {
        changedFields.categoryName = { oldValue: oldCategoryName, newValue: categoryName };
      }
      if (oldLoaiProtein !== proposal.loai_protein) {
        changedFields.loaiProtein = {
          oldValue: oldLoaiProtein,
          newValue: proposal.loai_protein ?? null,
        };
      }
      const newEdible =
        proposal.edible !== undefined && proposal.edible !== null ? Number(proposal.edible) : null;
      if (oldEdible !== newEdible) {
        changedFields.edible = { oldValue: oldEdible, newValue: newEdible };
      }
    }

    return {
      id: proposal.id.toString(),
      name: proposal.ten_nguyen_lieu,
      ingredientName: proposal.ten_nguyen_lieu,
      categoryId: proposal.danh_muc,
      categoryName,
      proposalType: normalizedType,
      ingredientId: proposal.nguyen_lieu_id ? proposal.nguyen_lieu_id.toString() : null,
      loaiProtein: proposal.loai_protein,
      proteinType: proposal.loai_protein,
      edible: proposal.edible,
      note: proposal.ghi_chu,
      nutrients,
      oldNutrients,
      oldCategoryId,
      oldCategoryName,
      oldLoaiProtein,
      oldEdible,
      changedFields,
      status: proposal.trang_thai,
      rejectReason: proposal.ly_do_tu_choi,
      createdAt: proposal.ngay_tao,
      createdBy:
        proposal.nguoi_dung_de_xuat_nguyen_lieu_nguoi_tao_idTonguoi_dung?.ten_dang_nhap ?? null,
      reviewedBy:
        proposal.nguoi_dung_de_xuat_nguyen_lieu_nguoi_duyet_idTonguoi_dung?.ten_dang_nhap ?? null,
      reviewedAt: proposal.ngay_duyet ?? null,
      evidences: proposal.minh_chung.map((m) => ({
        id: m.id.toString(),
        objectKey: m.object_key,
        originalFileName: m.ten_file_goc,
        mimeType: m.mime_type,
        fileSize: m.dung_luong ? Number(m.dung_luong) : null,
        externalLink: m.link_ngoai,
      })),
    };
  }

  /**
   * 4. PUT /api/ingredient-proposals/:id/approve: Phê duyệt đề xuất nguyên liệu (Admin Only)
   */
  async approve({ id, currentUser }: ApproveIngredientProposalParamsDto): Promise<any> {
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
    } catch (e: any) {
      this.logger.warn(`Lỗi parse nutrients JSON: ${e?.message}`);
    }

    const isUpdate = this.normalizeProposalType(proposal.loai_de_xuat) === 'UPDATE';
    const mappedNutrientsForUpdate = this.mapNutrientsToDbColumns(nutrients, true);
    const mappedNutrientsForCreate = this.mapNutrientsToDbColumns(nutrients, false);

    const result = await this.prisma.$transaction(async (tx) => {
      let finalIng: any;
      if (isUpdate && proposal.nguyen_lieu_id) {
        finalIng = await tx.nguyen_lieu.update({
          where: { id: proposal.nguyen_lieu_id },
          data: {
            danh_muc: proposal.danh_muc,
            loai_protein: proposal.loai_protein || 'THUC_VAT',
            edible: proposal.edible != null ? Number(proposal.edible) : 100,
            ...mappedNutrientsForUpdate,
            trang_thai: 'DA_DUYET',
          },
        });
      } else {
        const existingByName = await tx.nguyen_lieu.findFirst({
          where: { ten_nguyen_lieu: proposal.ten_nguyen_lieu },
        });

        if (existingByName) {
          finalIng = await tx.nguyen_lieu.update({
            where: { id: existingByName.id },
            data: {
              danh_muc: proposal.danh_muc,
              loai_protein: proposal.loai_protein || 'THUC_VAT',
              edible: proposal.edible != null ? Number(proposal.edible) : 100,
              ...mappedNutrientsForUpdate,
              trang_thai: 'DA_DUYET',
              deleted_at: null,
            },
          });
        } else {
          finalIng = await tx.nguyen_lieu.create({
            data: {
              ten_nguyen_lieu: proposal.ten_nguyen_lieu,
              danh_muc: proposal.danh_muc,
              loai_protein: proposal.loai_protein || 'THUC_VAT',
              edible: proposal.edible != null ? Number(proposal.edible) : 100,
              ...mappedNutrientsForCreate,
              trang_thai: 'DA_DUYET',
              tao_boi_id: proposal.nguoi_tao_id,
            },
          });
        }
      }

      // 2. Cập nhật trạng thái đề xuất và gán nguyen_lieu_id
      await tx.de_xuat_nguyen_lieu.update({
        where: { id: proposalId },
        data: {
          trang_thai: 'DA_DUYET',
          nguyen_lieu_id: finalIng.id,
          nguoi_duyet_id: currentUser.id,
          ngay_duyet: new Date(),
        },
      });

      return finalIng;
    });

    if (this.cacheService) {
      if (typeof this.cacheService.debouncedInvalidateTags === 'function') {
        await this.cacheService.debouncedInvalidateTags([
          CACHE_TAG_INGREDIENTS,
          CACHE_TAG_DISHES,
          buildIngredientCacheTag(result.id),
        ]);
      } else {
        await this.cacheService.invalidateTag(CACHE_TAG_INGREDIENTS);
        await this.cacheService.invalidateTag(CACHE_TAG_DISHES);
      }
    }

    return {
      success: true,
      message: 'Phê duyệt đề xuất nguyên liệu thành công',
      ingredientId: result.id.toString(),
    };
  }

  /**
   * 5. PUT /api/ingredient-proposals/:id/reject: Từ chối đề xuất nguyên liệu (Admin Only)
   */
  async reject({ id, reason, currentUser }: RejectIngredientProposalParamsDto): Promise<any> {
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
