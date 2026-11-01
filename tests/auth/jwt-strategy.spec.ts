import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import {
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_INACTIVE_ACCOUNT,
} from '../../src/config/constants/auth.constants';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let mockPrisma: any;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('test-jwt-secret-key-1234567890'),
    } as unknown as ConfigService;

    mockPrisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
      },
    };

    strategy = new JwtStrategy(configService, mockPrisma);
  });

  it('should validate and extract id, username, and role from payload', async () => {
    mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
      id: 'uuid-user-1',
      ten_dang_nhap: 'doctor_hoang',
      vai_tro: 'ADMIN',
      active: true,
    });

    const payload = {
      sub: 'uuid-user-1',
      username: 'doctor_hoang',
      role: 'ADMIN',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: 'uuid-user-1',
      sub: 'uuid-user-1',
      username: 'doctor_hoang',
      role: 'ADMIN',
      keycloakUserId: undefined,
    });
  });

  it('should throw UnauthorizedException if sub or id is missing', async () => {
    const invalidPayload: any = { username: 'test_user' };

    await expect(strategy.validate(invalidPayload)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user is deactivated (active = false)', async () => {
    mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
      id: 'uuid-banned-user',
      ten_dang_nhap: 'banned_user',
      vai_tro: 'USER',
      active: false,
    });

    const payload = {
      sub: 'uuid-banned-user',
      username: 'banned_user',
      role: 'USER',
    };

    await expect(strategy.validate(payload)).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_INACTIVE_ACCOUNT,
      },
    });
  });

  it('should throw UnauthorizedException if user does not exist in DB', async () => {
    mockPrisma.nguoi_dung.findUnique.mockResolvedValue(null);

    const payload = {
      sub: 'uuid-ghost-user',
      username: 'ghost',
      role: 'USER',
    };

    await expect(strategy.validate(payload)).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_UNAUTHORIZED,
      },
    });
  });
});
