import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export class TestAppHelper {
  private app: INestApplication;
  private prisma: PrismaService;
  private jwtService: JwtService;

  async init(): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication<NestExpressApplication>();

    // 1. URL rewrite middleware tương thích tuyệt đối với main.ts
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.url.startsWith('/api/') && !req.url.startsWith('/api/v1/')) {
        req.url = req.url.replace('/api/', '/api/v1/');
      }
      next();
    });

    // 2. Global Prefix: api/v1
    this.app.setGlobalPrefix(process.env.GLOBAL_PREFIX || 'api/v1');

    // 3. Global pipes, interceptors, filters
    this.app.useGlobalPipes(new CustomValidationPipe());
    this.app.useGlobalInterceptors(new TransformResponseInterceptor());
    this.app.useGlobalFilters(new GlobalExceptionFilter());

    await this.app.init();

    this.prisma = this.app.get<PrismaService>(PrismaService);
    this.jwtService = this.app.get<JwtService>(JwtService);
  }

  getApp(): INestApplication {
    return this.app;
  }

  getHttpServer(): any {
    return this.app.getHttpServer();
  }

  getPrisma(): PrismaService {
    return this.prisma;
  }

  getJwtService(): JwtService {
    return this.jwtService;
  }

  /**
   * Reset các bảng trong MySQL nutri_test đảm bảo kiểm thử cô lập 100%
   */
  async cleanDatabase(): Promise<void> {
    const tables = [
      'lich_su_dang_nhap',
      'thiet_bi_dang_nhap',
      'ma_xac_thuc',
      'ho_so_ca_nhan',
      'nguoi_de_xuat',
      'dang_ky_cho_xac_thuc',
      'dang_ky',
      'yeu_cau_thanh_toan',
      'minh_chung',
      'khau_phan_24h_nguyen_lieu',
      'khau_phan_24h_bua_an',
      'khau_phan_24h',
      'de_xuat_thuc_don',
      'de_xuat_nguyen_lieu',
      'benh_nhan',
      'bua_an',
      'thuc_don',
      'mon_an',
      '_system_jobs',
      '_system_jobs_dlq',
      '_system_cache',
      'nguoi_dung',
    ];

    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
      } catch {
        // Bỏ qua nếu bảng trống hoặc không tồn tại
      }
    }
    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  }

  /**
   * Khởi tạo người dùng mẫu trong CSDL và sinh JWT Access Token chuẩn
   */
  async createTestUser(params: {
    username: string;
    password?: string;
    role?: 'USER' | 'USERPRO' | 'ADMIN' | 'SUPERADMIN';
    fullName?: string;
    email?: string;
    active?: boolean;
  }): Promise<{
    user: any;
    token: string;
    rawPassword: string;
  }> {
    const rawPassword = params.password || 'P@ssw0rd123!';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const userId = crypto.randomUUID();
    const role = params.role || 'USER';
    const email = params.email || `${params.username.toLowerCase()}@nutritest.com`;
    const fullName = params.fullName || `User ${params.username}`;

    const user = await this.prisma.nguoi_dung.create({
      data: {
        id: userId,
        ten_dang_nhap: params.username,
        mat_khau: hashedPassword,
        vai_tro: role as any,
        kenh: 'LOCAL',
        active: params.active !== undefined ? params.active : true,
        profile_completed: false,
        keycloak_user_id: userId,
        ho_so_ca_nhan: {
          create: {
            ho_ten: fullName,
            email: email,
            phone: '0987654321',
            dia_chi: 'Hà Nội',
            gioi_tinh: 'NAM',
          },
        },
      },
      include: {
        ho_so_ca_nhan: true,
      },
    });

    const jwtPayload = {
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
      family_name: 'Nutri',
      given_name: params.username,
      keycloakUserId: user.id,
    };

    const token = this.jwtService.sign(jwtPayload, { expiresIn: '15m' });

    return { user, token, rawPassword };
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }
}
