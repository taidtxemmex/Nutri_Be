import { PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function parseDatabaseUrl(url: string) {
  // mysql://username:password@host:port/database?params
  const regex = /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = url.match(regex);
  if (!match) {
    throw new Error(`Invalid DATABASE_URL format: ${url}`);
  }
  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

async function main() {
  console.log('🌱 ==========================================');
  console.log('🌱 BẮT ĐẦU QUÁ TRÌNH SEED DỮ LIỆU CSDL NUTRI');
  console.log('🌱 ==========================================');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const dbConfig = await parseDatabaseUrl(databaseUrl);
  console.log(`🔌 Kết nối tới CSDL: ${dbConfig.database} tại ${dbConfig.host}:${dbConfig.port}...`);

  // 1. Kết nối qua mysql2 để thực thi multi-statements SQL seed file
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    multipleStatements: true,
  });

  const seedFilePath = path.join(__dirname, 'seeds', 'seed_data.sql');
  if (!fs.existsSync(seedFilePath)) {
    throw new Error(`Seed file not found at: ${seedFilePath}`);
  }

  console.log(`📖 Đang nạp dữ liệu từ: ${seedFilePath} (603 KB)...`);
  const sqlContent = fs.readFileSync(seedFilePath, 'utf8');

  // Tạm tắt kiểm tra khóa ngoại để import an toàn
  await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
  await connection.query('SET UNIQUE_CHECKS = 0;');
  await connection.query('SET NAMES utf8mb4;');

  await connection.query(sqlContent);

  await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
  await connection.query('SET UNIQUE_CHECKS = 1;');
  await connection.end();

  console.log('✅ Đã nạp thành công 30 bảng dữ liệu y tế từ file seed SQL!');

  // 2. Khởi tạo / cập nhật tài khoản Quản trị viên mặc định (Admin Seed)
  const defaultAdminUsername = 'admin';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Admin@123456', salt);

  const existingAdmin = await prisma.nguoi_dung.findFirst({
    where: { ten_dang_nhap: defaultAdminUsername },
  });

  if (!existingAdmin) {
    console.log('👤 Đang tạo tài khoản Quản trị viên tối cao (SUPERADMIN)...');
    await prisma.nguoi_dung.create({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        ten_dang_nhap: defaultAdminUsername,
        mat_khau: hashedPassword,
        vai_tro: 'SUPERADMIN',
        active: true,
        profile_completed: true,
        ho_so_ca_nhan: {
          create: {
            ho_ten: 'Quản Trị Viên Hệ Thống Nutri',
            email: 'admin@truenutri.vn',
            phone: '0901234567',
          },
        },
      },
    });
  } else if (!existingAdmin.mat_khau) {
    console.log('🔑 Cập nhật mật khẩu chuẩn cho tài khoản Admin...');
    await prisma.nguoi_dung.update({
      where: { id: existingAdmin.id },
      data: { mat_khau: hashedPassword },
    });
  }

  // 3. Khởi tạo bộ đếm tự tăng (System Sequences)
  const patientCount = await prisma.benh_nhan.count();
  await prisma.systemSequence.upsert({
    where: { name: 'PATIENT_CODE' },
    update: { currentVal: BigInt(patientCount) },
    create: { name: 'PATIENT_CODE', currentVal: BigInt(patientCount) },
  });

  // 4. Đối soát số lượng bản ghi sau seed
  const [
    nguyenLieuCount,
    monAnCount,
    thucDonCount,
    benhNhanCount,
    danhMucCount,
    nhomBenhCount,
    nguoiDungCount,
    heSoCount,
  ] = await Promise.all([
    prisma.nguyen_lieu.count(),
    prisma.mon_an.count(),
    prisma.thuc_don.count(),
    prisma.benh_nhan.count(),
    prisma.danh_muc.count(),
    prisma.nhom_benh.count(),
    prisma.nguoi_dung.count(),
    prisma.he_so_song_chin.count(),
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
  console.log(`⚖️  Hệ số sống chín:          ${heSoCount}`);
  console.log(`👥 Tài khoản người dùng:     ${nguoiDungCount}`);
  console.log('🚀 Hệ thống Hàng đợi nhúng:   _system_jobs sẵn sàng');
  console.log('🎉 ==========================================');
  console.log('🎉 TOÀN BỘ QUÁ TRÌNH SEED HOÀN TẤT XUẤT SẮC!');
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
