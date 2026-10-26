import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'mysql://dangtai:12345678@127.0.0.1:3306/dinhduong';
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

const SEEDS_DIR = path.resolve(__dirname, 'seeds');

// Bảng ánh xạ alias tiện lợi cho người dùng
const ALIASES: Record<string, string> = {
  sql: 'raw-sql',
  'raw-sql': 'raw-sql',
  user: 'users',
  users: 'users',
  package: 'packages',
  packages: 'packages',
  seq: 'sequences',
  sequence: 'sequences',
  sequences: 'sequences',
};

// Thứ tự seed mặc định đảm bảo toàn vẹn ràng buộc quan hệ
const DEFAULT_ORDER = ['raw-sql', 'users', 'packages', 'sequences'];

/**
 * Tìm file seed tương ứng dựa trên tên hoặc đường dẫn người dùng truyền vào
 */
function resolveSeedFile(input: string): { filePath: string; name: string } | null {
  const clean = input.trim();
  const baseName = path.basename(clean).replace(/\.(ts|js)$/, '').replace(/\.seed$/, '');
  const targetName = ALIASES[baseName.toLowerCase()] || baseName;

  // 1. File trong prisma/seeds/{targetName}.seed.ts
  const candidate1 = path.join(SEEDS_DIR, `${targetName}.seed.ts`);
  if (fs.existsSync(candidate1)) {
    return { filePath: candidate1, name: targetName };
  }

  // 2. File trong prisma/seeds/{targetName}.ts
  const candidate2 = path.join(SEEDS_DIR, `${targetName}.ts`);
  if (fs.existsSync(candidate2)) {
    return { filePath: candidate2, name: targetName };
  }

  // 3. Đường dẫn trực tiếp từ thư mục gốc
  const directPath = path.resolve(process.cwd(), clean);
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, name: baseName };
  }

  return null;
}

/**
 * Nạp động module seed và gọi hàm thực thi
 */
async function executeSeedModule(filePath: string, name: string): Promise<void> {
  console.log(`\n▶️  [Seed] Đang nạp và thực thi module: ${name} (${path.relative(process.cwd(), filePath)})...`);
  const mod = await import(filePath);

  // Tìm hàm seed phù hợp: default export hoặc hàm có tiền tố seed / run / main
  let seedFn: ((p: PrismaClient, url: string) => Promise<any>) | null = null;

  if (typeof mod.default === 'function') {
    seedFn = mod.default;
  } else {
    const keys = Object.keys(mod);
    const matchedKey =
      keys.find((k) => /^seed/i.test(k) && typeof mod[k] === 'function') ||
      keys.find((k) => /^(run|main)/i.test(k) && typeof mod[k] === 'function') ||
      keys.find((k) => typeof mod[k] === 'function');

    if (matchedKey) {
      seedFn = mod[matchedKey];
    }
  }

  if (!seedFn) {
    throw new Error(`Không tìm thấy hàm seed nào được export trong file: ${filePath}`);
  }

  await seedFn(prisma, databaseUrl);
  console.log(`✅ [Seed] Đã hoàn thành module: ${name}`);
}

/**
 * In bảng thống kê tổng hợp sau khi seed toàn bộ
 */
async function printSummaryTable() {
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

/**
 * Lấy danh sách các module khả dụng trong prisma/seeds/
 */
function getAvailableSeedNames(): string[] {
  if (!fs.existsSync(SEEDS_DIR)) return [];
  return fs
    .readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith('.seed.ts') || file.endsWith('.seed.js'))
    .map((file) => file.replace(/\.seed\.(ts|js)$/, ''));
}

async function main() {
  // Lấy các tham số sau lệnh: npm run seed -- <file>
  const rawArgs = process.argv.slice(2);
  const targets: string[] = [];

  for (const arg of rawArgs) {
    if (arg.startsWith('--only=')) {
      targets.push(...arg.replace('--only=', '').split(',').map((s) => s.trim()));
    } else if (arg.startsWith('--')) {
      const clean = arg.replace(/^--/, '').trim();
      if (clean) targets.push(clean);
    } else if (!arg.startsWith('-')) {
      targets.push(arg.trim());
    }
  }

  const isTargeted = targets.length > 0 && !targets.includes('all');

  console.log('🌱 ==========================================');
  console.log('🌱 BẮT ĐẦU QUÁ TRÌNH SEED DỮ LIỆU CSDL NUTRI');
  if (isTargeted) {
    console.log(`🌱 Chế độ thực thi theo file chỉ định: [${targets.join(', ')}]`);
  } else {
    console.log('🌱 Chế độ chạy toàn bộ tất cả modules');
  }
  console.log('🌱 ==========================================');

  if (isTargeted) {
    for (const target of targets) {
      const resolved = resolveSeedFile(target);
      if (!resolved) {
        const available = getAvailableSeedNames();
        console.error(`\n❌ Không tìm thấy file seed phù hợp cho: "${target}"`);
        console.log(`💡 Các file seed khả dụng trong prisma/seeds/:`);
        available.forEach((a) => console.log(`   - ${a} (${a}.seed.ts)`));
        console.log(`\n📌 Cú pháp sử dụng:`);
        console.log(`   npm run seed -- <tên_seed>`);
        console.log(`   Ví dụ: npm run seed -- packages`);
        console.log(`          npm run seed -- users.seed.ts`);
        console.log(`          npm run seed -- sql\n`);
        process.exit(1);
      }

      await executeSeedModule(resolved.filePath, resolved.name);
    }

    console.log('\n🎉 ==========================================');
    console.log(`🎉 ĐÃ HOÀN TẤT CÁC SEED ĐƯỢC CHỌN: [${targets.join(', ')}]`);
    console.log('🎉 ==========================================\n');
  } else {
    // Chạy toàn bộ theo thứ tự chuẩn
    for (const name of DEFAULT_ORDER) {
      const resolved = resolveSeedFile(name);
      if (resolved) {
        await executeSeedModule(resolved.filePath, resolved.name);
      }
    }

    await printSummaryTable();
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
