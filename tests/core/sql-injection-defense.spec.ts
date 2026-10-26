import { UsersService } from '../../src/modules/users/services/users.service';
import { IdorDefenseService } from '../../src/security/idor/idor-defense.service';

describe('SQL Injection Defense in Search & Queries', () => {
  let usersService: UsersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      nguoi_dung: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    usersService = new UsersService(mockPrisma, new IdorDefenseService());
  });

  const injectionPayloads = [
    "' OR '1'='1",
    "admin'--",
    "'; DROP TABLE nguoi_dung; --",
    "' UNION SELECT null, ten_dang_nhap, mat_khau FROM nguoi_dung --",
    "\" OR \"\"=\"",
    "1; SELECT * FROM nguoi_dung",
  ];

  it.each(injectionPayloads)(
    'should safely parameterize and escape SQL injection payload: %s',
    async (payload) => {
      const result = await usersService.findAll({ search: payload, page: 1, limit: 10 });

      expect(mockPrisma.nguoi_dung.findMany).toHaveBeenCalledTimes(1);
      const callArg = mockPrisma.nguoi_dung.findMany.mock.calls[0][0];

      // Verifies Prisma structured AST where clause is used
      expect(callArg.where).toBeDefined();
      expect(callArg.where.OR).toEqual([
        { ten_dang_nhap: { contains: payload.trim() } },
        { ho_so_ca_nhan: { ho_ten: { contains: payload.trim() } } },
        { ho_so_ca_nhan: { email: { contains: payload.trim() } } },
      ]);

      // Returns empty/safe list without executing raw SQL
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    },
  );
});
