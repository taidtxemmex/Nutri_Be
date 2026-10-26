import { PrismaClient } from '@prisma/client';
import { PackageStatus } from '../../src/config/enums';

/**
 * Khởi tạo các Gói dịch vụ định kỳ chuẩn (Packages)
 */
export async function seedPackages(prisma: PrismaClient): Promise<void> {
  console.log('📦 Đang khởi tạo các gói dịch vụ (goi)...');
  const packages = [
    {
      ma_goi: 'FREE_TRIAL',
      ten_goi: 'Dùng Thử Miễn Phí (7 ngày)',
      so_ngay_su_dung: 7,
      gia_tien: 0,
      mo_ta: 'Trải nghiệm tính năng tính toán khẩu phần và xem thực đơn chuẩn.',
      trang_thai: PackageStatus.ACTIVE,
    },
    {
      ma_goi: 'PRO_1M',
      ten_goi: 'Gói Chuyên Gia 1 Tháng',
      so_ngay_su_dung: 30,
      gia_tien: 199000,
      mo_ta: 'Tự do tạo thực đơn lâm sàng, theo dõi không giới hạn bệnh nhân.',
      trang_thai: PackageStatus.ACTIVE,
    },
    {
      ma_goi: 'PRO_6M',
      ten_goi: 'Gói Chuyên Gia 6 Tháng (Tiết kiệm 20%)',
      so_ngay_su_dung: 180,
      gia_tien: 990000,
      mo_ta: 'Dành cho phòng khám và bác sĩ dinh dưỡng độc lập.',
      trang_thai: PackageStatus.ACTIVE,
    },
    {
      ma_goi: 'PRO_1Y',
      ten_goi: 'Gói Chuyên Gia 1 Năm (VIP)',
      so_ngay_su_dung: 365,
      gia_tien: 1790000,
      mo_ta: 'Toàn quyền sử dụng các thuật toán và bộ công cụ cao cấp.',
      trang_thai: PackageStatus.ACTIVE,
    },
  ];

  for (const pkg of packages) {
    await prisma.goi.upsert({
      where: { ma_goi: pkg.ma_goi },
      create: {
        ...pkg,
        deleted_at: null,
      },
      update: {
        ten_goi: pkg.ten_goi,
        so_ngay_su_dung: pkg.so_ngay_su_dung,
        gia_tien: pkg.gia_tien,
        mo_ta: pkg.mo_ta,
        trang_thai: pkg.trang_thai,
        deleted_at: null,
      },
    });
    console.log(`   + Gói cước: ${pkg.ma_goi} - ${pkg.ten_goi}`);
  }
}
