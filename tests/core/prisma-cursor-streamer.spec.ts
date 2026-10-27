import { streamPrismaInBatches } from '../../src/core/excel-engine';

describe('PrismaCursorStreamer Unit Tests (Chunked Batch Querying)', () => {
  it('should stream database records in chunks using cursor pagination', async () => {
    const mockData = Array.from({ length: 550 }, (_, i) => ({
      id: i + 1,
      name: `Record ${i + 1}`,
      createdAt: new Date(),
    }));

    const mockPrisma = {
      patient: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const take = args.take || 200;
          const cursorId = args.cursor ? args.cursor.id : 0;
          const skip = args.skip || 0;

          const startIndex = cursorId === 0 ? 0 : cursorId + skip - 1;
          const sliced = mockData.slice(startIndex, startIndex + take);
          return Promise.resolve(sliced);
        }),
      },
    };

    const batchesReceived: number[] = [];
    const totalProcessed = await streamPrismaInBatches(mockPrisma, {
      model: 'patient',
      batchSize: 200,
      onBatch: async (items: any[]) => {
        batchesReceived.push(items.length);
      },
    });

    expect(totalProcessed).toBe(550);
    expect(batchesReceived).toEqual([200, 200, 150]);
    expect(mockPrisma.patient.findMany).toHaveBeenCalledTimes(3);
  });

  it('should throw descriptive error when model delegate is invalid', async () => {
    const mockPrisma = {};
    await expect(
      streamPrismaInBatches(mockPrisma, {
        model: 'nonExistentModel',
        onBatch: async () => {},
      }),
    ).rejects.toThrow("Prisma model 'nonExistentModel' không tồn tại");
  });
});
