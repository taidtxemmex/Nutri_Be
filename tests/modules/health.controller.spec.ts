import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/modules/health/health.controller';
import { PrismaService } from '../../src/core/database/prisma.service';

describe('HealthController - System Readiness & Liveness Probe', () => {
  let controller: HealthController;
  let mockPrisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return status "ok" when database connection is healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ '1': 1 }]);

    const result = await controller.checkHealth();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(result.timestamp).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(result.memory.heapUsed).toMatch(/^\d+MB$/);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should return status "degraded" when database query fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await controller.checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('degraded');
    expect(typeof result.uptime).toBe('number');
    expect(result.timestamp).toBeDefined();
    expect(result.memory).toBeDefined();
  });
});
