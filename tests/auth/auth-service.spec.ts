import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { RefreshTokenRotationService } from '../../src/security/token/refresh-token-rotation.service';
import { UserRole } from '../../src/config/enums/role.enum';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockRefreshTokenRotationService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      nguoi_dung: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      dang_ky_cho_xac_thuc: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      ho_so_ca_nhan: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      systemJob: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      lich_su_dang_nhap: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      ma_xac_thuc: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
        delete: jest.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-access-token'),
    };

    mockRefreshTokenRotationService = {
      generateTokenString: jest.fn().mockReturnValue('mock-refresh-token-hex'),
      storeRefreshToken: jest.fn().mockResolvedValue({}),
      validateAndRotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    authService = new AuthService(
      mockPrisma,
      mockJwtService,
      mockRefreshTokenRotationService,
      mockConfigService,
    );
  });

  describe('register', () => {
    const registerDto = {
      username: 'bs_minhtri',
      password: 'P@ssw0rd123!',
      fullName: 'Nguyễn Minh Trí',
      email: 'bsminhtri@gmail.com',
      phone: '0987654321',
      address: 'Hà Nội',
      gender: 'NAM' as const,
      dob: '1990-05-15',
    };

    it('should register successfully, hash password, store in pending and enqueue email job', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue(null);
      mockPrisma.dang_ky_cho_xac_thuc.findFirst.mockResolvedValue(null);
      mockPrisma.ho_so_ca_nhan.findFirst.mockResolvedValue(null);
      mockPrisma.dang_ky_cho_xac_thuc.create.mockResolvedValue({ id: 1 });

      const result = await authService.register(registerDto);

      expect(result.success).toBe(true);
      expect(mockPrisma.dang_ky_cho_xac_thuc.create).toHaveBeenCalled();
      expect(mockPrisma.systemJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queueName: 'email',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should throw ConflictException if username already exists in nguoi_dung', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already registered in ho_so_ca_nhan', async () => {
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue(null);
      mockPrisma.dang_ky_cho_xac_thuc.findFirst.mockResolvedValue(null);
      mockPrisma.ho_so_ca_nhan.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyEmail', () => {
    it('should successfully activate account and transfer to nguoi_dung + ho_so_ca_nhan', async () => {
      const pendingRecord = {
        id: 1,
        ten_dang_nhap: 'bs_minhtri',
        mat_khau_ma_hoa: 'hashed_password',
        ho_ten: 'Nguyễn Minh Trí',
        email: 'bsminhtri@gmail.com',
        phone: '0987654321',
        dia_chi: 'Hà Nội',
        gioi_tinh: 'NAM',
        ngay_sinh: new Date('1990-05-15'),
        expires_at: new Date(Date.now() + 3600000),
      };

      mockPrisma.dang_ky_cho_xac_thuc.findUnique.mockResolvedValue(pendingRecord);

      const result = await authService.verifyEmail('valid-token-hash');

      expect(result.success).toBe(true);
      expect(mockPrisma.nguoi_dung.create).toHaveBeenCalled();
      expect(mockPrisma.ho_so_ca_nhan.create).toHaveBeenCalled();
      expect(mockPrisma.dang_ky_cho_xac_thuc.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token does not exist', async () => {
      mockPrisma.dang_ky_cho_xac_thuc.findUnique.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      mockPrisma.dang_ky_cho_xac_thuc.findUnique.mockResolvedValue({
        id: 1,
        expires_at: new Date(Date.now() - 10000),
      });

      await expect(authService.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials and return JWT claims matching FE format', async () => {
      const hashedPassword = await bcrypt.hash('P@ssw0rd123!', 10);
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        ten_dang_nhap: 'bs_minhtri',
        mat_khau: hashedPassword,
        vai_tro: 'USER',
        active: true,
        keycloak_user_id: 'user-uuid-1',
        ho_so_ca_nhan: {
          ho_ten: 'Nguyễn Minh Trí',
          email: 'bsminhtri@gmail.com',
        },
      });

      const result = await authService.login(
        { username: 'bs_minhtri', password: 'P@ssw0rd123!' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token-hex');
      expect(result.userId).toBe('user-uuid-1');
      expect(result.username).toBe('bs_minhtri');
      expect(result.role).toBe('USER');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-uuid-1',
          preferred_username: 'bs_minhtri',
          roles: ['USER'],
          realm_access: { roles: ['USER'] },
          family_name: 'Nguyễn Minh',
          given_name: 'Trí',
        }),
        expect.anything(),
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPass123!', 10);
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        ten_dang_nhap: 'bs_minhtri',
        mat_khau: hashedPassword,
        active: true,
      });

      await expect(
        authService.login({ username: 'bs_minhtri', password: 'WrongPass!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is inactive (active = false)', async () => {
      const hashedPassword = await bcrypt.hash('P@ssw0rd123!', 10);
      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        ten_dang_nhap: 'locked_user',
        mat_khau: hashedPassword,
        active: false,
      });

      await expect(
        authService.login({ username: 'locked_user', password: 'P@ssw0rd123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token and issue new access token', async () => {
      mockRefreshTokenRotationService.validateAndRotateRefreshToken.mockResolvedValue({
        newRefreshToken: 'new-rotated-refresh-token',
        userId: 'user-uuid-1',
        familyId: 'family-1',
      });

      mockPrisma.nguoi_dung.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        ten_dang_nhap: 'bs_minhtri',
        vai_tro: 'USER',
        active: true,
        keycloak_user_id: 'user-uuid-1',
        ho_so_ca_nhan: {
          ho_ten: 'Nguyễn Minh Trí',
          email: 'bsminhtri@gmail.com',
        },
      });

      const result = await authService.refreshToken({
        refreshToken: 'valid-old-refresh-token',
      });

      expect(result.refreshToken).toBe('new-rotated-refresh-token');
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.userId).toBe('user-uuid-1');
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('should enqueue reset password email job without blocking', async () => {
      mockPrisma.ho_so_ca_nhan.findFirst.mockResolvedValue({
        nguoi_dung_id: 'user-uuid-1',
        ho_ten: 'Nguyễn Minh Trí',
        email: 'bsminhtri@gmail.com',
      });

      const result = await authService.forgotPassword({ email: 'bsminhtri@gmail.com' });

      expect(result.success).toBe(true);
      expect(mockPrisma.ma_xac_thuc.upsert).toHaveBeenCalled();
      expect(mockPrisma.systemJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queueName: 'email',
          }),
        }),
      );
    });

    it('should reset password, update hash and revoke all user refresh tokens', async () => {
      mockPrisma.ma_xac_thuc.findUnique.mockResolvedValue({
        id: 1,
        nguoi_dung_id: 'user-uuid-1',
        ma_token: 'valid-otp-token',
        ngay_het_han: new Date(Date.now() + 600000),
      });

      const result = await authService.resetPassword({
        token: 'valid-otp-token',
        newPassword: 'NewP@ssw0rd123!',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.nguoi_dung.update).toHaveBeenCalled();
      expect(mockPrisma.ma_xac_thuc.delete).toHaveBeenCalled();
      expect(mockRefreshTokenRotationService.revokeAllUserTokens).toHaveBeenCalledWith(
        'user-uuid-1',
      );
    });
  });
});
