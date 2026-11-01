import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { DeviceService } from '../../src/modules/auth/services/device.service';
import { TokenBlacklistService } from '../../src/security/token/token-blacklist.service';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { AUTH_ERROR_UNAUTHORIZED } from '../../src/config/constants/auth.constants';

describe('P1 Security & Authentication Fixes', () => {
  describe('[P1-2] Logout with expired token or refresh token', () => {
    let authService: AuthService;
    let mockPrisma: any;
    let mockJwtService: any;
    let mockRefreshTokenRotationService: any;
    let mockConfigService: any;
    let tokenBlacklistService: TokenBlacklistService;

    beforeEach(() => {
      mockPrisma = {
        lich_su_dang_nhap: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockJwtService = {
        decode: jest.fn(),
      };

      mockRefreshTokenRotationService = {
        revokeRefreshToken: jest.fn().mockResolvedValue({
          userId: 'user-from-refresh-token',
        }),
      };

      mockConfigService = {
        get: jest.fn().mockReturnValue('test-secret'),
      };

      tokenBlacklistService = new TokenBlacklistService();

      authService = new AuthService(
        mockPrisma,
        mockJwtService,
        mockRefreshTokenRotationService,
        mockConfigService,
        tokenBlacklistService,
      );
    });

    it('should successfully logout even if access token is expired, extracting userId via decode', async () => {
      const expiredToken = 'expired.access.token';
      mockJwtService.decode.mockReturnValue({
        sub: 'user-uuid-expired',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      const result = await authService.logout({
        authHeader: `Bearer ${expiredToken}`,
        sessionId: 'session-123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Đăng xuất thành công.');
      // Should decode expired token to get userId
      expect(mockJwtService.decode).toHaveBeenCalledWith(expiredToken);
      // Should update lich_su_dang_nhap logout_time for both session and user
      expect(mockPrisma.lich_su_dang_nhap.updateMany).toHaveBeenCalledWith({
        where: { session_id: 'session-123', logout_time: null },
        data: expect.objectContaining({ logout_time: expect.any(Date) }),
      });
      expect(mockPrisma.lich_su_dang_nhap.updateMany).toHaveBeenCalledWith({
        where: { nguoi_dung_id: 'user-uuid-expired', logout_time: null },
        data: expect.objectContaining({ logout_time: expect.any(Date) }),
      });
    });

    it('should successfully logout using only refreshToken when no access token is provided', async () => {
      const result = await authService.logout({
        refreshToken: 'rt-raw-token-12345',
        sessionId: 'session-456',
      });

      expect(result.success).toBe(true);
      expect(mockRefreshTokenRotationService.revokeRefreshToken).toHaveBeenCalledWith(
        'rt-raw-token-12345',
      );
      // userId is retrieved from revoked refresh token
      expect(mockPrisma.lich_su_dang_nhap.updateMany).toHaveBeenCalledWith({
        where: { nguoi_dung_id: 'user-from-refresh-token', logout_time: null },
        data: expect.objectContaining({ logout_time: expect.any(Date) }),
      });
    });

    it('should not throw 401 Unauthorized even if all inputs are missing or invalid', async () => {
      const result = await authService.logout({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Đăng xuất thành công.');
    });
  });

  describe('[P1-3] Access Token Blacklist on Logout & Rejection in JwtStrategy', () => {
    let tokenBlacklistService: TokenBlacklistService;
    let jwtStrategy: JwtStrategy;
    let configService: ConfigService;
    let mockPrisma: any;

    beforeEach(() => {
      tokenBlacklistService = new TokenBlacklistService();
      tokenBlacklistService.clearMemoryCache();

      configService = {
        get: jest.fn().mockReturnValue('test-secret-key-at-least-32-chars-long!'),
      } as unknown as ConfigService;

      mockPrisma = {
        nguoi_dung: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            ten_dang_nhap: 'doctor1',
            vai_tro: 'USER',
            active: true,
          }),
        },
      };

      jwtStrategy = new JwtStrategy(configService, mockPrisma, undefined, tokenBlacklistService);
    });

    it('should add token to blacklist with remaining TTL and confirm it is blacklisted', async () => {
      // Craft a mock JWT with exp 15 minutes from now
      const exp = Math.floor(Date.now() / 1000) + 900;
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64',
      );
      const payloadB64 = Buffer.from(JSON.stringify({ sub: 'user-1', exp })).toString('base64');
      const testToken = `${headerB64}.${payloadB64}.fakesig`;

      expect(await tokenBlacklistService.isTokenBlacklisted(testToken)).toBe(false);

      await tokenBlacklistService.blacklistToken(testToken);

      expect(await tokenBlacklistService.isTokenBlacklisted(testToken)).toBe(true);
      // Should also match when Bearer prefix is used
      expect(await tokenBlacklistService.isTokenBlacklisted(`Bearer ${testToken}`)).toBe(true);
    });

    it('should reject blacklisted token in JwtStrategy.validate() with 401 and specific message', async () => {
      const exp = Math.floor(Date.now() / 1000) + 900;
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64',
      );
      const payloadB64 = Buffer.from(JSON.stringify({ sub: 'user-1', exp })).toString('base64');
      const blacklistedToken = `${headerB64}.${payloadB64}.fakesig`;

      await tokenBlacklistService.blacklistToken(blacklistedToken);

      const mockReq = {
        headers: {
          authorization: `Bearer ${blacklistedToken}`,
        },
      };

      const payload = { sub: 'user-1', role: 'USER' };

      await expect(jwtStrategy.validate(mockReq, payload)).rejects.toThrow(
        new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Token đã bị thu hồi / đăng xuất',
        }),
      );
    });

    it('should allow valid non-blacklisted token in JwtStrategy.validate()', async () => {
      const exp = Math.floor(Date.now() / 1000) + 900;
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64',
      );
      const payloadB64 = Buffer.from(JSON.stringify({ sub: 'user-1', exp })).toString('base64');
      const cleanToken = `${headerB64}.${payloadB64}.cleansig`;

      const mockReq = {
        headers: {
          authorization: `Bearer ${cleanToken}`,
        },
      };

      const payload = { sub: 'user-1', username: 'doctor1', role: 'USER' };

      const result = await jwtStrategy.validate(mockReq, payload);
      expect(result.id).toBe('user-1');
      expect(result.username).toBe('doctor1');
    });
  });

  describe('[P1-4] Login Device Tracking (thiet_bi_dang_nhap)', () => {
    let deviceService: DeviceService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        thiet_bi_dang_nhap: {
          upsert: jest.fn(),
          findMany: jest.fn(),
        },
      };

      deviceService = new DeviceService(mockPrisma);
    });

    it('should parse Chrome on Windows User-Agent accurately', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const parsed = deviceService.parseUserAgent(ua);

      expect(parsed.browser).toBe('Google Chrome');
      expect(parsed.os).toBe('Windows 10/11');
      expect(parsed.deviceType).toBe('WEB');
      expect(parsed.deviceName).toBe('Google Chrome trên Windows 10/11');
    });

    it('should parse Mobile Safari on iPhone accurately', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
      const parsed = deviceService.parseUserAgent(ua);

      expect(parsed.browser).toBe('Apple Safari');
      expect(parsed.os).toBe('iOS (iPhone)');
      expect(parsed.deviceType).toBe('MOBILE');
      expect(parsed.deviceName).toBe('Apple Safari trên iOS (iPhone)');
    });

    it('should parse Android Chrome Mobile accurately', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36';
      const parsed = deviceService.parseUserAgent(ua);

      expect(parsed.browser).toBe('Google Chrome');
      expect(parsed.os).toBe('Android');
      expect(parsed.deviceType).toBe('MOBILE');
      expect(parsed.deviceName).toBe('Google Chrome trên Android');
    });

    it('should upsert thiet_bi_dang_nhap and return device id', async () => {
      const fakeBigIntId = BigInt(42);
      mockPrisma.thiet_bi_dang_nhap.upsert.mockResolvedValue({
        id: fakeBigIntId,
        device_name: 'Google Chrome trên Windows 10/11',
        device_type: 'WEB',
        is_active: true,
      });

      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const record = await deviceService.recordDevice({
        userId: 'user-device-test',
        userAgent: ua,
        ipAddress: '192.168.1.100',
      });

      expect(record).not.toBeNull();
      expect(record?.id).toBe(fakeBigIntId);
      expect(mockPrisma.thiet_bi_dang_nhap.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nguoi_dung_id_device_hash: expect.objectContaining({
              nguoi_dung_id: 'user-device-test',
            }),
          }),
          create: expect.objectContaining({
            nguoi_dung_id: 'user-device-test',
            device_type: 'WEB',
          }),
        }),
      );
    });

    it('should link device_id into lich_su_dang_nhap during AuthService.login', async () => {
      const fakeDeviceId = BigInt(88);
      const mockPrismaAuth: any = {
        nguoi_dung: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-login-dev',
            ten_dang_nhap: 'testuser',
            mat_khau: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
            vai_tro: 'USER',
            active: true,
            ho_so_ca_nhan: { ho_ten: 'Test User', email: 'test@example.com' },
          }),
          update: jest.fn(),
        },
        thiet_bi_dang_nhap: {
          upsert: jest.fn().mockResolvedValue({
            id: fakeDeviceId,
            device_name: 'Google Chrome trên Windows 10/11',
            device_type: 'WEB',
            is_active: true,
          }),
        },
        lich_su_dang_nhap: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
        },
      };

      const mockJwt = {
        sign: jest.fn().mockReturnValue('mock-access-token'),
      };

      const mockRotation = {
        generateTokenString: jest.fn().mockReturnValue('mock-refresh-token'),
        storeRefreshToken: jest.fn().mockResolvedValue({}),
      };

      const mockConfig = {
        get: jest.fn().mockReturnValue('test-secret'),
      };

      const devService = new DeviceService(mockPrismaAuth);

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      const auth = new AuthService(
        mockPrismaAuth,
        mockJwt as any,
        mockRotation as any,
        mockConfig as any,
        undefined,
        devService,
      );

      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0';
      await auth.login({
        dto: { username: 'testuser', password: 'Password123!' },
        ip: '10.0.0.1',
        userAgent: ua,
      });

      // Verify lich_su_dang_nhap was called with device_id
      expect(mockPrismaAuth.lich_su_dang_nhap.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nguoi_dung_id: 'user-login-dev',
            ip_address: '10.0.0.1',
            device_id: fakeDeviceId,
          }),
        }),
      );
    });
  });
});
