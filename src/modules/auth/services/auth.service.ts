import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { RefreshTokenRotationService } from '../../../security/token/refresh-token-rotation.service';
import { TokenBlacklistService } from '../../../security/token/token-blacklist.service';
import { DeviceService } from './device.service';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_TTL_SECONDS,
  BCRYPT_SALT_ROUNDS,
  EMAIL_VERIFY_TOKEN_TTL_HOURS,
  PASSWORD_RESET_OTP_TTL_MINUTES,
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_INACTIVE_ACCOUNT,
} from '../../../config/constants/auth.constants';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
  RegisterParamDto,
  VerifyEmailParamDto,
  LoginParamDto,
  RefreshTokenParamDto,
  LogoutParamDto,
  GoogleLoginParamDto,
  ForgotPasswordParamDto,
  ResetPasswordParamDto,
} from '../dto';
import { UserRole, AuthProvider } from '../../../config/enums';
import { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRotationService: RefreshTokenRotationService,
    private readonly configService: ConfigService,
    @Optional() private readonly tokenBlacklistService?: TokenBlacklistService,
    @Optional() private readonly deviceService?: DeviceService,
  ) {}

  /**
   * Tách họ và tên theo chuẩn tiếng Việt cho claim JWT (family_name & given_name)
   */
  private splitVietnameseName(fullName: string): { familyName: string; givenName: string } {
    if (!fullName) return { familyName: '', givenName: '' };
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { familyName: '', givenName: parts[0] };
    }
    const givenName = parts.pop() || '';
    const familyName = parts.join(' ');
    return { familyName, givenName };
  }

  /**
   * Xác thực tài khoản trực tiếp với Keycloak OpenID Connect Token endpoint
   * Đảm bảo khi người dùng quên/đổi mật khẩu trên Keycloak, NestJS vẫn đăng nhập thành công và tự động đồng bộ hash
   */
  private async verifyWithKeycloak(username: string, password: string): Promise<boolean> {
    const serverUrl = process.env.KC_SERVER_URL || 'https://ilove.truenutri.vn/auth';
    const realm = process.env.KC_REALM || 'nutrition-realm';
    const clientId = process.env.KC_CLIENT_ID || 'nutrition-service';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

    if (!serverUrl || !realm || !clientId || !clientSecret) {
      return false;
    }

    try {
      const tokenUrl = `${serverUrl.replace(/\/+$/, '')}/realms/${realm}/protocol/openid-connect/token`;
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username,
        password,
      });

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      return res.ok;
    } catch (err: any) {
      this.logger.warn(`Keycloak fallback authentication failed for ${username}: ${err?.message}`);
      return false;
    }
  }

  /**
   * Đăng ký tài khoản mới:
   * Kiểm tra trùng lặp username, email
   * Băm mật khẩu bcrypt (10 salt rounds)
   * Lưu vào `dang_ky_cho_xac_thuc`
   * Đẩy job gửi email kích hoạt vào `_system_jobs`
   */
  async register(
    paramOrDto: RegisterParamDto | RegisterDto,
  ): Promise<{ success: boolean; message: string }> {
    const dto =
      paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto
        ? paramOrDto.dto
        : (paramOrDto as RegisterDto);
    const trimmedUsername = dto.username.trim();
    const trimmedEmail = dto.email.trim().toLowerCase();

    // 1. Kiểm tra username đã tồn tại chưa
    const existingUser = await this.prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap: trimmedUsername },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Tên đăng nhập đã tồn tại trong hệ thống.');
    }

    // 2. Kiểm tra email đã tồn tại trong hồ sơ chính thức chưa
    const existingEmail = await this.prisma.ho_so_ca_nhan.findFirst({
      where: { email: trimmedEmail },
      select: { id: true },
    });
    if (existingEmail) {
      throw new ConflictException('Địa chỉ email đã được sử dụng bởi tài khoản khác.');
    }

    // 3. Dọn dẹp các bản ghi chờ xác thực đã hết hạn và bản ghi cũ có cùng email (khớp AuthServiceImpl.java:109-117)
    const now = new Date();
    if (typeof (this.prisma.dang_ky_cho_xac_thuc as any).deleteMany === 'function') {
      await this.prisma.dang_ky_cho_xac_thuc.deleteMany({
        where: { expires_at: { lt: now } },
      });
      await this.prisma.dang_ky_cho_xac_thuc.deleteMany({
        where: { email: trimmedEmail },
      });
    }

    const pendingUser = await this.prisma.dang_ky_cho_xac_thuc.findFirst({
      where: {
        ten_dang_nhap: trimmedUsername,
        expires_at: { gt: now },
      },
      select: { id: true },
    });
    if (pendingUser) {
      throw new ConflictException('Tên đăng nhập đang trong trạng thái chờ xác thực email.');
    }

    // 4. Băm mật khẩu
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // 5. Sinh mã token xác thực duy nhất 64 ký tự
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    // 6. Lưu vào bảng đăng ký chờ xác thực
    await this.prisma.dang_ky_cho_xac_thuc.create({
      data: {
        ten_dang_nhap: trimmedUsername,
        mat_khau_ma_hoa: hashedPassword,
        ho_ten: dto.fullName.trim(),
        email: trimmedEmail,
        phone: dto.phone.trim(),
        dia_chi: dto.address?.trim() || null,
        gioi_tinh: dto.gender as any,
        ngay_sinh: dto.dob ? new Date(dto.dob) : null,
        token_hash: verifyToken,
        created_at: new Date(),
        expires_at: expiresAt,
      },
    });

    // 7. Đẩy email job vào _system_jobs (Priority Queue)
    try {
      await this.prisma.systemJob.create({
        data: {
          queueName: 'email',
          payload: JSON.stringify({
            type: 'VERIFY_EMAIL',
            email: trimmedEmail,
            fullName: dto.fullName.trim(),
            token: verifyToken,
            expiresAt: expiresAt.toISOString(),
          }),
          status: 'PENDING',
          priority: 10,
          attempts: 0,
          maxAttempts: 3,
          runAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.error(`Lỗi khi đẩy email job vào _system_jobs: ${err?.message}`);
    }

    return {
      success: true,
      message: 'Đăng ký tài khoản thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.',
    };
  }

  /**
   * Xác thực tài khoản qua email token:
   * Chuyển dữ liệu từ `dang_ky_cho_xac_thuc` sang `nguoi_dung` & `ho_so_ca_nhan`
   */
  async verifyEmail(
    paramOrToken: VerifyEmailParamDto | string,
  ): Promise<{ success: boolean; message: string }> {
    const token =
      paramOrToken && typeof paramOrToken === 'object' && 'token' in paramOrToken
        ? paramOrToken.token
        : (paramOrToken as string);

    if (!token || !token.trim()) {
      throw new BadRequestException('Mã xác thực không hợp lệ.');
    }

    const rawToken = token.trim();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    let pending: any = null;
    if (typeof this.prisma.dang_ky_cho_xac_thuc.findFirst === 'function') {
      pending = await this.prisma.dang_ky_cho_xac_thuc.findFirst({
        where: {
          OR: [{ token_hash: tokenHash }, { token_hash: rawToken }],
        },
      });
    }
    if (!pending && typeof this.prisma.dang_ky_cho_xac_thuc.findUnique === 'function') {
      pending =
        (await this.prisma.dang_ky_cho_xac_thuc.findUnique({
          where: { token_hash: rawToken },
        })) ||
        (await this.prisma.dang_ky_cho_xac_thuc.findUnique({
          where: { token_hash: tokenHash },
        }));
    }

    if (!pending) {
      throw new BadRequestException('Mã xác thực không tồn tại hoặc tài khoản đã được kích hoạt.');
    }

    if (new Date(pending.expires_at).getTime() < Date.now()) {
      await this.prisma.dang_ky_cho_xac_thuc.delete({ where: { id: pending.id } });
      throw new BadRequestException('Mã xác thực đã hết hạn. Vui lòng tiến hành đăng ký lại.');
    }

    const newUserId = crypto.randomUUID();

    await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.nguoi_dung.findUnique({
        where: { ten_dang_nhap: pending.ten_dang_nhap },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException({
          code: 'USER_ALREADY_EXISTS',
          message: 'Tên đăng nhập đã tồn tại trong hệ thống.',
        });
      }

      // 1. Tạo tài khoản nguoi_dung
      await tx.nguoi_dung.create({
        data: {
          id: newUserId,
          ten_dang_nhap: pending.ten_dang_nhap,
          mat_khau: pending.mat_khau_ma_hoa,
          vai_tro: UserRole.USER,
          kenh: AuthProvider.LOCAL,
          active: true,
          profile_completed: false,
          keycloak_user_id: newUserId,
        },
      });

      // 2. Tạo hồ sơ cá nhân ho_so_ca_nhan
      await tx.ho_so_ca_nhan.create({
        data: {
          nguoi_dung_id: newUserId,
          ho_ten: pending.ho_ten,
          email: pending.email,
          phone: pending.phone,
          dia_chi: pending.dia_chi,
          gioi_tinh: pending.gioi_tinh,
          ngay_sinh: pending.ngay_sinh,
        },
      });

      // 3. Xóa bản ghi chờ xác thực
      await tx.dang_ky_cho_xac_thuc.delete({
        where: { id: pending.id },
      });
    });

    return {
      success: true,
      message: 'Kích hoạt tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.',
    };
  }

  /**
   * Đăng nhập người dùng bằng tài khoản cục bộ (Username hoặc Email):
   * Kiểm tra mật khẩu bcrypt, kiểm tra active = true
   * Cấp Access Token (15m) + Refresh Token (7d)
   * Ghi log lịch sử đăng nhập
   */
  async login(
    paramOrDto: LoginParamDto | LoginDto,
    legacyIp?: string,
    legacyUserAgent?: string,
  ): Promise<AuthResponseDto & { sessionId?: string }> {
    let dto: LoginDto;
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto) {
      dto = paramOrDto.dto;
      ipAddress = paramOrDto.ip;
      userAgent = paramOrDto.userAgent;
    } else {
      dto = paramOrDto as LoginDto;
      ipAddress = legacyIp;
      userAgent = legacyUserAgent;
    }

    const trimmedUsername = dto.username.trim();
    const userSelect = {
      id: true,
      ten_dang_nhap: true,
      mat_khau: true,
      vai_tro: true,
      active: true,
      deleted_at: true,
      keycloak_user_id: true,
      ho_so_ca_nhan: {
        select: {
          ho_ten: true,
          email: true,
        },
      },
    };

    let user: any = null;
    if (trimmedUsername.includes('@') && typeof this.prisma.nguoi_dung.findFirst === 'function') {
      user = await this.prisma.nguoi_dung.findFirst({
        where: {
          OR: [
            { ten_dang_nhap: trimmedUsername },
            { ho_so_ca_nhan: { is: { email: trimmedUsername } } },
          ],
        },
        select: userSelect,
      });
    }
    if (!user && typeof this.prisma.nguoi_dung.findUnique === 'function') {
      user = await this.prisma.nguoi_dung.findUnique({
        where: { ten_dang_nhap: trimmedUsername },
        select: userSelect,
      });
    }

    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    let isMatch = false;
    let shouldRehash = false;

    if (user.mat_khau) {
      try {
        if (user.mat_khau.startsWith('$2a$') || user.mat_khau.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(dto.password, user.mat_khau);
        } else if (user.mat_khau.startsWith('pbkdf2-sha512$')) {
          const [_algo, iterationsStr, saltB64, expectedHashB64] = user.mat_khau.split('$');
          if (iterationsStr && saltB64 && expectedHashB64) {
            const iterations = parseInt(iterationsStr, 10);
            if (!isNaN(iterations) && iterations > 0) {
              const actualHash = crypto.pbkdf2Sync(
                dto.password,
                Buffer.from(saltB64, 'base64'),
                iterations,
                64,
                'sha512',
              );
              const actualHashB64 = actualHash.toString('base64');
              const actualHashBuf = Buffer.from(actualHashB64);
              const expectedHashBuf = Buffer.from(expectedHashB64);

              if (
                actualHashBuf.length === expectedHashBuf.length &&
                crypto.timingSafeEqual(actualHashBuf, expectedHashBuf)
              ) {
                isMatch = true;
                shouldRehash = true;
              }
            }
          }
        } else {
          // Fallback kiểm tra bcrypt cho các định dạng khác
          isMatch = await bcrypt.compare(dto.password, user.mat_khau);
        }
      } catch (verifyErr: any) {
        this.logger.warn(
          `Lỗi khi kiểm tra mật khẩu cho tài khoản ${user.ten_dang_nhap}: ${verifyErr?.message}`,
        );
        isMatch = false;
      }
    }

    // Fallback: Nếu hash cục bộ không khớp hoặc chưa có (ví dụ đổi mật khẩu trên Keycloak), xác thực trực tiếp với Keycloak SSO
    if (!isMatch && user.keycloak_user_id) {
      const isKeycloakValid = await this.verifyWithKeycloak(trimmedUsername, dto.password);
      if (isKeycloakValid) {
        isMatch = true;
        shouldRehash = true;
      }
    }

    if (!isMatch) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }

    if (user.active === false || (user.deleted_at !== null && user.deleted_at !== undefined)) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_INACTIVE_ACCOUNT,
        message: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc chưa kích hoạt.',
      });
    }

    // Lazy Rehash: Tự động nâng cấp mật khẩu từ PBKDF2 (Keycloak) sang Bcrypt
    if (shouldRehash) {
      try {
        const newBcryptHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
        await this.prisma.nguoi_dung.update({
          where: { id: user.id },
          data: { mat_khau: newBcryptHash },
        });
        this.logger.log(
          `Tài khoản ${user.ten_dang_nhap} đã tự động nâng cấp mật khẩu từ Keycloak sang Bcrypt!`,
        );
      } catch (rehashErr: any) {
        this.logger.error(
          `Lỗi khi tự động nâng cấp mật khẩu (Lazy Rehash) cho ${user.ten_dang_nhap}: ${rehashErr?.message}`,
        );
      }
    }

    const fullName = user.ho_so_ca_nhan?.ho_ten || user.ten_dang_nhap;
    const email = user.ho_so_ca_nhan?.email || '';
    const { familyName, givenName } = this.splitVietnameseName(fullName);

    // Chuẩn hóa claims tương thích tuyệt đối với NutriFE jwtUtils.js
    const jwtPayload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      preferred_username: user.ten_dang_nhap,
      username: user.ten_dang_nhap,
      email: email,
      role: user.vai_tro,
      roles: [user.vai_tro],
      realm_access: {
        roles: [user.vai_tro],
      },
      family_name: familyName,
      given_name: givenName,
      keycloakUserId: user.keycloak_user_id || user.id,
    };

    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    // Tạo refresh token có cơ chế rotation chống Replay Attack
    const rawRefreshToken = this.refreshTokenRotationService.generateTokenString();
    await this.refreshTokenRotationService.storeRefreshToken({
      userId: user.id,
      rawToken: rawRefreshToken,
      ipAddress,
      userAgent,
    });

    // Ghi nhận thiết bị đăng nhập (P1-4)
    let deviceId: bigint | null = null;
    if (this.deviceService) {
      try {
        const deviceRecord = await this.deviceService.recordDevice({
          userId: user.id,
          userAgent,
          ipAddress,
        });
        if (deviceRecord?.id) {
          deviceId = deviceRecord.id;
        }
      } catch (devErr: any) {
        this.logger.warn(`Lỗi ghi nhận thiết bị đăng nhập: ${devErr?.message}`);
      }
    }

    // Ghi nhận lịch sử đăng nhập (O(1) async write)
    const sessionId = crypto.randomUUID();
    try {
      await this.prisma.lich_su_dang_nhap.create({
        data: {
          nguoi_dung_id: user.id,
          ip_address: ipAddress || '127.0.0.1',
          login_time: new Date(),
          session_id: sessionId,
          ...(deviceId ? { device_id: deviceId } : {}),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Lỗi ghi nhận lịch sử đăng nhập: ${err?.message}`);
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      userId: user.id,
      username: user.ten_dang_nhap,
      email: user.ho_so_ca_nhan?.email ?? undefined,
      fullName,
      role: user.vai_tro,
      sessionId,
    };
  }

  /**
   * Xoay vòng Refresh Token (Token Rotation per RFC 6819)
   */
  async refreshToken(
    paramOrDto: RefreshTokenParamDto | RefreshTokenDto,
    legacyIp?: string,
    legacyUserAgent?: string,
  ): Promise<AuthResponseDto> {
    let dto: RefreshTokenDto;
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto) {
      dto = paramOrDto.dto;
      ipAddress = paramOrDto.ip;
      userAgent = paramOrDto.userAgent;
    } else {
      dto = paramOrDto as RefreshTokenDto;
      ipAddress = legacyIp;
      userAgent = legacyUserAgent;
    }

    const rotation = await this.refreshTokenRotationService.validateAndRotateRefreshToken({
      oldRawToken: dto.refreshToken,
      ipAddress,
      userAgent,
    });

    const user = await this.prisma.nguoi_dung.findUnique({
      where: { id: rotation.userId },
      select: {
        id: true,
        ten_dang_nhap: true,
        vai_tro: true,
        active: true,
        deleted_at: true,
        keycloak_user_id: true,
        ho_so_ca_nhan: {
          select: {
            ho_ten: true,
            email: true,
          },
        },
      },
    });

    if (!user || user.active === false || (user as any).deleted_at) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_INACTIVE_ACCOUNT,
        message: 'Tài khoản không tồn tại hoặc đã bị khóa.',
      });
    }

    const fullName = user.ho_so_ca_nhan?.ho_ten || user.ten_dang_nhap;
    const email = user.ho_so_ca_nhan?.email || '';
    const { familyName, givenName } = this.splitVietnameseName(fullName);

    const jwtPayload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      preferred_username: user.ten_dang_nhap,
      username: user.ten_dang_nhap,
      email: email,
      role: user.vai_tro,
      roles: [user.vai_tro],
      realm_access: {
        roles: [user.vai_tro],
      },
      family_name: familyName,
      given_name: givenName,
      keycloakUserId: user.keycloak_user_id || user.id,
    };

    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    return {
      accessToken,
      refreshToken: rotation.newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      userId: user.id,
      username: user.ten_dang_nhap,
      email: user.ho_so_ca_nhan?.email ?? undefined,
      fullName,
      role: user.vai_tro,
    };
  }

  async refresh(
    paramOrDto: RefreshTokenParamDto | RefreshTokenDto,
    legacyIp?: string,
    legacyUserAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.refreshToken(paramOrDto, legacyIp, legacyUserAgent);
  }

  /**
   * Đăng xuất: thu hồi refresh token, đưa access token vào blacklist và cập nhật logout_time
   * Cho phép đăng xuất an toàn ngay cả khi Access Token đã hết hạn (P1-2, P1-3)
   */
  async logout(
    paramOrUser?: LogoutParamDto | AuthenticatedUser,
    legacyRefreshToken?: string,
    legacySessionId?: string,
  ): Promise<{ success: boolean; message: string }> {
    let currentUser: AuthenticatedUser | undefined;
    let refreshToken: string | undefined;
    let sessionId: string | undefined;
    let authHeader: string | undefined;
    let accessToken: string | undefined;
    let userId: string | undefined;

    if (paramOrUser && typeof paramOrUser === 'object') {
      if (
        'user' in paramOrUser ||
        'refreshToken' in paramOrUser ||
        'sessionId' in paramOrUser ||
        'authHeader' in paramOrUser ||
        'accessToken' in paramOrUser ||
        'userId' in paramOrUser
      ) {
        const dto = paramOrUser as LogoutParamDto;
        currentUser = dto.user;
        refreshToken = dto.refreshToken;
        sessionId = dto.sessionId;
        authHeader = dto.authHeader;
        accessToken = dto.accessToken;
        userId = dto.userId || currentUser?.id;
      } else {
        currentUser = paramOrUser as AuthenticatedUser;
        refreshToken = legacyRefreshToken;
        sessionId = legacySessionId;
        userId = currentUser?.id;
      }
    } else {
      refreshToken = legacyRefreshToken;
      sessionId = legacySessionId;
    }

    // 1. Trích xuất Access Token từ authHeader hoặc accessToken
    let rawAccessToken = accessToken;
    if (!rawAccessToken && authHeader && typeof authHeader === 'string') {
      rawAccessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    // 2. Đưa Access Token vào Blacklist nếu có (P1-3)
    if (rawAccessToken && this.tokenBlacklistService) {
      try {
        await this.tokenBlacklistService.blacklistToken(rawAccessToken);
      } catch (err: any) {
        this.logger.warn(`Lỗi đưa token vào blacklist: ${err?.message}`);
      }
    }

    // 3. Nếu chưa có userId, giải mã token (kể cả đã hết hạn) để trích xuất userId (P1-2)
    if (!userId && rawAccessToken) {
      try {
        const decoded: any = this.jwtService.decode(rawAccessToken);
        if (decoded && (decoded.sub || decoded.userId || decoded.id)) {
          userId = decoded.sub || decoded.userId || decoded.id;
        }
      } catch (err: any) {
        this.logger.debug?.(`Không thể giải mã Access Token: ${err?.message}`);
      }
    }

    // 4. Thu hồi Refresh Token nếu có
    if (refreshToken) {
      try {
        const revokedRecord =
          await this.refreshTokenRotationService.revokeRefreshToken(refreshToken);
        if (!userId && revokedRecord?.userId) {
          userId = revokedRecord.userId;
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi thu hồi refresh token: ${err?.message}`);
      }
    }

    // 5. Cập nhật logout_time trong lich_su_dang_nhap
    if (sessionId) {
      try {
        await this.prisma.lich_su_dang_nhap.updateMany({
          where: { session_id: sessionId, logout_time: null },
          data: { logout_time: new Date() },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi cập nhật logout_time theo session: ${err?.message}`);
      }
    }

    if (userId) {
      try {
        await this.prisma.lich_su_dang_nhap.updateMany({
          where: { nguoi_dung_id: userId, logout_time: null },
          data: { logout_time: new Date() },
        });
      } catch (err: any) {
        this.logger.warn(`Lỗi cập nhật logout_time theo user: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: 'Đăng xuất thành công.',
    };
  }

  /**
   * Đăng nhập hoặc trao đổi mã xác thực Google OAuth2 (Google ID Token)
   */
  async googleLogin(
    paramOrDto: GoogleLoginParamDto | GoogleAuthDto,
    legacyIp?: string,
    legacyUserAgent?: string,
  ): Promise<AuthResponseDto> {
    let dto: GoogleAuthDto;
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto) {
      dto = paramOrDto.dto;
      ipAddress = paramOrDto.ip;
      userAgent = paramOrDto.userAgent;
    } else {
      dto = paramOrDto as GoogleAuthDto;
      ipAddress = legacyIp;
      userAgent = legacyUserAgent;
    }

    let rawToken = dto.credential || dto.idToken;
    if (!rawToken && (dto as any).code) {
      const authCode = (dto as any).code;
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'postmessage';
      if (clientId && clientSecret) {
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code: authCode,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }).toString(),
          });
          if (tokenRes.ok) {
            const tokenData = (await tokenRes.json()) as any;
            rawToken = tokenData.id_token;
          }
        } catch (e: any) {
          this.logger.warn(`Không thể đổi authorization code sang id_token: ${e.message}`);
        }
      }
      if (!rawToken) {
        rawToken = authCode;
      }
    }

    if (!rawToken) {
      throw new BadRequestException(
        'Thiếu Google Token định danh (idToken, credential hoặc code).',
      );
    }

    let googleData: { sub: string; email: string; name?: string; picture?: string };

    try {
      // Xác thực chữ ký token thực tế qua Google TokenInfo API (URL encoded)
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`,
      );
      if (!res.ok) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Token Google không hợp lệ, không thể xác thực chữ ký số hoặc đã hết hạn.',
        });
      }
      const info = (await res.json()) as any;
      if (!info.email || !info.sub) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Token Google không chứa đầy đủ thông tin danh tính (sub, email).',
        });
      }

      // Kiểm tra audience (Client ID) chống token giả mạo từ app khác
      const expectedAudience = process.env.GOOGLE_CLIENT_ID;
      if (expectedAudience && info.aud && info.aud !== expectedAudience) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Token Google không thuộc về ứng dụng này (Client ID mismatch).',
        });
      }

      // Kiểm tra trạng thái xác thực email
      if (info.email_verified === 'false' || info.email_verified === false) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Địa chỉ email Google chưa được xác thực.',
        });
      }

      googleData = {
        sub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
      };
    } catch (e: any) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      this.logger.error(`Lỗi xác thực Google OAuth2: ${e.message}`, e.stack);
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Không thể kết nối đến máy chủ Google để xác thực chữ ký token.',
      });
    }

    const email = googleData.email.toLowerCase().trim();
    const googleId = googleData.sub;
    const fullName = googleData.name || email.split('@')[0];

    // Tìm kiếm user theo kênh Google hoặc theo email đã có
    let user = await this.prisma.nguoi_dung.findFirst({
      where: {
        OR: [{ kenh: 'KEYCLOAK_GOOGLE', id_kenh: googleId }, { ho_so_ca_nhan: { email } }],
      },
      select: {
        id: true,
        ten_dang_nhap: true,
        vai_tro: true,
        active: true,
        deleted_at: true,
        keycloak_user_id: true,
        ho_so_ca_nhan: {
          select: {
            ho_ten: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      // Tạo mới tài khoản cho user Google
      const newUserId = crypto.randomUUID();
      const generatedUsername = `${email.split('@')[0]}_${crypto.randomBytes(3).toString('hex')}`;

      user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.nguoi_dung.create({
          data: {
            id: newUserId,
            ten_dang_nhap: generatedUsername,
            vai_tro: UserRole.USER,
            kenh: AuthProvider.KEYCLOAK_GOOGLE,
            id_kenh: googleId,
            active: true,
            profile_completed: false,
            keycloak_user_id: newUserId,
          },
          select: {
            id: true,
            ten_dang_nhap: true,
            vai_tro: true,
            active: true,
            deleted_at: true,
            keycloak_user_id: true,
          },
        });

        await tx.ho_so_ca_nhan.create({
          data: {
            nguoi_dung_id: newUserId,
            ho_ten: fullName,
            email: email,
          },
        });

        return {
          ...createdUser,
          ho_so_ca_nhan: {
            ho_ten: fullName,
            email: email,
          },
        };
      });
    }

    if (user.active === false || (user as any).deleted_at) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_INACTIVE_ACCOUNT,
        message: 'Tài khoản của bạn đã bị vô hiệu hóa.',
      });
    }

    const { familyName, givenName } = this.splitVietnameseName(fullName);

    const jwtPayload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      preferred_username: user.ten_dang_nhap,
      username: user.ten_dang_nhap,
      email: email,
      role: user.vai_tro,
      roles: [user.vai_tro],
      realm_access: {
        roles: [user.vai_tro],
      },
      family_name: familyName,
      given_name: givenName,
      keycloakUserId: user.keycloak_user_id || user.id,
    };

    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const rawRefreshToken = this.refreshTokenRotationService.generateTokenString();
    await this.refreshTokenRotationService.storeRefreshToken({
      userId: user.id,
      rawToken: rawRefreshToken,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      userId: user.id,
      username: user.ten_dang_nhap,
      email: user.ho_so_ca_nhan?.email ?? email,
      fullName: user.ho_so_ca_nhan?.ho_ten || fullName,
      role: user.vai_tro,
    };
  }

  async exchangeOAuth2Token(
    paramOrDto: GoogleLoginParamDto | GoogleAuthDto,
    legacyIp?: string,
    legacyUserAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.googleLogin(paramOrDto, legacyIp, legacyUserAgent);
  }

  /**
   * Quên mật khẩu: sinh token OTP trong `ma_xac_thuc`, đẩy mail job vào `_system_jobs` (< 5ms)
   */
  async forgotPassword(
    paramOrDto: ForgotPasswordParamDto | ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const dto =
      paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto
        ? paramOrDto.dto
        : (paramOrDto as ForgotPasswordDto);
    const email = dto.email.trim().toLowerCase();

    const profile = await this.prisma.ho_so_ca_nhan.findFirst({
      where: { email },
      select: {
        nguoi_dung_id: true,
        ho_ten: true,
        email: true,
        nguoi_dung: {
          select: {
            active: true,
            deleted_at: true,
          },
        },
      },
    });

    if (profile && profile.nguoi_dung_id) {
      const user =
        (profile as any).nguoi_dung !== undefined
          ? (profile as any).nguoi_dung
          : await this.prisma.nguoi_dung.findUnique({
              where: { id: profile.nguoi_dung_id },
              select: { active: true, deleted_at: true },
            });

      const isUserEligible =
        user === undefined ||
        (user !== null &&
          user.active !== false &&
          (user.deleted_at === null || user.deleted_at === undefined));

      if (isUserEligible) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000);

        // Lưu/Cập nhật mã OTP trong bảng `ma_xac_thuc`
        await this.prisma.ma_xac_thuc.upsert({
          where: { nguoi_dung_id: profile.nguoi_dung_id },
          create: {
            nguoi_dung_id: profile.nguoi_dung_id,
            ma_token: resetToken,
            ngay_het_han: expiresAt,
          },
          update: {
            ma_token: resetToken,
            ngay_het_han: expiresAt,
          },
        });

        // Đẩy job gửi email vào `_system_jobs`
        try {
          await this.prisma.systemJob.create({
            data: {
              queueName: 'email',
              payload: JSON.stringify({
                type: 'RESET_PASSWORD',
                email: profile.email,
                fullName: profile.ho_ten || 'Người dùng',
                token: resetToken,
                expiresAt: expiresAt.toISOString(),
              }),
              status: 'PENDING',
              priority: 10,
              attempts: 0,
              maxAttempts: 3,
              runAt: new Date(),
            },
          });
        } catch (err: any) {
          this.logger.error(`Lỗi khi tạo email job đặt lại mật khẩu: ${err?.message}`);
        }
      }
    }

    // Luôn trả thông điệp chung để chống liệt kê tài khoản (Email Enumeration Protection)
    return {
      success: true,
      message:
        'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong hộp thư.',
    };
  }

  /**
   * Đặt lại mật khẩu: kiểm tra token trong `ma_xac_thuc`, băm mật khẩu mới, thu hồi mọi phiên cũ
   */
  async resetPassword(
    paramOrDto: ResetPasswordParamDto | ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const dto =
      paramOrDto && typeof paramOrDto === 'object' && 'dto' in paramOrDto
        ? paramOrDto.dto
        : (paramOrDto as ResetPasswordDto);
    const token = dto.token.trim();

    const record = await this.prisma.ma_xac_thuc.findUnique({
      where: { ma_token: token },
    });

    if (!record) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã được sử dụng.');
    }

    if (new Date(record.ngay_het_han).getTime() < Date.now()) {
      await this.prisma.ma_xac_thuc.delete({ where: { id: record.id } });
      throw new BadRequestException('Mã xác thực đã hết hạn. Vui lòng yêu cầu cấp lại mã mới.');
    }

    const user =
      (record as any).nguoi_dung !== undefined
        ? (record as any).nguoi_dung
        : await this.prisma.nguoi_dung.findUnique({
            where: { id: record.nguoi_dung_id },
            select: { id: true, active: true, deleted_at: true },
          });

    if (
      user !== undefined &&
      (!user ||
        !(user.active !== false && (user.deleted_at === null || user.deleted_at === undefined)))
    ) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_INACTIVE_ACCOUNT,
        message: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc chưa kích hoạt.',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật mật khẩu mới
      await tx.nguoi_dung.update({
        where: { id: record.nguoi_dung_id },
        data: {
          mat_khau: hashedPassword,
        },
      });

      // 2. Xóa mã token đã sử dụng
      await tx.ma_xac_thuc.delete({
        where: { id: record.id },
      });
    });

    // 3. Thu hồi toàn bộ Refresh Token của user nhằm vô hiệu hóa các phiên đã đăng nhập trước đó
    await this.refreshTokenRotationService.revokeAllUserTokens(record.nguoi_dung_id);

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại với mật khẩu mới.',
    };
  }
}
