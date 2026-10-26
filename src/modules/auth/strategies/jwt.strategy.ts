import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  AUTH_ERROR_UNAUTHORIZED,
  AUTH_ERROR_INACTIVE_ACCOUNT,
} from '../../../config/constants/auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      'truenutri_super_secret_jwt_key_2026_clinical_nutrition_protect_token';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
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
      const user = await this.prisma.nguoi_dung.findUnique({
        where: { id: userId },
        select: { id: true, ten_dang_nhap: true, vai_tro: true, active: true },
      });

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
