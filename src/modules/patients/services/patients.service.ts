import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientQueryDto,
  PatientResponseDto,
} from '../dto';
import { UserRole } from '../../../config/enums/role.enum';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: { role?: string }): boolean {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
  }

  private mapToResponse(patient: any): PatientResponseDto {
    let age: number | null = null;
    let dobStr: string | null = null;
    let birthYearOnly = false;

    if (patient.ngay_sinh) {
      const birth = new Date(patient.ngay_sinh);
      dobStr = birth.toISOString().slice(0, 10);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      age = Math.max(calculatedAge, 0);
      birthYearOnly = birth.getMonth() === 0 && birth.getDate() === 1 && dobStr.endsWith('-01-01');
    }

    const weight = patient.can_nang != null ? Number(patient.can_nang) : null;
    const height = patient.chieu_cao != null ? Number(patient.chieu_cao) : null;
    const activityFactor = patient.he_so_hoat_dong != null ? Number(patient.he_so_hoat_dong) : 1.2;

    let bmi: number | null = null;
    let bmiLevel: string | null = null;
    let bmiStatus: string | null = null;

    if (weight && height && height > 0) {
      const heightInMeters = height / 100;
      bmi = Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;

      if (bmi < 18.5) {
        bmiLevel = 'UNDERWEIGHT';
        bmiStatus = 'Gầy';
      } else if (bmi <= 22.9) {
        bmiLevel = 'NORMAL';
        bmiStatus = 'Bình thường';
      } else if (bmi <= 24.9) {
        bmiLevel = 'OVERWEIGHT';
        bmiStatus = 'Thừa cân';
      } else if (bmi <= 29.9) {
        bmiLevel = 'OBESE_1';
        bmiStatus = 'Béo phì độ I';
      } else {
        bmiLevel = 'OBESE_2';
        bmiStatus = 'Béo phì độ II';
      }
    }

    let tdee: number | null = null;
    if (weight && height && age != null && age > 0) {
      const gender = (patient.gioi_tinh || 'NAM').toUpperCase();
      const isMale = gender === 'NAM' || gender === 'MALE';
      const bmr = 10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161);
      tdee = Math.round(bmr * activityFactor);
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
      bmiLevel,
      bmiStatus,
      tdee,
      activityFactor,
      notes: patient.ghi_chu || null,
      note: patient.ghi_chu || null,
      createdAt: patient.tao_luc ? new Date(patient.tao_luc).toISOString() : null,
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

    return {
      items: items.map((p) => this.mapToResponse(p)),
      total: totalItems,
      page,
      limit,
    };
  }

  /**
   * 2. GET /api/patients/:id: Lấy chi tiết bệnh nhân
   */
  async findById(
    id: string | number | bigint,
    currentUser: { id: string; role?: string },
  ): Promise<PatientResponseDto> {
    const patientId = BigInt(id);
    const patient = await this.prisma.benh_nhan.findFirst({
      where: { id: patientId, deleted_at: null },
    });

    if (!patient) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy thông tin bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (patient.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'ERR_IDOR_VIOLATION', message: 'Bạn không có quyền truy cập hồ sơ bệnh nhân này' },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.mapToResponse(patient);
  }

  /**
   * 3. POST /api/patients: Tạo mới bệnh nhân
   */
  async create(
    dto: CreatePatientDto,
    currentUser: { id: string; role?: string },
  ): Promise<PatientResponseDto> {
    const patientCode =
      dto.patientCode?.trim() ||
      `BN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const birthDate = dto.dob ? new Date(dto.dob) : null;

    const patient = await this.prisma.benh_nhan.create({
      data: {
        nguoi_dung_id: currentUser.id,
        ho_ten: dto.fullName.trim(),
        so_dien_thoai: dto.phoneNumber?.trim() || null,
        ma_benh_nhan_bv: patientCode,
        ngay_sinh: birthDate,
        gioi_tinh: dto.gender || 'NAM',
        can_nang: dto.weight != null ? Number(dto.weight) : null,
        chieu_cao: dto.height != null ? Number(dto.height) : null,
        he_so_hoat_dong: dto.activityFactor != null ? Number(dto.activityFactor) : null,
        ghi_chu: dto.notes?.trim() || null,
        tao_luc: new Date(),
      },
    });

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
    const existing = await this.prisma.benh_nhan.findFirst({
      where: { id: patientId, deleted_at: null },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (existing.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'ERR_IDOR_VIOLATION', message: 'Bạn không có quyền chỉnh sửa hồ sơ này' },
        HttpStatus.FORBIDDEN,
      );
    }

    const birthDate = dto.dob !== undefined ? (dto.dob ? new Date(dto.dob) : null) : undefined;

    const updated = await this.prisma.benh_nhan.update({
      where: { id: patientId },
      data: {
        ho_ten: dto.fullName ? dto.fullName.trim() : undefined,
        so_dien_thoai: dto.phoneNumber !== undefined ? dto.phoneNumber?.trim() || null : undefined,
        ma_benh_nhan_bv: dto.patientCode ? dto.patientCode.trim() : undefined,
        ngay_sinh: birthDate,
        gioi_tinh: dto.gender || undefined,
        can_nang: dto.weight !== undefined ? (dto.weight != null ? Number(dto.weight) : null) : undefined,
        chieu_cao: dto.height !== undefined ? (dto.height != null ? Number(dto.height) : null) : undefined,
        he_so_hoat_dong:
          dto.activityFactor !== undefined
            ? dto.activityFactor != null
              ? Number(dto.activityFactor)
              : null
            : undefined,
        ghi_chu: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
    });

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
    const existing = await this.prisma.benh_nhan.findFirst({
      where: { id: patientId, deleted_at: null },
    });

    if (!existing) {
      throw new HttpException(
        { code: 'PATIENT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (existing.nguoi_dung_id !== currentUser.id && !this.isAdmin(currentUser)) {
      throw new HttpException(
        { code: 'ERR_IDOR_VIOLATION', message: 'Bạn không có quyền xóa bệnh nhân này' },
        HttpStatus.FORBIDDEN,
      );
    }

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
          code: 'PATIENT_IN_USE',
          message:
            'Không thể xóa bệnh nhân đang có thực đơn điều trị hoặc nhật ký khẩu phần 24h',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Soft delete
    await this.prisma.benh_nhan.update({
      where: { id: patientId },
      data: { deleted_at: new Date() },
    });

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
    let sharedWith: string[] = [];

    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      const existing = await this.prisma.benh_nhan.findMany({
        where: {
          so_dien_thoai: cleanPhone,
          deleted_at: null,
          ...(excludeId ? { id: { not: BigInt(excludeId) } } : {}),
        },
        select: { ho_ten: true },
      });
      sharedWith = existing.map((p) => p.ho_ten);
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const phonePart = phone && phone.trim().length >= 4 ? phone.trim().slice(-4) : 'BN';
    const code = `BN-${phonePart}-${randomSuffix}`;
    return { previewCode: code, code, sharedWith };
  }
}
