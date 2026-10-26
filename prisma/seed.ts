import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  seedRawSqlData,
  seedUsers,
  seedPackages,
  seedSequences,
} from './seeds';

const databaseUrl = process.env.DATABASE_URL || 'mysql://dangtai:12345678@127.0.0.1:3306/dinhduong';
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 ==========================================');
  console.log('🌱 BẮT ĐẦU QUÁ TRÌNH SEED DỮ LIỆU CSDL NUTRI');
  console.log('🌱 ==========================================');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // 1. Module nạp dữ liệu lâm sàng thô (nếu CSDL trống)
  await seedRawSqlData(prisma, databaseUrl);

  // 2. Module khởi tạo người dùng chuẩn theo vai trò (Role Enums)
  await seedUsers(prisma);

  // 3. Module khởi tạo các gói dịch vụ (PackageStatus Enums)
  await seedPackages(prisma);

  // 4. Module khởi tạo bộ đếm tự tăng (_system_sequences)
  await seedSequences(prisma);

  // 5. Thống kê kết quả sau seed
  const [
    nguyenLieuCount,
    monAnCount,
    thucDonCount,
    benhNhanCount,
    danhMucCount,
    nhomBenhCount,
    nguoiDungCount,
    goiCount,
  ] = await Promise.all([
    prisma.nguyen_lieu.count(),
    prisma.mon_an.count(),
    prisma.thuc_don.count(),
    prisma.benh_nhan.count(),
    prisma.danh_muc.count(),
    prisma.nhom_benh.count(),
    prisma.nguoi_dung.count(),
    prisma.goi.count(),
  ]);

  console.log('\n📊 ==========================================');
  console.log('📊 THỐNG KÊ DỮ LIỆU ĐÃ SEED THÀNH CÔNG:');
  console.log('📊 ==========================================');
  console.log(`🌾 Nguyên liệu chuẩn:        ${nguyenLieuCount} (Viện Dinh Dưỡng)`);
  console.log(`🍲 Món ăn mẫu:               ${monAnCount}`);
  console.log(`📋 Thực đơn dinh dưỡng:      ${thucDonCount}`);
  console.log(`🏥 Hồ sơ bệnh nhân:          ${benhNhanCount}`);
  console.log(`📑 Danh mục thực phẩm:       ${danhMucCount}`);
  console.log(`🩺 Nhóm bệnh lý:             ${nhomBenhCount}`);
  console.log(`👥 Tài khoản người dùng:     ${nguoiDungCount}`);
  console.log(`📦 Gói dịch vụ (goi):        ${goiCount}`);
  console.log('🎉 ==========================================');
  console.log('🎉 TOÀN BỘ QUÁ TRÌNH SEED MODULES HOÀN TẤT!');
  console.log('🎉 ==========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
