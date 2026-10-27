export class PatientCodeAllocator {
  private readonly used = new Set<string>();
  private readonly peopleByPhone = new Map<string, number>();

  constructor(usedCodes: string[], existingPhones: (string | null | undefined)[]) {
    usedCodes.forEach((code) => this.reserve(code));
    existingPhones.forEach((phone) => this.addPerson(phone));
  }

  public reserve(code?: string | null): void {
    if (code && code.trim()) {
      this.used.add(code.trim());
    }
  }

  private addPerson(phone?: string | null): void {
    if (phone && phone.trim()) {
      const p = phone.trim();
      const current = this.peopleByPhone.get(p) || 0;
      this.peopleByPhone.set(p, current + 1);
    }
  }

  /**
   * Xem trước mã sẽ sinh (không giữ chỗ)
   */
  public peek(phone: string): string {
    const p = phone.trim();
    // Chưa có ai dùng SĐT này và mã SĐT chưa bị chiếm dụng -> cấp chính SĐT
    if (!this.peopleByPhone.has(p) && !this.used.has(p)) {
      return p;
    }
    // Đã có người dùng chung -> tìm hậu tố nhỏ nhất -02, -03...
    for (let n = 2; ; n++) {
      const code = `${p}-${String(n).padStart(2, '0')}`;
      if (!this.used.has(code)) {
        return code;
      }
    }
  }

  /**
   * Lấy mã và giữ chỗ luôn cho tiến trình tiếp theo
   */
  public next(phone: string): string {
    const code = this.peek(phone);
    this.used.add(code);
    this.addPerson(phone);
    return code;
  }
}
