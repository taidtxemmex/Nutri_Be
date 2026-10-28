import { PrismaClient } from '@prisma/client';

/**
 * Khởi tạo bộ đếm tự tăng (System Sequences) đồng bộ với số lượng bản ghi thực tế
 */
export async function seedSequences(prisma: PrismaClient): Promise<void> {
  console.log('🔢 Đang khởi tạo các bộ đếm tự tăng (_system_sequences)...');
  const patientCount = await prisma.benh_nhan.count();

  await prisma.systemSequence.upsert({
    where: { name: 'PATIENT_CODE' },
    update: { currentVal: BigInt(patientCount) },
    create: { name: 'PATIENT_CODE', currentVal: BigInt(patientCount) },
  });

  console.log(`   + Bộ đếm mã bệnh nhân PATIENT_CODE: ${patientCount}`);
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runStandaloneSeed } = require('./standalone-runner');
  runStandaloneSeed('sequences', (p: PrismaClient) => seedSequences(p));
}
