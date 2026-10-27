import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NutritionCalculatorService } from '../../../core/nutrition-engine';
import { NutritionEngine } from '../../../core/nutrition-engine/nutrition.engine';
import {
  CreateDailyIntakeDto,
  UpdateDailyIntakeDto,
  DailyIntakeQueryDto,
  DailyIntakeResponseDto,
  DailyIntakeListDto,
  DailyIntakeMealResponseDto,
  DailyIntakeIngredientResponseDto,
} from '../dto';
import { RdaComparisonEngine, RdaComparisonResult } from '../engines/rda-comparison.engine';
import { DemographicProfile } from '../engines/rda-reference-data';
import { UserRole } from '../../../config/enums/role.enum';
import { Gender, IntakeInputType } from '../../../config/enums/domain.enum';

@Injectable()
export class DailyIntakesService {
  private readonly logger = new Logger(DailyIntakesService.name);
  private readonly CACHE_TAG = 'daily-intakes';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly nutritionCalculator: NutritionCalculatorService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  /**
   * Helper tính tuổi từ ngày sinh
   */
  private calculateAge(dateOfBirth?: Date | null, onlyBirthYear?: boolean): number {
    if (!dateOfBirth) return 30; // Mặc định người trưởng thành 30 tuổi
    const now = new Date();
    const birth = new Date(dateOfBirth);

    if (onlyBirthYear) {
      return now.getFullYear() - birth.getFullYear();
    }

    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }

  /**
   * Helper ánh xạ entity Khẩu phần 24h sang Response DTO và tính toán toàn bộ dinh dưỡng 86 vi chất
   */
  private mapIntakeEntityToResponse(intake: any): DailyIntakeResponseDto {
    const mealResponses: DailyIntakeMealResponseDto[] = [];
    const totalDayAccumulated = NutritionEngine.createEmptyDecimalMap();

    for (const meal of intake.khau_phan_24h_bua_an || []) {
      const ingredientResponses: DailyIntakeIngredientResponseDto[] = [];
      const mealAccumulated = NutritionEngine.createEmptyDecimalMap();

      for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
        const rawIngredient = item.nguyen_lieu;
        const weightVal = Number(item.khoi_luong_song_sach) || 0;

        let itemNutrients: Record<string, number> = {};
        if (rawIngredient) {
          const ingCalc = NutritionEngine.calculateIngredientNutrients(rawIngredient, weightVal, {
            isNetWeight: false, // Áp dụng tỷ lệ ăn được (edible) chính xác cho cân thô
            preserveDecimals: true,
          });

          NutritionEngine.accumulateNutrients(mealAccumulated, ingCalc.nutrients);
          itemNutrients = NutritionEngine.roundDecimalMap(ingCalc.nutrients, 2);
        }

        ingredientResponses.push({
          id: item.id.toString(),
          ingredientId: item.nguyen_lieu_id.toString(),
          ingredientName: rawIngredient?.ten_nguyen_lieu || '',
          rawWeight: weightVal,
          edible: rawIngredient?.edible != null ? Number(rawIngredient.edible) : null,
          nutrients: itemNutrients,
        });
      }

      NutritionEngine.accumulateNutrients(totalDayAccumulated, mealAccumulated);

      mealResponses.push({
        id: meal.id.toString(),
        mealOrder: meal.thu_tu_bua,
        mealName: meal.ten_bua || null,
        mealTime: meal.gio_an || null,
        ingredients: ingredientResponses,
        totalMealNutrients: NutritionEngine.roundDecimalMap(mealAccumulated, 2),
      });
    }

    return {
      id: intake.id.toString(),
      patientId: intake.benh_nhan_id.toString(),
      patientName: intake.benh_nhan?.ho_ten || null,
      intakeDate:
        intake.ngay_an instanceof Date
          ? intake.ngay_an.toISOString().slice(0, 10)
          : String(intake.ngay_an),
      inputType: intake.kieu_nhap,
      note: intake.ghi_chu || null,
      meals: mealResponses,
      totalDayNutrients: NutritionEngine.roundDecimalMap(totalDayAccumulated, 2),
    };
  }

  /**
   * 1. POST /api/daily-intakes: Tạo mới ghi nhận khẩu phần 24h
   */
  async create(
    dto: CreateDailyIntakeDto,
    currentUser: { id: string; role?: string },
  ): Promise<DailyIntakeResponseDto> {
    const patientId = BigInt(dto.patientId);

    // 1. Kiểm tra bệnh nhân thuộc user
    const patient = await this.prisma.benh_nhan.findFirst({
      where: { id: patientId, deleted_at: null },
      select: { id: true, nguoi_dung_id: true },
    });

    if (!patient) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (patient.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Chặn trùng ngày ăn cho cùng bệnh nhân (UKmscxxi0es7bbg73tw1iwb2lnt)
    const intakeDate = new Date(dto.intakeDate);
    const existing = await this.prisma.khau_phan_24h.findFirst({
      where: {
        benh_nhan_id: patientId,
        ngay_an: intakeDate,
      },
      select: { id: true },
    });

    if (existing) {
      throw new HttpException(
        {
          code: 'DAILY_INTAKE_DUPLICATE',
          message: 'Bệnh nhân đã có bản ghi khẩu phần 24h vào ngày này',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 3. Tạo khẩu phần 24h trong 1 Transaction nguyên tử
    const created = await this.prisma.$transaction(
      async (tx) => {
        const intake = await tx.khau_phan_24h.create({
          data: {
            benh_nhan_id: patientId,
            nguoi_dung_id: currentUser.id,
            ngay_an: intakeDate,
            kieu_nhap: dto.inputType,
            ghi_chu: dto.note || null,
            tao_luc: new Date(),
          },
        });

        for (const mealDto of dto.meals || []) {
          const meal = await tx.khau_phan_24h_bua_an.create({
            data: {
              khau_phan_24h_id: intake.id,
              thu_tu_bua: mealDto.mealOrder,
              ten_bua: mealDto.mealName || null,
              gio_an: mealDto.mealTime || null,
            },
          });

          for (const ingDto of mealDto.ingredients || []) {
            await tx.khau_phan_24h_nguyen_lieu.create({
              data: {
                khau_phan_24h_bua_an_id: meal.id,
                nguyen_lieu_id: BigInt(ingDto.ingredientId),
                khoi_luong_song_sach: ingDto.rawWeight,
              },
            });
          }
        }

        return intake;
      },
      { timeout: 15000 },
    );

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return this.getById(created.id, currentUser);
  }

  /**
   * 2. GET /api/daily-intakes: Danh sách khẩu phần theo bệnh nhân/ngày, phân trang
   */
  async getAll(
    query: DailyIntakeQueryDto,
    currentUser: { id: string; role?: string },
  ): Promise<{ items: DailyIntakeListDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!this.isAdmin(currentUser)) {
      where.benh_nhan = { nguoi_dung_id: currentUser.id, deleted_at: null };
    }

    if (query.patientId) {
      where.benh_nhan_id = BigInt(query.patientId);
    }

    if (query.date) {
      where.ngay_an = new Date(query.date);
    } else if (query.fromDate || query.toDate) {
      where.ngay_an = {};
      if (query.fromDate) where.ngay_an.gte = new Date(query.fromDate);
      if (query.toDate) where.ngay_an.lte = new Date(query.toDate);
    }

    const [total, rows] = await Promise.all([
      this.prisma.khau_phan_24h.count({ where }),
      this.prisma.khau_phan_24h.findMany({
        where,
        select: {
          id: true,
          benh_nhan_id: true,
          ngay_an: true,
          kieu_nhap: true,
          ghi_chu: true,
          tao_luc: true,
          benh_nhan: {
            select: { ho_ten: true },
          },
          khau_phan_24h_bua_an: {
            select: {
              khau_phan_24h_nguyen_lieu: {
                select: {
                  khoi_luong_song_sach: true,
                  nguyen_lieu: {
                    select: {
                      edible: true,
                      water: true,
                      protein: true,
                      fat: true,
                      fiber: true,
                      ash: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { ngay_an: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: DailyIntakeListDto[] = rows.map((r) => {
      // Ước lượng nhanh tổng năng lượng cho list endpoint (tính đúng edible)
      let totalEnergy = 0;
      for (const meal of r.khau_phan_24h_bua_an || []) {
        for (const item of meal.khau_phan_24h_nguyen_lieu || []) {
          const w = item.khoi_luong_song_sach || 0;
          if (item.nguyen_lieu) {
            const edibleRatio =
              item.nguyen_lieu.edible != null ? Number(item.nguyen_lieu.edible) / 100 : 1;
            const netWeight = w * Math.max(0, Math.min(1, edibleRatio));
            const p = item.nguyen_lieu.protein || 0;
            const f = item.nguyen_lieu.fat || 0;
            const water = item.nguyen_lieu.water || 0;
            const fiber = item.nguyen_lieu.fiber || 0;
            const ash = item.nguyen_lieu.ash || 0;
            const carb = Math.max(0, 100 - water - p - f - fiber - ash);
            const energyPer100g = 4 * p + 9 * f + 4 * carb;
            totalEnergy += (netWeight * energyPer100g) / 100;
          }
        }
      }

      return {
        id: r.id.toString(),
        patientId: r.benh_nhan_id.toString(),
        patientName: r.benh_nhan?.ho_ten || null,
        intakeDate:
          r.ngay_an instanceof Date ? r.ngay_an.toISOString().slice(0, 10) : String(r.ngay_an),
        inputType: r.kieu_nhap,
        note: r.ghi_chu || null,
        totalEnergyKcal: Math.round(totalEnergy),
        createdAt: r.tao_luc,
      };
    });

    return { items, total, page, limit };
  }

  /**
   * 3. GET /api/daily-intakes/:id: Chi tiết khẩu phần kèm dinh dưỡng tính toán theo chuẩn Bộ Y Tế
   */
  async getById(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<DailyIntakeResponseDto> {
    const intakeId = BigInt(id);
    const intake = await this.prisma.khau_phan_24h.findUnique({
      where: { id: intakeId },
      include: {
        benh_nhan: true,
        khau_phan_24h_bua_an: {
          orderBy: { thu_tu_bua: 'asc' },
          include: {
            khau_phan_24h_nguyen_lieu: {
              include: {
                nguyen_lieu: true,
              },
            },
          },
        },
      },
    });

    if (!intake) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (intake.benh_nhan.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapIntakeEntityToResponse(intake);
  }

  /**
   * 4. PUT /api/daily-intakes/:id: Cập nhật khẩu phần
   */
  async update(
    id: string | number | bigint,
    dto: UpdateDailyIntakeDto,
    currentUser: { id: string; role?: string },
  ): Promise<DailyIntakeResponseDto> {
    const intakeId = BigInt(id);
    const intake = await this.prisma.khau_phan_24h.findUnique({
      where: { id: intakeId },
      include: { benh_nhan: { select: { nguoi_dung_id: true } } },
    });

    if (!intake) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (intake.benh_nhan.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.khau_phan_24h.update({
          where: { id: intakeId },
          data: {
            ghi_chu: dto.note !== undefined ? dto.note : intake.ghi_chu,
            kieu_nhap: dto.inputType !== undefined ? dto.inputType : intake.kieu_nhap,
          },
        });

        if (dto.meals) {
          // Xóa các chi tiết cũ
          const oldMeals = await tx.khau_phan_24h_bua_an.findMany({
            where: { khau_phan_24h_id: intakeId },
            select: { id: true },
          });

          const oldMealIds = oldMeals.map((m) => m.id);
          if (oldMealIds.length > 0) {
            await tx.khau_phan_24h_nguyen_lieu.deleteMany({
              where: { khau_phan_24h_bua_an_id: { in: oldMealIds } },
            });
            await tx.khau_phan_24h_bua_an.deleteMany({
              where: { khau_phan_24h_id: intakeId },
            });
          }

          // Tạo các bữa ăn mới
          for (const mealDto of dto.meals) {
            const createdMeal = await tx.khau_phan_24h_bua_an.create({
              data: {
                khau_phan_24h_id: intakeId,
                thu_tu_bua: mealDto.mealOrder,
                ten_bua: mealDto.mealName || null,
                gio_an: mealDto.mealTime || null,
              },
            });

            for (const ingDto of mealDto.ingredients || []) {
              await tx.khau_phan_24h_nguyen_lieu.create({
                data: {
                  khau_phan_24h_bua_an_id: createdMeal.id,
                  nguyen_lieu_id: BigInt(ingDto.ingredientId),
                  khoi_luong_song_sach: ingDto.rawWeight,
                },
              });
            }
          }
        }
      },
      { timeout: 15000 },
    );

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return this.getById(intakeId, currentUser);
  }

  /**
   * 5. DELETE /api/daily-intakes/:id: Xóa khẩu phần
   */
  async delete(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
    const intakeId = BigInt(id);
    const intake = await this.prisma.khau_phan_24h.findUnique({
      where: { id: intakeId },
      include: { benh_nhan: { select: { nguoi_dung_id: true } } },
    });

    if (!intake) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (intake.benh_nhan.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'DAILY_INTAKE_NOT_FOUND', message: 'Không tìm thấy khẩu phần 24h' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const meals = await tx.khau_phan_24h_bua_an.findMany({
        where: { khau_phan_24h_id: intakeId },
        select: { id: true },
      });

      const mealIds = meals.map((m) => m.id);
      if (mealIds.length > 0) {
        await tx.khau_phan_24h_nguyen_lieu.deleteMany({
          where: { khau_phan_24h_bua_an_id: { in: mealIds } },
        });
        await tx.khau_phan_24h_bua_an.deleteMany({
          where: { khau_phan_24h_id: intakeId },
        });
      }

      await tx.khau_phan_24h.delete({
        where: { id: intakeId },
      });
    });

    await this.cacheService.invalidateTag(this.CACHE_TAG);
    return { success: true, message: 'Xóa khẩu phần 24h thành công' };
  }

  /**
   * 6. GET /api/daily-intakes/patient/:patientId: Lịch sử khẩu phần của bệnh nhân
   */
  async getByPatient(
    patientIdParam: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<DailyIntakeListDto[]> {
    const patientId = BigInt(patientIdParam);

    const patient = await this.prisma.benh_nhan.findFirst({
      where: { id: patientId, deleted_at: null },
      select: { id: true, nguoi_dung_id: true, ho_ten: true },
    });

    if (!patient) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (patient.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    const intakes = await this.prisma.khau_phan_24h.findMany({
      where: { benh_nhan_id: patientId },
      select: {
        id: true,
        benh_nhan_id: true,
        ngay_an: true,
        kieu_nhap: true,
        ghi_chu: true,
        tao_luc: true,
      },
      orderBy: { ngay_an: 'desc' },
      take: 100,
    });

    return intakes.map((r) => ({
      id: r.id.toString(),
      patientId: r.benh_nhan_id.toString(),
      patientName: patient.ho_ten,
      intakeDate:
        r.ngay_an instanceof Date ? r.ngay_an.toISOString().slice(0, 10) : String(r.ngay_an),
      inputType: r.kieu_nhap,
      note: r.ghi_chu || null,
      createdAt: r.tao_luc,
    }));
  }

  /**
   * 7. GET /api/daily-intakes/:id/rda-report: Báo cáo đánh giá RDA/DRI lâm sàng
   */
  async getRdaReport(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<RdaComparisonResult> {
    const intakeDetail = await this.getById(id, currentUser);
    const patient = await this.prisma.benh_nhan.findUnique({
      where: { id: BigInt(intakeDetail.patientId) },
    });

    if (!patient) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    const age = this.calculateAge(patient.ngay_sinh, Boolean(patient.chi_nam_sinh));
    const isMale = patient.gioi_tinh?.toUpperCase() === 'NAM';

    const demographic: DemographicProfile = {
      gender: isMale ? 'NAM' : 'NU',
      ageYears: age,
      activityLevel:
        patient.he_so_hoat_dong && patient.he_so_hoat_dong > 1.6
          ? 'VERY_ACTIVE'
          : patient.he_so_hoat_dong && patient.he_so_hoat_dong > 1.4
            ? 'MODERATE'
            : 'LIGHT',
      activityFactor: patient.he_so_hoat_dong ? Number(patient.he_so_hoat_dong) : undefined,
    };

    return RdaComparisonEngine.compare(intakeDetail.totalDayNutrients, demographic);
  }
}
