import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Thuật toán Cấp Mã Bệnh Nhân Tự Động Theo SĐT (PatientCodeAllocator)
 * Dịch và chuẩn hóa 100% từ quy tắc nghiệp vụ lâm sàng:
 * 1. Người đầu tiên của SĐT -> Lấy chính SĐT (VD: 0901234567).
 * 2. Người thứ 2 trở đi dùng chung SĐT -> Tự động gán hậu tố nhỏ nhất còn trống: 0901234567-02, 0901234567-03... (Gap-filling).
 * 3. Nếu SĐT đã bị chiếm bởi mã nhập tay, hoặc người cũ mã -02 bị xóa: Lấp vào chỗ trống nhỏ nhất còn khuyết.
 * 4. Nếu không có SĐT: Sinh mã BN-{timestamp}.
 */
export class PatientCodeAllocator {
  private readonly used = new Set<string>();
  private readonly peopleByPhone = new Map<string, number>();

  constructor(
    usedCodes: (string | null | undefined)[] = [],
    existingPhones: (string | null | undefined)[] = [],
  ) {
    usedCodes.forEach((code) => this.reserve(code));
    existingPhones.forEach((phone) => this.addPerson(phone));
  }

  public reserve(code?: string | null): void {
    if (code && code.trim()) {
      this.used.add(code.trim());
    }
  }

  public addPerson(phone?: string | null): void {
    if (phone && phone.trim()) {
      const p = phone.trim();
      const current = this.peopleByPhone.get(p) || 0;
      this.peopleByPhone.set(p, current + 1);
    }
  }

  /**
   * Xem trước mã sẽ sinh theo SĐT (không giữ chỗ)
   */
  public peek(phone?: string | null): string {
    if (!phone || !phone.trim()) {
      let candidate = `BN-${Date.now().toString().slice(-6)}`;
      let counter = 1;
      while (this.used.has(candidate)) {
        candidate = `BN-${Date.now().toString().slice(-6)}-${counter++}`;
      }
      return candidate;
    }

    const p = phone.trim();

    // Chưa có ai dùng SĐT này VÀ mã chính SĐT chưa bị chiếm dụng -> Cấp chính SĐT
    if (!this.peopleByPhone.has(p) && !this.used.has(p)) {
      return p;
    }

    // Đã có người dùng chung hoặc mã chính SĐT đã bị chiếm -> Tìm hậu tố nhỏ nhất còn trống: -02, -03... (Gap-filling)
    for (let n = 2; ; n++) {
      const suffix = String(n).padStart(2, '0');
      const code = `${p}-${suffix}`;
      if (!this.used.has(code)) {
        return code;
      }
    }
  }

  /**
   * Lấy mã và giữ chỗ luôn cho tiến trình tiếp theo
   */
  public next(phone?: string | null): string {
    const code = this.peek(phone);
    this.used.add(code);
    if (phone && phone.trim()) {
      this.addPerson(phone);
    }
    return code;
  }

  /**
   * Preview kết quả chuẩn hóa theo API envelope
   */
  public preview(
    phone?: string | null,
    sharedWith: string[] = [],
  ): { code: string; sharedWith: string[]; previewCode: string } {
    const code = this.peek(phone);
    return {
      code,
      sharedWith,
      previewCode: code,
    };
  }
}

/**
 * Service quản lý cấp mã bệnh nhân trong cơ sở dữ liệu có cơ chế Transaction & Anti-Race-Condition
 */
@Injectable()
export class PatientCodeAllocatorService {
  private static readonly lockQueues = new Map<string, Promise<any>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Khóa phân luồng FIFO bất đồng bộ theo key (bác sĩ + SĐT) triệt tiêu hoàn toàn Race Condition
   */
  public async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = PatientCodeAllocatorService.lockQueues.get(key) || Promise.resolve();
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    PatientCodeAllocatorService.lockQueues.set(key, next);

    try {
      await prev;
    } catch {
      // Bỏ qua lỗi của lượt trước để lượt sau tiếp tục hoạt động an toàn
    }

    try {
      return await fn();
    } finally {
      if (PatientCodeAllocatorService.lockQueues.get(key) === next) {
        PatientCodeAllocatorService.lockQueues.delete(key);
      }
      release!();
    }
  }

  /**
   * Preview mã sẽ sinh theo SĐT kèm danh sách người đang dùng chung SĐT
   */
  async previewCode(
    userId: string,
    phone?: string | null,
    excludeId?: string | number | bigint,
  ): Promise<{ code: string; sharedWith: string[]; previewCode: string }> {
    if (!phone || !phone.trim()) {
      const fallbackCode = `BN-${Date.now().toString().slice(-6)}`;
      return { code: fallbackCode, sharedWith: [], previewCode: fallbackCode };
    }

    const cleanPhone = phone.trim();
    const excludeBigInt = excludeId ? BigInt(excludeId) : undefined;

    // Lấy song song danh sách bệnh nhân cùng SĐT (để lấy họ tên) và tất cả bệnh nhân của bác sĩ
    const [sharedPatients, allDoctorPatients] = await Promise.all([
      this.prisma.benh_nhan.findMany({
        where: {
          nguoi_dung_id: userId,
          so_dien_thoai: cleanPhone,
          deleted_at: null,
          ...(excludeBigInt ? { id: { not: excludeBigInt } } : {}),
        },
        select: { id: true, ho_ten: true },
      }),
      this.prisma.benh_nhan.findMany({
        where: {
          nguoi_dung_id: userId,
          deleted_at: null,
          ...(excludeBigInt ? { id: { not: excludeBigInt } } : {}),
        },
        select: { ma_benh_nhan_bv: true, so_dien_thoai: true },
      }),
    ]);

    const sharedWith = sharedPatients.map((p) => p.ho_ten);
    const usedCodes = allDoctorPatients.map((p) => p.ma_benh_nhan_bv).filter(Boolean) as string[];
    const existingPhones = allDoctorPatients
      .map((p) => p.so_dien_thoai)
      .filter(Boolean) as string[];

    const allocator = new PatientCodeAllocator(usedCodes, existingPhones);
    return allocator.preview(cleanPhone, sharedWith);
  }

  /**
   * Cấp mã tuần tự an toàn chống Race Condition trong Transaction
   */
  async allocateCodeInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    phone?: string | null,
    manualCode?: string | null,
  ): Promise<string> {
    // 1. Nếu người dùng nhập mã tay -> Kiểm tra tính duy nhất trong phạm vi tài khoản bác sĩ
    if (manualCode && manualCode.trim()) {
      const cleanCode = manualCode.trim();
      const existing = await tx.benh_nhan.findFirst({
        where: {
          nguoi_dung_id: userId,
          ma_benh_nhan_bv: cleanCode,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (existing) {
        throw new HttpException(
          {
            code: 'PATIENT_CODE_DUPLICATE',
            message: `Mã bệnh nhân "${cleanCode}" đã tồn tại trong hệ thống`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return cleanCode;
    }

    // 2. Nếu không có SĐT -> Sinh mã mặc định BN-{timestamp}
    if (!phone || !phone.trim()) {
      return `BN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const cleanPhone = phone.trim();

    // 3. Cấp mã tuần tự theo SĐT với gap-filling
    const existingPatients = await tx.benh_nhan.findMany({
      where: {
        nguoi_dung_id: userId,
        deleted_at: null,
      },
      select: { ma_benh_nhan_bv: true, so_dien_thoai: true },
    });

    const usedCodes = existingPatients.map((p) => p.ma_benh_nhan_bv).filter(Boolean) as string[];
    const existingPhones = existingPatients.map((p) => p.so_dien_thoai).filter(Boolean) as string[];

    const allocator = new PatientCodeAllocator(usedCodes, existingPhones);
    return allocator.next(cleanPhone);
  }
}
