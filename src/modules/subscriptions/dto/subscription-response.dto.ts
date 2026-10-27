import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionDocumentResponseDto {
  @ApiProperty({ example: '1', description: 'ID chứng minh' })
  id: string;

  @ApiPropertyOptional({ example: 'receipts/order_123.jpg' })
  objectKey?: string | null;

  @ApiPropertyOptional({ example: 'receipt.jpg' })
  originalFileName?: string | null;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/receipt.jpg' })
  externalLink?: string | null;
}

export class SubscriptionResponseDto {
  @ApiProperty({ example: '1', description: 'ID yêu cầu thanh toán' })
  id: string;

  @ApiProperty({ example: 'TX-261027-A1B2C3', description: 'Mã giao dịch chuẩn duy nhất' })
  maGiaoDich: string;

  @ApiProperty({ example: 'TX-261027-A1B2C3', description: 'Mã giao dịch (snake_case)' })
  ma_giao_dich: string;

  @ApiPropertyOptional({ example: 'user01', description: 'Tên đăng nhập' })
  username?: string | null;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Họ và tên người dùng' })
  fullName?: string | null;

  @ApiProperty({ example: 'PRO_1M', description: 'Mã gói cước' })
  maGoi: string;

  @ApiProperty({ example: 'PRO_1M', description: 'Mã gói cước (snake_case)' })
  ma_goi: string;

  @ApiProperty({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước' })
  tenGoi: string;

  @ApiProperty({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (snake_case)' })
  ten_goi: string;

  @ApiProperty({ example: 30, description: 'Số ngày sử dụng' })
  soNgaySuDung: number;

  @ApiProperty({ example: 30, description: 'Số ngày sử dụng (snake_case)' })
  so_ngay_su_dung: number;

  @ApiProperty({ example: 199000, description: 'Số tiền nạp' })
  soTien: number;

  @ApiProperty({ example: 199000, description: 'Số tiền nạp (snake_case)' })
  so_tien: number;

  @ApiProperty({ example: 'PENDING', description: 'Trạng thái: PENDING | APPROVED | REJECTED' })
  trangThai: string;

  @ApiProperty({ example: 'PENDING', description: 'Trạng thái (snake_case)' })
  trang_thai: string;

  @ApiPropertyOptional({ example: null, description: 'Lý do từ chối nếu có' })
  lyDoTuChoi?: string | null;

  @ApiPropertyOptional({ example: null, description: 'Lý do từ chối (snake_case)' })
  ly_do_tu_choi?: string | null;

  @ApiPropertyOptional({ example: '2026-10-27T00:00:00.000Z' })
  ngayTao?: Date | string | null;

  @ApiPropertyOptional({ example: '2026-10-27T00:00:00.000Z' })
  ngay_tao?: Date | string | null;

  @ApiPropertyOptional({ example: null })
  ngayPheDuyet?: Date | string | null;

  @ApiPropertyOptional({ example: null })
  ngay_phe_duyet?: Date | string | null;

  @ApiPropertyOptional({ type: [SubscriptionDocumentResponseDto] })
  documents?: SubscriptionDocumentResponseDto[];

  static fromEntity(entity: any, userProfile?: { username?: string; fullName?: string }): SubscriptionResponseDto {
    const id = entity.id ? entity.id.toString() : '';
    const code = entity.ma_giao_dich || '';
    const maGoi = entity.ma_goi || '';
    const tenGoi = entity.ten_goi || '';
    const soNgay = Number(entity.so_ngay_su_dung ?? 0);
    const soTien = Number(entity.so_tien ?? 0);
    const trangThai = (entity.trang_thai || 'PENDING').toUpperCase();
    const lyDo = entity.ly_do_tu_choi || null;

    const username = userProfile?.username ?? entity.nguoi_dung?.ten_dang_nhap ?? null;
    const fullName = userProfile?.fullName ?? entity.nguoi_dung?.ho_so_ca_nhan?.ho_ten ?? null;

    const docs: SubscriptionDocumentResponseDto[] = (entity.minh_chung || []).map((d: any) => ({
      id: d.id ? d.id.toString() : '',
      objectKey: d.object_key ?? null,
      originalFileName: d.ten_file_goc ?? null,
      mimeType: d.mime_type ?? null,
      externalLink: d.link_ngoai ?? null,
    }));

    return {
      id,
      maGiaoDich: code,
      ma_giao_dich: code,
      username,
      fullName,
      maGoi,
      ma_goi: maGoi,
      tenGoi,
      ten_goi: tenGoi,
      soNgaySuDung: soNgay,
      so_ngay_su_dung: soNgay,
      soTien,
      so_tien: soTien,
      trangThai,
      trang_thai: trangThai,
      lyDoTuChoi: lyDo,
      ly_do_tu_choi: lyDo,
      ngayTao: entity.ngay_tao ?? null,
      ngay_tao: entity.ngay_tao ?? null,
      ngayPheDuyet: entity.ngay_phe_duyet ?? null,
      ngay_phe_duyet: entity.ngay_phe_duyet ?? null,
      documents: docs,
    };
  }
}
