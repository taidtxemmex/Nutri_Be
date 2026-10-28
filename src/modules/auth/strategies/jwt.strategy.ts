import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_INACTIVE_ACCOUNT,
} from '../../../config/constants/auth.constants';
import {
  CACHE_TAG_USERS,
  CACHE_TTL_PERPETUAL,
  buildUserAuthCacheKey,
  buildUserCacheTag,
  buildUserDetailCacheKey,
} from '../../../config/constants/cache.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret || 'dev_temporary_jwt_secret_key_minimum_32_chars_12345',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const userId = payload.sub || payload.id;

    if (!payload || !userId) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_UNAUTHORIZED,
        message: 'Token không hợp lệ hoặc thiếu thông tin định danh.',
      });
    }

    let role = payload.role;

    if (this.prisma) {
      let user: {
        id: string;
        ten_dang_nhap: string;
        vai_tro: string;
        active: boolean | null;
      } | null = null;

      if (this.cacheService) {
        // Shared Entity Cache / Identity Map: Kiểm tra xem user detail đã có trong cache chưa
        const cachedDetail = await this.cacheService.get<any>(buildUserDetailCacheKey(userId));
        if (cachedDetail && cachedDetail.id) {
          user = {
            id: cachedDetail.id,
            ten_dang_nhap: cachedDetail.ten_dang_nhap || cachedDetail.username || '',
            vai_tro: cachedDetail.vai_tro || cachedDetail.role || 'USER',
            active: cachedDetail.active !== undefined ? cachedDetail.active : true,
          };
        } else {
          // Chưa có trong detail cache -> nạp và lưu auth cache vĩnh viễn đến khi có mutation
          user = await this.cacheService.getOrSet(
            buildUserAuthCacheKey(userId),
            CACHE_TTL_PERPETUAL,
            async () => {
              return this.prisma!.nguoi_dung.findUnique({
                where: { id: userId },
                select: { id: true, ten_dang_nhap: true, vai_tro: true, active: true },
              });
            },
            [CACHE_TAG_USERS, buildUserCacheTag(userId)],
          );
        }
      } else {
        user = await this.prisma.nguoi_dung.findUnique({
          where: { id: userId },
          select: { id: true, ten_dang_nhap: true, vai_tro: true, active: true },
        });
      }

      if (!user) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_UNAUTHORIZED,
          message: 'Tài khoản không tồn tại trên hệ thống.',
        });
      }

      if (user.active === false) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_INACTIVE_ACCOUNT,
          message: 'Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt.',
        });
      }

      role = user.vai_tro;
    }

    return {
      id: userId,
      sub: userId,
      username: payload.preferred_username || payload.username || '',
      role: role || 'USER',
      keycloakUserId: payload.keycloakUserId,
      ...(payload.email ? { email: payload.email } : {}),
    };
  }
}
