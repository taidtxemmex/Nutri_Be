import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UserRole } from '../../../config/enums/role.enum';
import { NutritionEngine, Decimal } from '../../../core/nutrition-engine/nutrition.engine';
import { BASE_NUTRIENT_CODES } from '../../../core/nutrition-engine/nutrition.constants';
import { NutritionCalculatorService } from '../../../core/nutrition-engine/nutrition-calculator.service';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  IngredientQueryDto,
  IngredientSummaryDto,
  IngredientListItemDto,
  IngredientDetailDto,
  CalculateSummaryDto,
  CalculateSummaryResponseDto,
  CalculateSummaryItemResultDto,
} from '../dto';

export function normalizeVietnameseNFC(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').trim();
}

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionCalculator: NutritionCalculatorService = new NutritionCalculatorService(),
  ) {}

  /**
   * Kiểm tra trùng tên nguyên liệu có tính đến Collation & Unicode Normalization NFC
   * Bảo toàn phân biệt dấu tiếng Việt chính xác ("Dứa" vs "Dừa")
   */
  async existsByMaterial(material: string, excludeId?: bigint | number | string): Promise<boolean> {
    const normalizedName = normalizeVietnameseNFC(material);
    if (!normalizedName) return false;

    // Lấy các bản ghi tiềm năng có tên tương tự từ MySQL
    const candidates = await this.prisma.nguyen_lieu.findMany({
      where: {
        ten_nguyen_lieu: { contains: normalizedName },
        deleted_at: null,
      },
      select: { id: true, ten_nguyen_lieu: true },
    });

    const targetLower = normalizedName.toLowerCase();
    const excludeBigInt = excludeId !== undefined && excludeId !== null ? BigInt(excludeId) : null;

    return candidates.some((c) => {
      if (excludeBigInt !== null && c.id === excludeBigInt) {
        return false;
      }
      return normalizeVietnameseNFC(c.ten_nguyen_lieu).toLowerCase() === targetLower;
    });
  }

  /**
   * Bounded Paginated Query với Lean Query Projection (Rule 11)
   * TUYỆT ĐỐI KHÔNG nạp 77 cột vi chất trong list queries để chống tràn RAM (Anti-OOM)
   */
  async findAll(query: IngredientQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(100, query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: any = { deleted_at: null };

    const keyword = query.keyword || query.search;
    if (keyword && keyword.trim()) {
      where.ten_nguyen_lieu = { contains: keyword.trim() };
    }

    if (query.categoryId) {
      where.danh_muc = query.categoryId;
    }

    if (query.loaiProtein) {
      where.loai_protein = query.loaiProtein;
    }

    if (query.trangThai) {
      where.trang_thai = query.trangThai;
    }

    const sortField = query.sortBy || 'id';
    const sortOrder = (query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Lean Query Projection: Chỉ select các trường hiển thị cơ bản
    const [items, total] = await Promise.all([
      this.prisma.nguyen_lieu.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrder },
        select: {
          id: true,
          ten_nguyen_lieu: true,
          danh_muc: true,
          loai_protein: true,
          trang_thai: true,
          edible: true,
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: {
            select: { id: true, ten_danh_muc: true },
          },
        },
      }),
      this.prisma.nguyen_lieu.count({ where }),
    ]);

    const mappedItems: IngredientListItemDto[] = items.map((i) => ({
      id: i.id.toString(),
      ten_nguyen_lieu: i.ten_nguyen_lieu,
      material: i.ten_nguyen_lieu,
      name: i.ten_nguyen_lieu,
      danh_muc: i.danh_muc,
      categoryId: i.danh_muc,
      categoryName: i.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || null,
      loai_protein: i.loai_protein,
      loaiProtein: i.loai_protein,
      trang_thai: i.trang_thai,
      trangThai: i.trang_thai,
      edible: i.edible,
    }));

    return {
      items: mappedItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Tối ưu siêu tốc SELECT id, ten_nguyen_lieu (0 ms) cho dropdown / combobox
   */
  async findSummary(): Promise<IngredientSummaryDto[]> {
    const rows = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null, trang_thai: 'DA_DUYET' },
      select: { id: true, ten_nguyen_lieu: true },
      orderBy: { ten_nguyen_lieu: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id.toString(),
      ten_nguyen_lieu: r.ten_nguyen_lieu,
      material: r.ten_nguyen_lieu,
    }));
  }

  /**
   * Lấy toàn bộ nguyên liệu đã duyệt (Phục vụ NutriFE FoodTable in-memory cache)
   */
  async findAllUnpaginated(): Promise<IngredientDetailDto[]> {
    const items = await this.prisma.nguyen_lieu.findMany({
      where: { deleted_at: null, trang_thai: 'DA_DUYET' },
      orderBy: { ten_nguyen_lieu: 'asc' },
      include: {
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
      },
    });

    return items.map((item) => this.mapToDetailDto(item));
  }

  /**
   * Tính toán dinh dưỡng động danh sách các thành phần nguyên liệu
   * Nạp toàn bộ nguyên liệu qua 1 query duy nhất findMany({ where: { id: { in: ids } } })
   * Tích lũy 86 vi chất chính xác tuyệt đối qua Decimal.js
   * Tính tổng khối lượng sống (Gross), khối lượng ăn được (Edible/Net) và khối lượng chín (Cooked)
   */
  async calculateSummary(dto: CalculateSummaryDto): Promise<CalculateSummaryResponseDto> {
    if (!dto || !dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new HttpException(
        {
          code: 'VALIDATION_FAILED',
          message: 'Danh sách nguyên liệu (items) không được để trống',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Trích xuất và validate sơ bộ danh sách IDs & weights
    const rawIds: bigint[] = [];
    for (let idx = 0; idx < dto.items.length; idx++) {
      const item = dto.items[idx];
      const rawId = item.ingredientId ?? item.id;
      if (rawId === undefined || rawId === null) {
        throw new HttpException(
          {
            code: 'VALIDATION_FAILED',
            message: `Nguyên liệu tại vị trí ${idx + 1} thiếu ingredientId hoặc id`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const weightVal = item.weight ?? item.weightGrams;
      if (weightVal === undefined || weightVal === null || Number(weightVal) <= 0) {
        throw new HttpException(
          {
            code: 'VALIDATION_FAILED',
            message: `Khối lượng của nguyên liệu ID ${rawId} phải lớn hơn 0`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      rawIds.push(BigInt(rawId));
    }

    const uniqueIds = Array.from(new Set(rawIds));

    // 2. Query duy nhất nạp toàn bộ nguyên liệu từ DB
    const ingredients = await this.prisma.nguyen_lieu.findMany({
      where: {
        id: { in: uniqueIds },
        deleted_at: null,
      },
    });

    const ingredientMap = new Map<string, any>();
    for (const ing of ingredients) {
      ingredientMap.set(ing.id.toString(), ing);
    }

    // Kiểm tra xem có ID nào không tìm thấy trong DB không
    for (const rawId of rawIds) {
      if (!ingredientMap.has(rawId.toString())) {
        throw new HttpException(
          {
            code: 'PROP_006',
            message: `Không tìm thấy nguyên liệu có ID ${rawId.toString()}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 3. Tích lũy dinh dưỡng và khối lượng bằng Decimal.js
    const accumulatedNutrients = NutritionEngine.createEmptyDecimalMap();
    let totalGrossWeight = NutritionEngine.ZERO;
    let totalEdibleWeight = NutritionEngine.ZERO;
    let totalCookedWeight = NutritionEngine.ZERO;

    const itemResults: CalculateSummaryItemResultDto[] = [];

    for (const item of dto.items) {
      const id = (item.ingredientId ?? item.id)!.toString();
      const ingredient = ingredientMap.get(id)!;
      const inputWeight = Number(item.weight ?? item.weightGrams);
      const isNetWeight = item.isNetWeight !== undefined ? Boolean(item.isNetWeight) : true;
      const coefficient =
        item.coefficient !== undefined && item.coefficient !== null ? Number(item.coefficient) : 1;

      const edibleRateVal =
        ingredient.edible !== undefined && ingredient.edible !== null
          ? NutritionEngine.toDecimal(ingredient.edible, 100)
          : NutritionEngine.ONE_HUNDRED;

      const clampedEdibleRate = Decimal.max(
        NutritionEngine.ZERO,
        Decimal.min(NutritionEngine.ONE_HUNDRED, edibleRateVal),
      );
      const edibleRatio = clampedEdibleRate.dividedBy(NutritionEngine.ONE_HUNDRED);

      let grossWeightDec: Decimal;
      let edibleWeightDec: Decimal;

      if (isNetWeight) {
        // Khối lượng nhập là phần ăn được
        edibleWeightDec = NutritionEngine.toDecimal(inputWeight, 0);
        grossWeightDec = edibleRatio.isPositive()
          ? edibleWeightDec.dividedBy(edibleRatio)
          : edibleWeightDec;
      } else {
        // Khối lượng nhập là cả vỏ/xương thô
        grossWeightDec = NutritionEngine.toDecimal(inputWeight, 0);
        edibleWeightDec = grossWeightDec.times(edibleRatio);
      }

      const coeffDec = NutritionEngine.toDecimal(coefficient, 1);
      const cookedWeightDec = edibleWeightDec.times(coeffDec);

      // Tính toán vi chất dinh dưỡng của từng thành phần
      const detailed = NutritionEngine.calculateIngredientNutrients(ingredient, inputWeight, {
        isNetWeight,
        preserveDecimals: true,
      });

      // Tích lũy vào tổng chung
      totalGrossWeight = totalGrossWeight.plus(grossWeightDec);
      totalEdibleWeight = totalEdibleWeight.plus(edibleWeightDec);
      totalCookedWeight = totalCookedWeight.plus(cookedWeightDec);
      NutritionEngine.accumulateNutrients(accumulatedNutrients, detailed.nutrients);

      itemResults.push({
        ingredientId: Number(ingredient.id),
        name: ingredient.ten_nguyen_lieu,
        ten_nguyen_lieu: ingredient.ten_nguyen_lieu,
        grossWeight: grossWeightDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        edibleWeight: edibleWeightDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        cookedWeight: cookedWeightDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        coefficient: coeffDec.toNumber(),
        isNetWeight,
        nutrients: NutritionEngine.roundDecimalMap(detailed.nutrients, 2),
      });
    }

    return {
      totalGrossWeight: totalGrossWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      totalEdibleWeight: totalEdibleWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      totalCookedWeight: totalCookedWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      nutrients: NutritionEngine.roundDecimalMap(accumulatedNutrients, 2),
      items: itemResults,
    };
  }

  /**
   * Chi tiết nguyên liệu: Nạp đầy đủ 86 chỉ tiêu dinh dưỡng và các chỉ số tự tính
   */
  async findById(id: bigint | number | string): Promise<IngredientDetailDto> {
    const item = await this.prisma.nguyen_lieu.findFirst({
      where: {
        id: BigInt(id),
        deleted_at: null,
      },
      include: {
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
      },
    });

    if (!item) {
      throw new HttpException(
        { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapToDetailDto(item);
  }

  /**
   * Tạo nguyên liệu mới
   * Phân nhánh Role: USER/USERPRO -> CHO_DUYET; ADMIN/SUPERADMIN -> DA_DUYET
   */
  async create(
    dto: CreateIngredientDto,
    currentUser?: { id?: string; role?: string },
  ): Promise<IngredientDetailDto> {
    const material = normalizeVietnameseNFC(dto.material || dto.name || '');
    if (!material) {
      throw new HttpException(
        { code: 'BAD_REQUEST', message: 'Tên nguyên liệu không được để trống' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Kiểm tra danh mục nếu có
    if (dto.categoryId) {
      const category = await this.prisma.danh_muc.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new HttpException(
          { code: 'PROP_007', message: 'Không tìm thấy danh mục' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Bắt trùng tên
    const isDuplicate = await this.existsByMaterial(material);
    if (isDuplicate) {
      throw new HttpException(
        { code: 'PROP_014', message: 'Tên nguyên liệu đã tồn tại trong hệ thống' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Phân quyền trạng thái
    const role = currentUser?.role;
    const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
    const trangThai = isAdmin ? 'DA_DUYET' : 'CHO_DUYET';

    const nutrientData = this.extractNutrientFields(dto);

    const created = await this.prisma.nguyen_lieu.create({
      data: {
        ten_nguyen_lieu: material,
        danh_muc: dto.categoryId || null,
        loai_protein: dto.loaiProtein || null,
        trang_thai: trangThai,
        tao_boi_id: currentUser?.id || null,
        edible: dto.edible !== undefined && dto.edible !== null ? Number(dto.edible) : null,
        ...nutrientData,
      },
      include: {
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
      },
    });

    return this.mapToDetailDto(created);
  }

  /**
   * Cập nhật nguyên liệu
   * Chỉ cho phép sửa khi trang_thai == DA_DUYET (nếu không ném ING_001 - 400)
   * Nếu là USER -> tạo bản ghi mới chờ duyệt; nếu là ADMIN -> cập nhật trực tiếp
   */
  async update(
    id: bigint | number | string,
    dto: UpdateIngredientDto,
    currentUser?: { id?: string; role?: string },
  ): Promise<IngredientDetailDto> {
    const existing = await this.prisma.nguyen_lieu.findFirst({
      where: {
        id: BigInt(id),
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Chỉ cho phép sửa khi trang_thai == DA_DUYET
    if (existing.trang_thai !== 'DA_DUYET') {
      throw new HttpException(
        {
          code: 'ING_001',
          message: 'Chỉ có thể cập nhật nguyên liệu đã được duyệt',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Kiểm tra danh mục nếu có
    if (dto.categoryId) {
      const category = await this.prisma.danh_muc.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new HttpException(
          { code: 'PROP_007', message: 'Không tìm thấy danh mục' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const role = currentUser?.role;
    const isUser =
      role === UserRole.USER || role === UserRole.USERPRO || role === UserRole.BENH_NHAN || !role;

    const nutrientData = this.extractNutrientFields(dto);
    const newMaterial =
      dto.material || dto.name ? normalizeVietnameseNFC(dto.material || dto.name || '') : null;

    // 1. Phân nhánh USER: Tạo bản ghi mới chờ duyệt (CHO_DUYET)
    if (isUser) {
      const pendingData: any = {};
      for (const field of BASE_NUTRIENT_CODES) {
        pendingData[field] =
          dto[field as keyof UpdateIngredientDto] !== undefined
            ? dto[field as keyof UpdateIngredientDto] !== null
              ? Number(dto[field as keyof UpdateIngredientDto])
              : null
            : (existing as any)[field];
      }

      const pending = await this.prisma.nguyen_lieu.create({
        data: {
          ten_nguyen_lieu: newMaterial || existing.ten_nguyen_lieu,
          danh_muc: dto.categoryId !== undefined ? dto.categoryId : existing.danh_muc,
          loai_protein: dto.loaiProtein !== undefined ? dto.loaiProtein : existing.loai_protein,
          trang_thai: 'CHO_DUYET',
          tao_boi_id: currentUser?.id || null,
          edible:
            dto.edible !== undefined && dto.edible !== null ? Number(dto.edible) : existing.edible,
          ...pendingData,
        },
        include: {
          danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
        },
      });

      return this.mapToDetailDto(pending);
    }

    // 2. Phân nhánh ADMIN / SUPERADMIN: Cập nhật trực tiếp
    if (
      newMaterial &&
      newMaterial.toLowerCase() !== normalizeVietnameseNFC(existing.ten_nguyen_lieu).toLowerCase()
    ) {
      const isDuplicate = await this.existsByMaterial(newMaterial, existing.id);
      if (isDuplicate) {
        throw new HttpException(
          { code: 'PROP_014', message: 'Tên nguyên liệu đã tồn tại trong hệ thống' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updateData: any = {
      ...nutrientData,
      trang_thai: 'DA_DUYET',
    };

    if (newMaterial) updateData.ten_nguyen_lieu = newMaterial;
    if (dto.categoryId !== undefined) updateData.danh_muc = dto.categoryId;
    if (dto.loaiProtein !== undefined) updateData.loai_protein = dto.loaiProtein;
    if (dto.edible !== undefined) {
      updateData.edible = dto.edible !== null ? Number(dto.edible) : null;
    }

    const updated = await this.prisma.nguyen_lieu.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        danh_muc_nguyen_lieu_danh_mucTodanh_muc: true,
      },
    });

    return this.mapToDetailDto(updated);
  }

  /**
   * Proactive Delete Guard:
   * Kiểm tra _count trên chi_tiet_mon_an (món ăn chưa xóa mon_an.deleted_at: null),
   * khau_phan_24h_nguyen_lieu, he_so_song_chin. Nếu > 0 ném ING_002 (409)
   * Hỗ trợ soft-delete (deleted_at)
   */
  async delete(id: bigint | number | string): Promise<{ message: string }> {
    const existing = await this.prisma.nguyen_lieu.findFirst({
      where: {
        id: BigInt(id),
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 1. Kiểm tra trong chi tiết món ăn (của món ăn chưa bị xóa)
    const dishUsageCount = await this.prisma.chi_tiet_mon_an.count({
      where: {
        nguyen_lieu_id: BigInt(id),
        mon_an: {
          deleted_at: null,
        },
      },
    });

    // 2. Kiểm tra trong khẩu phần 24h
    const intakeUsageCount = await this.prisma.khau_phan_24h_nguyen_lieu.count({
      where: {
        nguyen_lieu_id: BigInt(id),
      },
    });

    // 3. Kiểm tra trong hệ số sống chín
    const coeffUsageCount = await this.prisma.he_so_song_chin.count({
      where: {
        nguyen_lieu_id: BigInt(id),
      },
    });

    if (dishUsageCount > 0 || intakeUsageCount > 0 || coeffUsageCount > 0) {
      throw new HttpException(
        {
          code: 'ING_002',
          message:
            'Không thể xóa nguyên liệu này vì đã được sử dụng trong món ăn, khẩu phần 24h hoặc hệ số sống chín',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Thực hiện Soft-Delete an toàn
    await this.prisma.nguyen_lieu.update({
      where: { id: BigInt(id) },
      data: { deleted_at: new Date() },
    });

    return { message: `Đã xóa nguyên liệu thành công (ID: ${id})` };
  }

  /**
   * Phê duyệt nguyên liệu đề xuất (Admin)
   */
  async approve(pendingId: bigint | number | string): Promise<IngredientDetailDto> {
    const pending = await this.prisma.nguyen_lieu.findFirst({
      where: { id: BigInt(pendingId), deleted_at: null },
    });

    if (!pending) {
      throw new HttpException(
        { code: 'PROP_006', message: 'Không tìm thấy nguyên liệu' },
        HttpStatus.NOT_FOUND,
      );
    }

    const approved = await this.prisma.nguyen_lieu.update({
      where: { id: BigInt(pendingId) },
      data: { trang_thai: 'DA_DUYET' },
      include: { danh_muc_nguyen_lieu_danh_mucTodanh_muc: true },
    });

    return this.mapToDetailDto(approved);
  }

  /**
   * Trích xuất các trường vi chất từ DTO để đưa vào Prisma data
   */
  private extractNutrientFields(dto: any): Record<string, number | null> {
    const nutrientData: Record<string, number | null> = {};
    for (const field of BASE_NUTRIENT_CODES) {
      if (dto[field] !== undefined) {
        nutrientData[field] = dto[field] !== null ? Number(dto[field]) : null;
      }
    }
    return nutrientData;
  }

  /**
   * Chuyển đổi Entity sang Detail DTO đầy đủ 86 chỉ tiêu (Bao gồm các chỉ số tự tính toán bằng NutritionEngine)
   */
  public mapToDetailDto(item: any): IngredientDetailDto {
    const carbDecimal = NutritionEngine.calculateCarbohydrate(
      item.water,
      item.protein,
      item.fat,
      item.ash,
      item.fiber,
    );
    const energyDecimal = NutritionEngine.calculateEnergy(item.protein, item.fat, carbDecimal);
    const vitARaeDecimal = NutritionEngine.calculateVitaminARae(
      item.retinol,
      item.betaCarotene,
      item.alphaCarotene,
      item.betaCryptoxanthin,
    );

    const dto: IngredientDetailDto = {
      id: item.id.toString(),
      ten_nguyen_lieu: item.ten_nguyen_lieu,
      material: item.ten_nguyen_lieu,
      name: item.ten_nguyen_lieu,
      danh_muc: item.danh_muc,
      categoryId: item.danh_muc,
      categoryName: item.danh_muc_nguyen_lieu_danh_mucTodanh_muc?.ten_danh_muc || null,
      loai_protein: item.loai_protein,
      loaiProtein: item.loai_protein,
      trang_thai: item.trang_thai,
      trangThai: item.trang_thai,
      edible: item.edible,

      // Calculated values
      carbohydrate: Number(carbDecimal.toFixed(2)),
      energy: Number(energyDecimal.toFixed(2)),
      vitaminARae: Number(vitARaeDecimal.toFixed(2)),
    };

    // Gán 77 chỉ tiêu cơ sở
    for (const field of BASE_NUTRIENT_CODES) {
      (dto as any)[field] =
        item[field] !== undefined && item[field] !== null ? Number(item[field]) : null;
    }

    return dto;
  }
}
