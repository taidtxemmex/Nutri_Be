import { PrismaClient } from '@prisma/client';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

function parseDatabaseUrl(url: string) {
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

/**
 * Nạp dữ liệu SQL lâm sàng thô (danh mục, nhóm bệnh, nguyên liệu chuẩn từ Viện Dinh Dưỡng)
 * Chỉ nạp khi CSDL hoàn toàn trống để tránh xung đột khóa chính.
 */
export async function seedRawSqlData(prisma: PrismaClient, databaseUrl: string): Promise<void> {
  const existingNguyenLieu = await prisma.nguyen_lieu.count();
  const seedFilePath = path.join(__dirname, 'seed_data.sql');

  if (existingNguyenLieu === 0 && fs.existsSync(seedFilePath)) {
    console.log(`📖 CSDL thiếu dữ liệu nguyên liệu, đang nạp dữ liệu chuẩn từ: ${seedFilePath}...`);
    const dbConfig = parseDatabaseUrl(databaseUrl);

    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      multipleStatements: true,
    });

    const sqlContent = fs.readFileSync(seedFilePath, 'utf8');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('SET UNIQUE_CHECKS = 0;');
    await connection.query('SET NAMES utf8mb4;');

    const safeSql = sqlContent.replace(/INSERT INTO/g, 'INSERT IGNORE INTO');
    await connection.query(safeSql);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    await connection.query('SET UNIQUE_CHECKS = 1;');
    await connection.end();

    console.log('   ✅ Đã nạp thành công dữ liệu lâm sàng từ file seed SQL!');
  } else {
    console.log(
      `   ℹ️  CSDL đã có sẵn ${existingNguyenLieu} nguyên liệu thực phẩm, bỏ qua nạp SQL thô.`,
    );
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runStandaloneSeed } = require('./standalone-runner');
  runStandaloneSeed('raw-sql', (p: PrismaClient, dbUrl: string) => seedRawSqlData(p, dbUrl));
}
