import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Runner chung hỗ trợ chạy độc lập từng file seed mà không vi phạm DRY (Rule 5)
 */
export async function runStandaloneSeed(
  name: string,
  fn: (prisma: PrismaClient, databaseUrl: string) => Promise<void>,
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || 'mysql://dangtai:12345678@127.0.0.1:3306/dinhduong';
  const adapter = new PrismaMariaDb(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  console.log(`\n🌱 [Seed Standalone] Bắt đầu chạy module: ${name}`);
  try {
    await fn(prisma, databaseUrl);
    console.log(`✅ [Seed Standalone] Hoàn tất module: ${name}\n`);
  } catch (error) {
    console.error(`❌ [Seed Standalone] Thất bại khi chạy module ${name}:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
