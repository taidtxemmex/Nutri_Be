import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TransformResponseInterceptor } from '../../src/common/interceptors/transform-response.interceptor';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { I18nService } from '../../src/core/i18n/i18n.service';
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
    const i18nService = moduleFixture.get<I18nService>(I18nService);

    // 1. URL rewrite middleware tương thích tuyệt đối với main.ts: Maps legacy /api/v1/* to /api/*
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.url.startsWith('/api/v1/')) {
        req.url = req.url.replace('/api/v1/', '/api/');
      }
      next();
    });

    // 2. Global Prefix: api (đồng bộ chuẩn hóa tuyệt đối với main.ts)
    this.app.setGlobalPrefix('api');

    // 3. Global pipes, interceptors, filters
    this.app.useGlobalPipes(new CustomValidationPipe(i18nService));
    this.app.useGlobalInterceptors(new TransformResponseInterceptor());
    this.app.useGlobalFilters(new GlobalExceptionFilter(i18nService));

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
      'minh_chung',
      'chi_tiet_thuc_don',
      'de_xuat_thuc_don',
      'khau_phan_24h_nguyen_lieu',
      'khau_phan_24h_bua_an',
      'khau_phan_24h',
      'chi_tiet_bua_an',
      'bua_an',
      'chi_tiet_mon_an',
      'mon_an',
      'he_so_song_chin',
      'de_xuat_nguyen_lieu',
      'gioi_han_dinh_duong',
      'thuc_don',
      'benh_nhan',
      'nguyen_lieu',
      'danh_muc',
      'nhom_benh_mo_rong',
      'nhom_benh',
      'ho_so_ca_nhan',
      'lich_su_dang_nhap',
      'thiet_bi_dang_nhap',
      'ma_xac_thuc',
      'nguoi_de_xuat',
      'dang_ky_cho_xac_thuc',
      'dang_ky',
      'yeu_cau_thanh_toan',
      '_system_jobs_dlq',
      '_system_jobs',
      '_system_cache',
      'nguoi_dung',
    ];

    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
      } catch {
        // Bỏ qua nếu bảng không tồn tại
      }
    }
    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
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

  /**
   * Khởi tạo hàng loạt người dùng mẫu trong CSDL bằng Batch Transaction (Rule 20)
   */
  async createTestUsers(
    usersList: Array<{
      username: string;
      password?: string;
      role?: 'USER' | 'USERPRO' | 'ADMIN' | 'SUPERADMIN';
      fullName?: string;
      email?: string;
      active?: boolean;
    }>,
  ): Promise<any[]> {
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash('P@ssw0rd123!', salt);

    const ops = usersList.map((params) => {
      const userId = crypto.randomUUID();
      const role = params.role || 'USER';
      const email = params.email || `${params.username.toLowerCase()}@nutritest.com`;
      const fullName = params.fullName || `User ${params.username}`;

      return this.prisma.nguoi_dung.create({
        data: {
          id: userId,
          ten_dang_nhap: params.username,
          mat_khau: params.password ? bcrypt.hashSync(params.password, salt) : defaultHash,
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
      });
    });

    return this.prisma.$transaction(ops);
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }
}
