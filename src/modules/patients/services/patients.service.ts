import { Injectable, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientQueryDto,
  PatientResponseDto,
  CreateAnthropometryDto,
  AnthropometryQueryDto,
  AnthropometryResponseDto,
  CreateMedicalRecordDto,
  MedicalRecordQueryDto,
  MedicalRecordResponseDto,
} from '../dto';
import { UserRole } from '../../../config/enums/role.enum';
import { AnthropometryEngine } from './anthropometry.service';
import { PatientCodeAllocatorService } from './patient-code-allocator.service';
import {
  CACHE_TAG_PATIENTS,
  CACHE_TTL_PERPETUAL,
  buildPatientCacheTag,
  buildPatientDetailCacheKey,
} from '../../../config/constants/cache.constants';

const ERR_PATIENT_NOT_FOUND = 'Không tìm thấy thông tin bệnh nhân';
const ERR_PATIENT_FORBIDDEN = 'Bạn không có quyền truy cập hồ sơ bệnh nhân này';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeAllocatorService: PatientCodeAllocatorService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  /**
   * Tái sử dụng Cache thực thể Bệnh nhân (Identity Map Pattern)
   * Cho phép MenusService, DailyIntakesService truy vấn 0ms không qua CSDL
   */
  async getPatientEntity(id: bigint | string | number): Promise<any> {
    const patientId = BigInt(id);
    const fetchPatient = async () => {
      return this.prisma.benh_nhan.findFirst({
        where: { id: patientId, deleted_at: null },
      });
    };

    if (this.cacheService) {
      return this.cacheService.getOrSet(
        buildPatientDetailCacheKey(patientId),
        CACHE_TTL_PERPETUAL,
        fetchPatient,
        [CACHE_TAG_PATIENTS, buildPatientCacheTag(patientId)],
      );
    }

    return fetchPatient();
  }

  private async findPatientOrThrow(
    id: bigint,
    currentUser: { id: string; role?: string },
    forbiddenMessage = ERR_PATIENT_FORBIDDEN,
  ) {
    const patient = await this.getPatientEntity(id);

    if (!patient) {
      throw new HttpException(
        { code: 'PAT_001', message: ERR_PATIENT_NOT_FOUND },
        HttpStatus.NOT_FOUND,
      );
    }

    if (patient.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException({ code: 'PAT_001', message: forbiddenMessage }, HttpStatus.FORBIDDEN);
    }

    return patient;
  }

  private mapToResponse(patient: any): PatientResponseDto {
    let age: number | null = null;
    let dobStr: string | null = null;
    let birthYearOnly = false;

    if (patient.ngay_sinh) {
      const birth = new Date(patient.ngay_sinh);
      dobStr = birth.toISOString().slice(0, 10);
      birthYearOnly =
        Boolean(patient.chi_nam_sinh) ||
        (birth.getMonth() === 0 && birth.getDate() === 1 && dobStr.endsWith('-01-01'));
      age = AnthropometryEngine.calculateExactAge(birth, birthYearOnly);
    }

    const weight = patient.can_nang != null ? Number(patient.can_nang) : null;
    const height = patient.chieu_cao != null ? Number(patient.chieu_cao) : null;
    const activityFactor = patient.he_so_hoat_dong != null ? Number(patient.he_so_hoat_dong) : 1.2;

    const { bmi, bmiLevel, bmiStatus } = AnthropometryEngine.calculateBmi(weight, height);

    let tdee: number | null = null;
    if (weight && height && age != null && age > 0) {
      const gender = (patient.gioi_tinh || 'NAM').toUpperCase();
      const isMale = gender === 'NAM' || gender === 'MALE';
      tdee = AnthropometryEngine.calculateTdee(isMale, weight, height, age, activityFactor);
    }

    return {
      id: patient.id.toString(),
      fullName: patient.ho_ten,
      phoneNumber: patient.so_dien_thoai || null,
      patientCode: patient.ma_benh_nhan_bv || null,
      dob: dobStr,
      dateOfBirth: dobStr,
      birthYearOnly,
      age,
      gender: patient.gioi_tinh || 'NAM',
      weight,
      height,
      bmi,
      bmiLevel: bmiLevel ? bmiLevel.toLowerCase().replace('_', '') : null,
      bmiStatus,
      tdee,
      activityFactor,
      notes: patient.ghi_chu || null,
      note: patient.ghi_chu || null,
      createdAt: patient.tao_luc ? new Date(patient.tao_luc).toISOString() : null,
    };
  }

  private mapAnthropometryToResponse(r: any): AnthropometryResponseDto {
    const measuredDate =
      r.ngay_do instanceof Date
        ? r.ngay_do.toISOString().slice(0, 10)
        : String(r.ngay_do).slice(0, 10);
    const weight = Number(r.can_nang);
    const height = Number(r.chieu_cao);
    const bmi = Number(r.bmi);

    const { bmiLevel, bmiStatus } = AnthropometryEngine.calculateBmi(weight, height);

    return {
      id: r.id.toString(),
      patientId: r.benh_nhan_id.toString(),
      measuredDate,
      weight,
      height,
      bmi,
      bmiLevel: (r.phan_loai_bmi || bmiLevel || 'normal').toLowerCase().replace('_', ''),
      bmiStatus: bmiStatus || 'Bình thường',
      bmr: r.bmr != null ? Number(r.bmr) : null,
      tdee: r.tdee != null ? Number(r.tdee) : null,
      systolicBloodPressure: r.huyet_ap_tam_thu != null ? Number(r.huyet_ap_tam_thu) : null,
      diastolicBloodPressure: r.huyet_ap_tam_truong != null ? Number(r.huyet_ap_tam_truong) : null,
      waistCircumference: r.vong_eo != null ? Number(r.vong_eo) : null,
      hipCircumference: r.vong_mong != null ? Number(r.vong_mong) : null,
      activityFactor: r.he_so_hoat_dong != null ? Number(r.he_so_hoat_dong) : null,
      notes: r.ghi_chu || null,
      creatorId: r.nguoi_tao_id,
      createdAt:
        r.tao_luc instanceof Date ? r.tao_luc.toISOString() : new Date(r.tao_luc).toISOString(),
    };
  }

  private mapMedicalRecordToResponse(r: any): MedicalRecordResponseDto {
    const examDate =
      r.ngay_kham instanceof Date
        ? r.ngay_kham.toISOString().slice(0, 10)
        : String(r.ngay_kham).slice(0, 10);

    return {
      id: r.id.toString(),
      patientId: r.benh_nhan_id.toString(),
      examDate,
      reason: r.ly_do_kham || null,
      primaryDiagnosis: r.chan_doan_chinh,
      icd10Code: r.ma_icd10 || null,
      diseaseGroupId: r.nhom_benh_id != null ? Number(r.nhom_benh_id) : null,
      diseaseGroupName: r.nhom_benh_mo_rong?.ten_hien_thi || null,
      clinicalSymptoms: r.trieu_chung_lam_sang || null,
      medicalHistory: r.tien_su_benh || null,
      treatmentPlan: r.huong_dieu_tri || null,
      interventionMenuId: r.thuc_don_can_thiep_id ? r.thuc_don_can_thiep_id.toString() : null,
      interventionMenuName: r.thuc_don?.ten_thuc_don || null,
      doctorId: r.bac_si_kham_id,
      doctorName: r.nguoi_dung?.ten_dang_nhap || null,
      notes: r.ghi_chu || null,
      createdAt:
        r.tao_luc instanceof Date ? r.tao_luc.toISOString() : new Date(r.tao_luc).toISOString(),
    };
  }

  /**
   * 1. GET /api/patients: Danh sách bệnh nhân phân trang & tìm kiếm
   */
  async findAll(
    query: PatientQueryDto,
    currentUser: { id: string; role?: string },
  ): Promise<{ items: PatientResponseDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const cacheKey = this.cacheService?.generateKey('patients:list', {
      page,
      limit,
      search: query.search || (query as any).keyword,
      userId: this.isAdmin(currentUser) ? 'admin' : currentUser.id,
    });

    if (this.cacheService && cacheKey) {
      const cached = await this.cacheService.get<{
        items: PatientResponseDto[];
        total: number;
        page: number;
        limit: number;
      }>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {
      deleted_at: null,
    };

    if (!this.isAdmin(currentUser)) {
      where.nguoi_dung_id = currentUser.id;
    }

    const searchParam = query.search || (query as any).keyword;
    if (searchParam && searchParam.trim()) {
      const s = searchParam.trim();
      where.OR = [
        { ho_ten: { contains: s } },
        { so_dien_thoai: { contains: s } },
        { ma_benh_nhan_bv: { contains: s } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.benh_nhan.count({ where }),
      this.prisma.benh_nhan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
    ]);

    const result = {
      items: items.map((p) => this.mapToResponse(p)),
      total: totalItems,
      page,
      limit,
    };

    if (this.cacheService && cacheKey) {
      await this.cacheService.set(cacheKey, result, CACHE_TTL_PERPETUAL, CACHE_TAG_PATIENTS);
    }

    return result;
  }

  /**
   * 2. GET /api/patients/:id: Lấy chi tiết bệnh nhân
   */
  async findById(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<PatientResponseDto> {
    const patientId = BigInt(id);
    const patient = await this.findPatientOrThrow(patientId, currentUser);
    return this.mapToResponse(patient);
  }

  /**
   * 3. POST /api/patients: Tạo mới bệnh nhân
   */
  async create(
    dto: CreatePatientDto,
    currentUser: { id: string; role?: string },
  ): Promise<PatientResponseDto> {
    const rawDob = dto.dob || dto.dateOfBirth;
    let birthDate: Date | null = null;
    let isBirthYearOnly = dto.birthYearOnly !== undefined ? dto.birthYearOnly : false;

    if (rawDob) {
      if (typeof rawDob === 'string' && /^\d{4}$/.test(rawDob.trim())) {
        birthDate = new Date(`${rawDob.trim()}-01-01`);
        isBirthYearOnly = true;
      } else {
        birthDate = new Date(rawDob);
      }
    }

    const rawNote = dto.notes || dto.note;
    const lockKey = `${currentUser.id}_${dto.phoneNumber?.trim() || 'NO_PHONE'}`;

    const patient = await this.codeAllocatorService.withLock(lockKey, async () => {
      return this.prisma.$transaction(async (tx) => {
        let patientCode: string;

        if (dto.patientCode && dto.patientCode.trim()) {
          patientCode = await this.codeAllocatorService.allocateCodeInTx(
            tx,
            currentUser.id,
            dto.phoneNumber,
            dto.patientCode,
          );
        } else if ((dto as any).autoGenerateCode === true || (dto as any).autoCode === true) {
          patientCode = await this.codeAllocatorService.allocateCodeInTx(
            tx,
            currentUser.id,
            dto.phoneNumber,
            null,
          );
        } else {
          patientCode = `BN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        }

        return tx.benh_nhan.create({
          data: {
            nguoi_dung_id: currentUser.id,
            ho_ten: dto.fullName.trim(),
            so_dien_thoai: dto.phoneNumber?.trim() || null,
            ma_benh_nhan_bv: patientCode,
            ngay_sinh: birthDate,
            chi_nam_sinh: isBirthYearOnly,
            gioi_tinh: dto.gender || 'NAM',
            can_nang: dto.weight != null ? Number(dto.weight) : null,
            chieu_cao: dto.height != null ? Number(dto.height) : null,
            he_so_hoat_dong: dto.activityFactor != null ? Number(dto.activityFactor) : null,
            ghi_chu: rawNote?.trim() || null,
            tao_luc: new Date(),
          },
        });
      });
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_PATIENTS,
        buildPatientCacheTag(patient.id),
      ]);
    }

    return this.mapToResponse(patient);
  }

  /**
   * 4. PUT /api/patients/:id: Cập nhật thông tin bệnh nhân
   */
  async update(
    id: string | number | bigint,
    dto: UpdatePatientDto,
    currentUser: { id: string; role?: string },
  ): Promise<PatientResponseDto> {
    const patientId = BigInt(id);
    const existingPatient = await this.findPatientOrThrow(
      patientId,
      currentUser,
      'Bạn không có quyền chỉnh sửa hồ sơ này',
    );

    if (dto.patientCode && dto.patientCode.trim()) {
      const codeTrimmed = dto.patientCode.trim();
      const duplicateCode = await this.prisma.benh_nhan.findFirst({
        where: {
          nguoi_dung_id: existingPatient.nguoi_dung_id,
          ma_benh_nhan_bv: codeTrimmed,
          id: { not: patientId },
          deleted_at: null,
        },
        select: { id: true },
      });
      if (duplicateCode) {
        throw new HttpException(
          { code: 'PAT_002', message: 'Mã bệnh nhân đã tồn tại trong danh sách của bạn' },
          HttpStatus.CONFLICT,
        );
      }
    }

    const rawDob = dto.dob !== undefined ? dto.dob : dto.dateOfBirth;
    let birthDate: Date | null | undefined = undefined;
    let isBirthYearOnly: boolean | undefined = undefined;

    if (rawDob !== undefined) {
      if (rawDob === null || rawDob === '') {
        birthDate = null;
        isBirthYearOnly = false;
      } else if (typeof rawDob === 'string' && /^\d{4}$/.test(rawDob.trim())) {
        birthDate = new Date(`${rawDob.trim()}-01-01`);
        isBirthYearOnly = true;
      } else {
        birthDate = new Date(rawDob);
      }
    }
    if (dto.birthYearOnly !== undefined) {
      isBirthYearOnly = dto.birthYearOnly;
    }

    const rawNotes = dto.notes !== undefined ? dto.notes : dto.note;

    const updated = await this.prisma.benh_nhan.update({
      where: { id: patientId },
      data: {
        ho_ten: dto.fullName ? dto.fullName.trim() : undefined,
        so_dien_thoai: dto.phoneNumber !== undefined ? dto.phoneNumber?.trim() || null : undefined,
        ma_benh_nhan_bv: dto.patientCode ? dto.patientCode.trim() : undefined,
        ngay_sinh: birthDate,
        chi_nam_sinh: isBirthYearOnly,
        gioi_tinh: dto.gender || undefined,
        can_nang:
          dto.weight !== undefined ? (dto.weight != null ? Number(dto.weight) : null) : undefined,
        chieu_cao:
          dto.height !== undefined ? (dto.height != null ? Number(dto.height) : null) : undefined,
        he_so_hoat_dong:
          dto.activityFactor !== undefined
            ? dto.activityFactor != null
              ? Number(dto.activityFactor)
              : null
            : undefined,
        ghi_chu: rawNotes !== undefined ? rawNotes?.trim() || null : undefined,
      },
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_PATIENTS,
        buildPatientCacheTag(patientId),
      ]);
    }

    return this.mapToResponse(updated);
  }

  /**
   * 5. DELETE /api/patients/:id: Xóa bệnh nhân an toàn (kiểm tra FK trước)
   */
  async delete(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<{ success: boolean; message: string }> {
    const patientId = BigInt(id);
    await this.findPatientOrThrow(patientId, currentUser, 'Bạn không có quyền xóa bệnh nhân này');

    // Kiểm tra ràng buộc thực đơn và khẩu phần 24h
    const [menuCount, intakeCount] = await Promise.all([
      this.prisma.thuc_don.count({
        where: { benh_nhan_id: patientId, deleted_at: null },
      }),
      this.prisma.khau_phan_24h.count({
        where: { benh_nhan_id: patientId },
      }),
    ]);

    if (menuCount > 0 || intakeCount > 0) {
      throw new HttpException(
        {
          code: 'PAT_003',
          message: 'Không thể xóa bệnh nhân đang có thực đơn hoặc khẩu phần điều trị',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Soft delete
    await this.prisma.benh_nhan.update({
      where: { id: patientId },
      data: { deleted_at: new Date() },
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_PATIENTS,
        buildPatientCacheTag(patientId),
      ]);
    }

    return { success: true, message: 'Xóa hồ sơ bệnh nhân thành công' };
  }

  /**
   * 6. GET /api/patients/code-preview: Tự sinh mã bệnh nhân gợi ý
   */
  async previewCode(
    phone?: string,
    excludeId?: string,
    currentUser?: { id?: string },
  ): Promise<{ previewCode: string; code: string; sharedWith: string[] }> {
    const userId = currentUser?.id || '';
    return this.codeAllocatorService.previewCode(userId, phone, excludeId);
  }

  /**
   * 7. GET /api/patients/:id/anthropometry: Lấy lịch sử biến thiên nhân trắc học
   */
  async getAnthropometryHistory(
    id: string | number | bigint,
    query: AnthropometryQueryDto,
    currentUser: { id: string; role?: string },
  ): Promise<{ items: AnthropometryResponseDto[]; total: number; page: number; limit: number }> {
    const patientId = BigInt(id);
    await this.findPatientOrThrow(patientId, currentUser);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.benh_nhan_nhan_trac.count({
        where: { benh_nhan_id: patientId },
      }),
      this.prisma.benh_nhan_nhan_trac.findMany({
        where: { benh_nhan_id: patientId },
        skip,
        take: limit,
        orderBy: [{ ngay_do: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          benh_nhan_id: true,
          ngay_do: true,
          can_nang: true,
          chieu_cao: true,
          bmi: true,
          phan_loai_bmi: true,
          bmr: true,
          tdee: true,
          huyet_ap_tam_thu: true,
          huyet_ap_tam_truong: true,
          vong_eo: true,
          vong_mong: true,
          he_so_hoat_dong: true,
          ghi_chu: true,
          nguoi_tao_id: true,
          tao_luc: true,
        },
      }),
    ]);

    return {
      items: records.map((r) => this.mapAnthropometryToResponse(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * 8. POST /api/patients/:id/anthropometry: Ghi nhận biến thiên thể trạng
   */
  async createAnthropometry(
    id: string | number | bigint,
    dto: CreateAnthropometryDto,
    currentUser: { id: string; role?: string },
  ): Promise<AnthropometryResponseDto> {
    const patientId = BigInt(id);
    const patient = await this.findPatientOrThrow(
      patientId,
      currentUser,
      'Bạn không có quyền ghi nhận thể trạng cho bệnh nhân này',
    );

    const weight = Number(dto.weight);
    const height = Number(dto.height);
    const { bmi, bmiLevel } = AnthropometryEngine.calculateBmi(weight, height);

    const age = AnthropometryEngine.calculateExactAge(
      patient.ngay_sinh,
      Boolean(patient.chi_nam_sinh),
    );
    const isMale =
      (patient.gioi_tinh || 'NAM').toUpperCase() === 'NAM' ||
      (patient.gioi_tinh || '').toUpperCase() === 'MALE';
    const actFactor =
      dto.activityFactor != null
        ? Number(dto.activityFactor)
        : patient.he_so_hoat_dong
          ? Number(patient.he_so_hoat_dong)
          : 1.2;
    const bmr = AnthropometryEngine.calculateBmr(isMale, weight, height, age);
    const tdee = AnthropometryEngine.calculateTdee(isMale, weight, height, age, actFactor);

    const measuredDate = dto.measuredDate
      ? new Date(dto.measuredDate)
      : dto.ngayDo
        ? new Date(dto.ngayDo)
        : new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const anthro = await tx.benh_nhan_nhan_trac.create({
        data: {
          benh_nhan_id: patientId,
          ngay_do: measuredDate,
          can_nang: weight,
          chieu_cao: height,
          bmi: bmi || 0,
          phan_loai_bmi: bmiLevel ? bmiLevel.toLowerCase().replace('_', '') : 'normal',
          bmr: bmr > 0 ? bmr : null,
          tdee: tdee > 0 ? tdee : null,
          huyet_ap_tam_thu:
            dto.systolicBloodPressure != null ? Number(dto.systolicBloodPressure) : null,
          huyet_ap_tam_truong:
            dto.diastolicBloodPressure != null ? Number(dto.diastolicBloodPressure) : null,
          vong_eo: dto.waistCircumference != null ? Number(dto.waistCircumference) : null,
          vong_mong: dto.hipCircumference != null ? Number(dto.hipCircumference) : null,
          he_so_hoat_dong: actFactor,
          ghi_chu: dto.notes?.trim() || null,
          nguoi_tao_id: currentUser.id,
          tao_luc: new Date(),
        },
      });

      // Đồng bộ chỉ số thể trạng mới nhất vào hồ sơ chính của bệnh nhân
      await tx.benh_nhan.update({
        where: { id: patientId },
        data: {
          can_nang: weight,
          chieu_cao: height,
          he_so_hoat_dong: actFactor,
        },
      });

      return anthro;
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_PATIENTS,
        buildPatientCacheTag(patientId),
      ]);
    }

    return this.mapAnthropometryToResponse(created);
  }

  /**
   * 9. GET /api/patients/:id/medical-records: Lấy danh sách hồ sơ bệnh án lâm sàng
   */
  async getMedicalRecords(
    id: string | number | bigint,
    query: MedicalRecordQueryDto,
    currentUser: { id: string; role?: string },
  ): Promise<{ items: MedicalRecordResponseDto[]; total: number; page: number; limit: number }> {
    const patientId = BigInt(id);
    await this.findPatientOrThrow(patientId, currentUser);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.benh_nhan_benh_an.count({
        where: { benh_nhan_id: patientId },
      }),
      this.prisma.benh_nhan_benh_an.findMany({
        where: { benh_nhan_id: patientId },
        skip,
        take: limit,
        orderBy: [{ ngay_kham: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          benh_nhan_id: true,
          ngay_kham: true,
          ly_do_kham: true,
          chan_doan_chinh: true,
          ma_icd10: true,
          nhom_benh_id: true,
          trieu_chung_lam_sang: true,
          tien_su_benh: true,
          huong_dieu_tri: true,
          thuc_don_can_thiep_id: true,
          bac_si_kham_id: true,
          ghi_chu: true,
          tao_luc: true,
          thuc_don: { select: { id: true, ten_thuc_don: true } },
          nhom_benh_mo_rong: { select: { id: true, ten_hien_thi: true } },
          nguoi_dung: { select: { id: true, ten_dang_nhap: true } },
        },
      }),
    ]);

    return {
      items: records.map((r) => this.mapMedicalRecordToResponse(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * 10. POST /api/patients/:id/medical-records: Lưu hồ sơ khám bệnh, chẩn đoán, ICD-10
   */
  async createMedicalRecord(
    id: string | number | bigint,
    dto: CreateMedicalRecordDto,
    currentUser: { id: string; role?: string },
  ): Promise<MedicalRecordResponseDto> {
    const patientId = BigInt(id);
    await this.findPatientOrThrow(
      patientId,
      currentUser,
      'Bạn không có quyền thêm bệnh án cho bệnh nhân này',
    );

    let menuId: bigint | null = null;
    if (dto.interventionMenuId) {
      menuId = BigInt(dto.interventionMenuId);
      const menu = await this.prisma.thuc_don.findFirst({
        where: { id: menuId, deleted_at: null },
        select: { id: true },
      });
      if (!menu) {
        throw new HttpException(
          { code: 'MENU_001', message: 'Không tìm thấy thực đơn can thiệp' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let diseaseGroupId: number | null = null;
    if (dto.diseaseGroupId) {
      diseaseGroupId = Number(dto.diseaseGroupId);
      const diseaseGroup = await this.prisma.nhom_benh_mo_rong.findUnique({
        where: { id: diseaseGroupId },
        select: { id: true },
      });
      if (!diseaseGroup) {
        throw new HttpException(
          { code: 'DISEASE_GROUP_NOT_FOUND', message: 'Không tìm thấy nhóm bệnh' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const examDate = dto.examDate
      ? new Date(dto.examDate)
      : dto.ngayKham
        ? new Date(dto.ngayKham)
        : new Date();

    const record = await this.prisma.benh_nhan_benh_an.create({
      data: {
        benh_nhan_id: patientId,
        ngay_kham: examDate,
        ly_do_kham: dto.reason?.trim() || null,
        chan_doan_chinh: dto.primaryDiagnosis.trim(),
        ma_icd10: dto.icd10Code?.trim() || null,
        nhom_benh_id: diseaseGroupId,
        trieu_chung_lam_sang: dto.clinicalSymptoms?.trim() || null,
        tien_su_benh: dto.medicalHistory?.trim() || null,
        huong_dieu_tri: dto.treatmentPlan?.trim() || null,
        thuc_don_can_thiep_id: menuId,
        bac_si_kham_id: currentUser.id,
        ghi_chu: dto.notes?.trim() || null,
        tao_luc: new Date(),
      },
      select: {
        id: true,
        benh_nhan_id: true,
        ngay_kham: true,
        ly_do_kham: true,
        chan_doan_chinh: true,
        ma_icd10: true,
        nhom_benh_id: true,
        trieu_chung_lam_sang: true,
        tien_su_benh: true,
        huong_dieu_tri: true,
        thuc_don_can_thiep_id: true,
        bac_si_kham_id: true,
        ghi_chu: true,
        tao_luc: true,
        thuc_don: { select: { id: true, ten_thuc_don: true } },
        nhom_benh_mo_rong: { select: { id: true, ten_hien_thi: true } },
        nguoi_dung: { select: { id: true, ten_dang_nhap: true } },
      },
    });

    if (this.cacheService) {
      await this.cacheService.debouncedInvalidateTags([
        CACHE_TAG_PATIENTS,
        buildPatientCacheTag(patientId),
      ]);
    }

    return this.mapMedicalRecordToResponse(record);
  }
}
