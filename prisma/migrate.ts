import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL || 'mysql://dangtai:12345678@127.0.0.1:3306/dinhduong';
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

/**
 * Áp dụng toàn bộ migration mới (Forward Migration - UP)
 */
export async function up(): Promise<void> {
  console.log('🚀 Đang chạy Prisma Migrate Deploy (UP)...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}

/**
 * Hoàn tác migration gần nhất hoặc chỉ định (Rollback Migration - DOWN)
 */
export async function down(targetMigrationName?: string): Promise<void> {
  console.log('🔄 ==========================================');
  console.log('🔄 BẮT ĐẦU QUÁ TRÌNH ROLLBACK MIGRATION (DOWN)');
  console.log('🔄 ==========================================');

  try {
    // 1. Tìm migration mới nhất đã apply thành công trong _prisma_migrations
    let targetName = targetMigrationName;

    if (!targetName) {
      const latest = await prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations 
        WHERE finished_at IS NOT NULL 
          AND rolled_back_at IS NULL 
          AND migration_name != '0_init'
        ORDER BY started_at DESC 
        LIMIT 1;
      `;

      if (!latest || latest.length === 0) {
        console.log(
          'ℹ️  Không có migration nào khả dụng để rollback (hoặc chỉ còn baseline 0_init).',
        );
        return;
      }
      targetName = latest[0].migration_name;
    }

    const migrationDir = path.join(__dirname, 'migrations', targetName);
    const rollbackSqlPath = path.join(migrationDir, 'rollback.sql');

    if (!fs.existsSync(rollbackSqlPath)) {
      throw new Error(
        `Không tìm thấy file rollback.sql cho migration: ${targetName} tại ${rollbackSqlPath}`,
      );
    }

    console.log(`📖 Đang đọc script rollback từ: ${rollbackSqlPath}`);
    const sqlContent = fs.readFileSync(rollbackSqlPath, 'utf8');

    // Tách các câu lệnh SQL theo dấu chấm phẩy
    const rawStatements = sqlContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(
      `⚡ Đang thực thi ${rawStatements.length} câu lệnh DDL rollback cho [${targetName}]...`,
    );

    // Thực thi tuần tự từng câu lệnh DDL
    for (const stmt of rawStatements) {
      await prisma.$executeRawUnsafe(stmt);
    }

    // Xóa bản ghi migration trong _prisma_migrations để CSDL đồng bộ với Prisma CLI
    await prisma.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations WHERE migration_name = '${targetName}';`,
    );

    console.log(`✅ Đã rollback thành công migration: ${targetName}`);
    console.log('🔄 ==========================================');
  } catch (err: any) {
    console.error('❌ Lỗi trong quá trình rollback:', err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// CLI Runner
if (require.main === module) {
  const action = process.argv[2] || 'down';
  const target = process.argv[3];

  if (action === 'up') {
    up().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else if (action === 'down' || action === 'rollback') {
    down(target).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  } else {
    console.log('Sử dụng: ts-node prisma/migrate.ts [up | down | rollback] [migration_name]');
  }
}
