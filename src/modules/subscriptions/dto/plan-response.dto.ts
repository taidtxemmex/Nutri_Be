import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanResponseDto {
  @ApiProperty({ example: '1', description: 'ID gói cước' })
  id: string;

  @ApiProperty({ example: 'PRO_1M', description: 'Mã gói cước' })
  ma_goi: string;

  @ApiProperty({ example: 'PRO_1M', description: 'Mã gói cước (alias packageCode)' })
  packageCode: string;

  @ApiProperty({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước' })
  ten_goi: string;

  @ApiProperty({ example: 'Gói Pro 1 Tháng', description: 'Tên gói cước (alias packageName)' })
  packageName: string;

  @ApiProperty({ example: 30, description: 'Số ngày sử dụng' })
  so_ngay_su_dung: number;

  @ApiProperty({ example: 30, description: 'Số ngày sử dụng (alias usageDays)' })
  usageDays: number;

  @ApiProperty({ example: 199000, description: 'Giá tiền' })
  gia_tien: number;

  @ApiProperty({ example: 199000, description: 'Giá tiền (alias price)' })
  price: number;

  @ApiPropertyOptional({ example: 'Toàn quyền sử dụng tính năng', description: 'Mô tả gói' })
  mo_ta?: string | null;

  @ApiPropertyOptional({
    example: 'Toàn quyền sử dụng tính năng',
    description: 'Mô tả gói (alias description)',
  })
  description?: string | null;

  @ApiProperty({ example: 'ACTIVE', description: 'Trạng thái gói: ACTIVE | INACTIVE' })
  trang_thai: string;

  @ApiProperty({ example: 'ACTIVE', description: 'Trạng thái gói (alias packageStatus)' })
  packageStatus: string;

  @ApiPropertyOptional({ example: '2026-10-27T00:00:00.000Z', description: 'Thời điểm tạo' })
  ngay_tao?: Date | string | null;

  @ApiPropertyOptional({ example: '2026-10-27T00:00:00.000Z', description: 'Thời điểm cập nhật' })
  ngay_cap_nhat?: Date | string | null;

  static fromEntity(entity: any): PlanResponseDto {
    const id = entity.id ? entity.id.toString() : '';
    const maGoi = entity.ma_goi || entity.packageCode || '';
    const tenGoi = entity.ten_goi || entity.packageName || '';
    const soNgay = entity.so_ngay_su_dung ?? entity.usageDays ?? 0;
    const giaTien = Number(entity.gia_tien ?? entity.price ?? 0);
    const moTa = entity.mo_ta ?? entity.description ?? null;
    const trangThai = (entity.trang_thai || entity.packageStatus || 'ACTIVE').toUpperCase();

    return {
      id,
      ma_goi: maGoi,
      packageCode: maGoi,
      ten_goi: tenGoi,
      packageName: tenGoi,
      so_ngay_su_dung: Number(soNgay),
      usageDays: Number(soNgay),
      gia_tien: giaTien,
      price: giaTien,
      mo_ta: moTa,
      description: moTa,
      trang_thai: trangThai,
      packageStatus: trangThai,
      ngay_tao: entity.ngay_tao ?? null,
      ngay_cap_nhat: entity.ngay_cap_nhat ?? null,
    };
  }
}
