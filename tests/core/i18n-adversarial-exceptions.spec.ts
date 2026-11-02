import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Module,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { I18nModule } from '../../src/core/i18n/i18n.module';
import { I18nService } from '../../src/core/i18n/i18n.service';
import { I18nLocaleMiddleware } from '../../src/common/middlewares/i18n-locale.middleware';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

class TestHostileDto {
  @IsNotEmpty({ message: 'validation.auth.email_required' })
  @IsEmail({}, { message: 'validation.auth.email_invalid' })
  email: string;

  @IsNotEmpty({ message: 'validation.users.username_required' })
  @IsString({ message: 'validation.users.username_must_be_string' })
  username: string;
}

@Controller('adversarial-i18n')
class AdversarialTestController {
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  testValidate(@Body() dto: TestHostileDto) {
    return { data: dto };
  }

  @Get('auth-username-exists')
  throwAuthUsernameExists() {
    throw new ConflictException('error.auth.username_exists');
  }

  @Get('auth-email-exists')
  throwAuthEmailExists() {
    throw new ConflictException('error.auth.email_exists');
  }

  @Get('users-user-not-found')
  throwUserNotFound() {
    throw new NotFoundException('error.users.user_not_found');
  }

  @Get('subscriptions-package-not-found')
  throwSubscriptionPackageNotFound() {
    throw new NotFoundException('error.subscriptions.package_not_found');
  }

  @Get('patients-excel-no-data')
  throwPatientsExcelNoData() {
    throw new BadRequestException('error.patients.excel_no_data');
  }

  @Get('nutrition-guide-not-found')
  throwNutritionGuideNotFound() {
    throw new NotFoundException('error.nutrition_guide.not_found');
  }

  @Get('nutrition-guides-code-exists')
  throwNutritionGuidesCodeExists() {
    throw new ConflictException('error.nutrition_guides.code_exists');
  }

  @Get('profiles-user-disabled')
  throwProfilesUserDisabled() {
    throw new NotFoundException('error.profiles.user_not_found_or_disabled');
  }
}

@Module({
  imports: [I18nModule],
  controllers: [AdversarialTestController],
})
class AdversarialTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nLocaleMiddleware).forRoutes('*');
  }
}

describe('Adversarial & Deep 3-Layer I18n Exceptions Verification Suite', () => {
  let app: INestApplication;
  let i18nService: I18nService;
  let viCatalog: Record<string, string>;
  let enCatalog: Record<string, string>;
  let zhCatalog: Record<string, string>;

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AdversarialTestModule],
    }).compile();

    app = fixture.createNestApplication();
    i18nService = app.get<I18nService>(I18nService);

    app.useGlobalPipes(new CustomValidationPipe(i18nService));
    app.useGlobalFilters(new GlobalExceptionFilter(i18nService));

    await app.init();

    const i18nDir = path.resolve(__dirname, '../../src/i18n');
    viCatalog = JSON.parse(fs.readFileSync(path.join(i18nDir, 'vi.json'), 'utf8'));
    enCatalog = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
    zhCatalog = JSON.parse(fs.readFileSync(path.join(i18nDir, 'zh.json'), 'utf8'));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /* =========================================================================
   * LAYER 1 & 2 & 3: CONVERTED KEYS PARITY ACROSS ALL THREE LOCALES
   * ========================================================================= */
  describe('[Layer 2: Contract Integrity] Verify 100% Locale Parity on Refactored Keys', () => {
    const convertedKeys = [
      // Auth service
      'error.auth.username_exists',
      'error.auth.email_exists',
      'error.auth.pending_verification',
      'error.auth.verification_code_invalid',
      'error.auth.verification_code_not_found_or_active',
      'error.auth.verification_code_expired_reregister',
      'error.auth.google_missing_token',
      'error.auth.verification_code_used',
      'error.auth.verification_code_expired_reissue',
      'error.auth.password_cannot_be_old',
      // Users controller & service
      'error.users.user_id_required_role',
      'error.users.user_id_required_status',
      'error.users.active_boolean_required',
      'error.users.user_not_found',
      'error.users.user_info_not_found',
      'error.users.user_not_exists',
      'error.users.user_to_assign_not_found',
      'error.users.user_to_update_status_not_found',
      'error.users.user_disabled_or_not_found',
      'error.users.user_deleted_or_not_found',
      'error.users.user_ids_required',
      'error.users.cannot_delete_self',
      'error.users.cannot_lock_self',
      'error.users.create_list_required',
      'error.users.duplicate_username_in_payload',
      'error.users.duplicate_email_in_payload',
      // Subscriptions service
      'error.subscriptions.package_code_required',
      'error.subscriptions.package_name_required',
      'error.subscriptions.package_code_exists',
      'error.subscriptions.package_not_found',
      'error.subscriptions.package_not_available',
      'error.subscriptions.user_not_found',
      'error.subscriptions.proof_url_invalid',
      'error.subscriptions.object_key_invalid',
      'error.subscriptions.payment_request_not_found',
      'error.subscriptions.payment_invalid_status',
      'error.subscriptions.payment_already_processed',
      // Patient excel service
      'error.patients.excel_no_data',
      'error.files.invalid_excel_format',
      'error.patients.excel_max_1000',
      'error.patients.excel_invalid_template',
      // Nutrition guides service
      'error.nutrition_guide.not_found',
      'error.nutrition_guides.code_exists',
      'error.nutrition_guide.in_use',
      // Profiles service
      'error.profiles.user_not_found_or_disabled',
    ];

    it.each(convertedKeys)(
      'Key "%s" must be defined non-empty across vi, en, zh catalogs',
      (key) => {
        expect(viCatalog[key]).toBeDefined();
        expect(typeof viCatalog[key]).toBe('string');
        expect(viCatalog[key].trim().length).toBeGreaterThan(0);

        expect(enCatalog[key]).toBeDefined();
        expect(typeof enCatalog[key]).toBe('string');
        expect(enCatalog[key].trim().length).toBeGreaterThan(0);

        expect(zhCatalog[key]).toBeDefined();
        expect(typeof zhCatalog[key]).toBe('string');
        expect(zhCatalog[key].trim().length).toBeGreaterThan(0);
      },
    );
  });

  /* =========================================================================
   * ENEMY PERSONA 1: THE STUPID BOT
   * Rapid-fire concurrent burst requests hammering the endpoint
   * ========================================================================= */
  describe('[Enemy Persona 1: The Stupid Bot] High-frequency Concurrency Burst', () => {
    it('L1 + L2: Should handle 50 rapid-fire concurrent requests with valid locale translation and intact error envelope', async () => {
      const burstCount = 50;
      const requests = Array.from({ length: burstCount }, (_, idx) => {
        const locale = idx % 3 === 0 ? 'vi' : idx % 3 === 1 ? 'en' : 'zh';
        return request(app.getHttpServer())
          .get(`/adversarial-i18n/auth-username-exists?lang=${locale}`)
          .set('X-Trace-Id', `burst-trace-${idx}`);
      });

      const responses = await Promise.all(requests);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const locale = i % 3 === 0 ? 'vi' : i % 3 === 1 ? 'en' : 'zh';

        expect(res.status).toBe(HttpStatus.CONFLICT);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.meta).toHaveProperty('traceId');

        if (locale === 'vi') {
          expect(res.body.message).toBe('Tên đăng nhập đã tồn tại trong hệ thống.');
        } else if (locale === 'en') {
          expect(res.body.message).toBe('Username already exists in the system.');
        } else {
          expect(res.body.message).toBe('该用户名已存在于系统中。');
        }
      }
    });
  });

  /* =========================================================================
   * ENEMY PERSONA 2: THE AMATEUR HACKER
   * Hostile injection vectors: SQLi quotes, Script tags, Path Traversal in headers
   * ========================================================================= */
  describe('[Enemy Persona 2: The Amateur Hacker] Hostile Input Vectors & Injection', () => {
    it('L1 + L2: Should safely handle SQL injection in Accept-Language without crash or leakage', async () => {
      const hostileHeader = "vi-VN,vi;q=0.9; DROP TABLE nguoi_dung; --'";
      const res = await request(app.getHttpServer())
        .get('/adversarial-i18n/users-user-not-found')
        .set('Accept-Language', hostileHeader);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(res.body.message).toBe('Không tìm thấy người dùng với ID này.');
    });

    it('L1 + L2: Should safely handle Path Traversal payload in ?lang query parameter', async () => {
      const res = await request(app.getHttpServer()).get(
        '/adversarial-i18n/subscriptions-package-not-found?lang=../../../../etc/passwd',
      );

      // Must safely fallback to default locale 'vi' without throwing 500
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(res.body.message).toBe('Gói cước không tồn tại.');
    });

    it('L1 + L2: Type Smashing in validation endpoint (arrays in string fields, null values)', async () => {
      const res = await request(app.getHttpServer())
        .post('/adversarial-i18n/validate?lang=en')
        .send({
          email: ['nested_array_injection@exploit.com'],
          username: { hacked: true },
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });
  });

  /* =========================================================================
   * ENEMY PERSONA 3: THE BROKEN CABLE NETWORK
   * Unsupported locales, corrupted Accept-Language headers, empty bodies
   * ========================================================================= */
  describe('[Enemy Persona 3: The Broken Cable Network] Resilient Fallback & Boundary', () => {
    it('L1 + L2: Corrupted or non-supported locale (de, fr, es) must cleanly fallback to default locale (vi)', async () => {
      const res = await request(app.getHttpServer())
        .get('/adversarial-i18n/nutrition-guide-not-found?lang=fr')
        .set('Accept-Language', 'de-DE,de;q=0.9');

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toBe('Không tìm thấy hướng dẫn dinh dưỡng');
    });

    it('L1 + L2: Empty payload validation with multi-language detail translation', async () => {
      // Test English validation message extraction
      const resEn = await request(app.getHttpServer())
        .post('/adversarial-i18n/validate')
        .set('Accept-Language', 'en')
        .send({});

      expect(resEn.status).toBe(HttpStatus.BAD_REQUEST);
      expect(resEn.body.error.code).toBe('VALIDATION_FAILED');
      expect(Array.isArray(resEn.body.error.details)).toBe(true);

      const emailDetails = resEn.body.error.details.filter((d: any) => d.field === 'email');
      expect(emailDetails.length).toBeGreaterThan(0);
      const hasEmailMsg = emailDetails.some((d: any) =>
        /Email (?:is required|format is invalid)/i.test(d.message),
      );
      expect(hasEmailMsg).toBe(true);

      // Test Chinese validation message extraction
      const resZh = await request(app.getHttpServer())
        .post('/adversarial-i18n/validate')
        .set('Accept-Language', 'zh')
        .send({});

      expect(resZh.status).toBe(HttpStatus.BAD_REQUEST);
      const emailDetailsZh = resZh.body.error.details.filter((d: any) => d.field === 'email');
      expect(emailDetailsZh.length).toBeGreaterThan(0);
      const hasEmailZh = emailDetailsZh.some((d: any) =>
        /(?:电子邮箱\s*不能为空|邮箱格式无效)/.test(d.message),
      );
      expect(hasEmailZh).toBe(true);
    });
  });
});
