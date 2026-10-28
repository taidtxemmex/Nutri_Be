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
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  HttpException,
  Module,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { IsNotEmpty, MinLength, IsString } from 'class-validator';
import * as request from 'supertest';
import { Prisma } from '@prisma/client';
import { I18nModule } from '../../src/core/i18n/i18n.module';
import { I18nService } from '../../src/core/i18n/i18n.service';
import { I18nLocaleMiddleware } from '../../src/common/middlewares/i18n-locale.middleware';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

// 1. Khởi tạo Test DTOs
export class CustomMessageDto {
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  username: string;

  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;
}

export class DefaultConstraintDto {
  @IsNotEmpty()
  @IsString()
  username: string;
}

// 2. Khởi tạo Test Controller chuyên biệt phục vụ kiểm thử
@Controller('test-i18n')
export class TestI18nController {
  @Post('dto-custom')
  @HttpCode(HttpStatus.OK)
  testCustomDto(@Body() dto: CustomMessageDto) {
    return { data: dto };
  }

  @Post('dto-default')
  @HttpCode(HttpStatus.OK)
  testDefaultDto(@Body() dto: DefaultConstraintDto) {
    return { data: dto };
  }

  @Get('not-found')
  throwNotFound() {
    throw new NotFoundException('RESOURCE_NOT_FOUND');
  }

  @Get('bad-request')
  throwBadRequest() {
    throw new BadRequestException('BAD_REQUEST');
  }

  @Get('forbidden')
  throwForbidden() {
    throw new ForbiddenException('FORBIDDEN_RESOURCE');
  }

  @Get('unauthorized')
  throwUnauthorized() {
    throw new UnauthorizedException('AUTH_UNAUTHORIZED');
  }

  @Get('conflict')
  throwConflict() {
    throw new ConflictException('RESOURCE_CONFLICT');
  }

  @Get('too-many-requests')
  throwTooManyRequests() {
    throw new HttpException('TOO_MANY_REQUESTS', HttpStatus.TOO_MANY_REQUESTS);
  }

  @Get('prisma-p2002')
  throwPrismaP2002() {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
      code: 'P2002',
      clientVersion: '5.x',
      meta: { target: ['email'] },
    });
  }

  @Get('prisma-p2025')
  throwPrismaP2025() {
    throw new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.x',
    });
  }

  @Get('prisma-p2003')
  throwPrismaP2003() {
    throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint violation', {
      code: 'P2003',
      clientVersion: '5.x',
    });
  }
}

@Module({
  imports: [I18nModule],
  controllers: [TestI18nController],
})
export class TestI18nAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nLocaleMiddleware).forRoutes('*');
  }
}

describe('Multilingual Validation & System Exceptions E2E Tests (vi, en, zh)', () => {
  let app: INestApplication;
  let i18nService: I18nService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestI18nAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    i18nService = app.get<I18nService>(I18nService);

    app.useGlobalPipes(new CustomValidationPipe(i18nService));
    app.useGlobalFilters(new GlobalExceptionFilter(i18nService));

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Helper kiểm tra Universal Response Envelope bắt buộc cho lỗi
   */
  const assertErrorEnvelope = (
    res: request.Response,
    expectedStatus: number,
    expectedCode: string,
  ) => {
    expect(res.status).toBe(expectedStatus);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.error.code).toBe(expectedCode);
    expect(res.body.error.message).toBe(res.body.message);
    expect(res.body.meta).toHaveProperty('timestamp');
    expect(res.body.meta).toHaveProperty('traceId');
    expect(typeof res.body.meta.traceId).toBe('string');
    expect(new Date(res.body.meta.timestamp).toISOString()).toBe(res.body.meta.timestamp);
  };

  // =========================================================================
  // SUITE 1: DTO VALIDATION ĐA NGÔN NGỮ (vi, en, zh)
  // =========================================================================
  describe('1. DTO Validation Multilingual Support', () => {
    describe('Custom Annotations (@IsNotEmpty, @MinLength with custom messages)', () => {
      it('Test 1 (Tiếng Việt - Mặc định): Trả về thông báo tiếng Việt khi không truyền locale hoặc truyền vi', async () => {
        // Trường hợp 1: Không có header Accept-Language
        const resDefault = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom')
          .send({});

        assertErrorEnvelope(resDefault, 400, 'VALIDATION_FAILED');
        expect(resDefault.body.message).toMatch(
          /(?:Dữ liệu gửi lên không đúng định dạng|Xác thực dữ liệu thất bại)/,
        );
        expect(Array.isArray(resDefault.body.error.details)).toBe(true);

        const usernameErr = resDefault.body.error.details.find((d: any) => d.field === 'username');
        expect(usernameErr).toBeDefined();
        expect(usernameErr.message).toBe('Tên đăng nhập không được để trống');

        // Trường hợp 2: Gửi kèm query ?lang=vi
        const resQuery = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom?lang=vi')
          .send({ username: 'validUser', password: '123' });

        assertErrorEnvelope(resQuery, 400, 'VALIDATION_FAILED');
        const passErr = resQuery.body.error.details.find((d: any) => d.field === 'password');
        expect(passErr).toBeDefined();
        expect(passErr.message).toContain('Mật khẩu tối thiểu 6 ký tự');
      });

      it('Test 2 (Tiếng Anh): Trả về thông báo tiếng Anh khi gửi Accept-Language: en hoặc ?lang=en', async () => {
        // Kiểm tra qua Header Accept-Language: en
        const resHeader = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom')
          .set('Accept-Language', 'en')
          .send({});

        assertErrorEnvelope(resHeader, 400, 'VALIDATION_FAILED');
        expect(resHeader.body.message).toMatch(
          /(?:Submitted data is invalid or malformed|Validation failed)/,
        );

        const userErr = resHeader.body.error.details.find((d: any) => d.field === 'username');
        expect(userErr).toBeDefined();
        expect(userErr.message).toMatch(/Username (?:should not|cannot) be empty/i);

        // Kiểm tra minLength qua query ?lang=en
        const resQuery = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom?lang=en')
          .send({ username: 'validUser', password: '123' });

        assertErrorEnvelope(resQuery, 400, 'VALIDATION_FAILED');
        const passErr = resQuery.body.error.details.find((d: any) => d.field === 'password');
        expect(passErr).toBeDefined();
        expect(passErr.message).toMatch(
          /Password must be (?:longer than or equal to|at least) 6 characters/i,
        );
      });

      it('Test 3 (Tiếng Trung): Trả về thông báo tiếng Trung khi gửi Accept-Language: zh hoặc ?lang=zh', async () => {
        // Kiểm tra qua Header Accept-Language: zh
        const resHeader = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom')
          .set('Accept-Language', 'zh')
          .send({});

        assertErrorEnvelope(resHeader, 400, 'VALIDATION_FAILED');
        expect(resHeader.body.message).toMatch(/(?:提交的数据格式不正确或无效|验证失败)/);

        const userErr = resHeader.body.error.details.find((d: any) => d.field === 'username');
        expect(userErr).toBeDefined();
        expect(userErr.message).toMatch(/用户名\s*不能为空/);

        // Kiểm tra minLength qua query ?lang=zh
        const resQuery = await request(app.getHttpServer())
          .post('/test-i18n/dto-custom?lang=zh')
          .send({ username: 'validUser', password: '123' });

        assertErrorEnvelope(resQuery, 400, 'VALIDATION_FAILED');
        const passErr = resQuery.body.error.details.find((d: any) => d.field === 'password');
        expect(passErr).toBeDefined();
        expect(passErr.message).toMatch(/密码\s*(?:必须至少为|长度至少为)\s*6\s*个字符/);
      });
    });

    describe('Test 4 (Class-validator default constraints không có custom message)', () => {
      it('Dịch tự động sang Tiếng Việt khi lang=vi', async () => {
        const res = await request(app.getHttpServer())
          .post('/test-i18n/dto-default?lang=vi')
          .send({});

        assertErrorEnvelope(res, 400, 'VALIDATION_FAILED');
        const emptyErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISNOTEMPTY',
        );
        expect(emptyErr).toBeDefined();
        expect(emptyErr.message).toBe('Tên đăng nhập không được để trống');

        const stringErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISSTRING',
        );
        expect(stringErr).toBeDefined();
        expect(stringErr.message).toBe('Tên đăng nhập phải là chuỗi ký tự');
      });

      it('Dịch tự động sang Tiếng Anh khi lang=en', async () => {
        const res = await request(app.getHttpServer())
          .post('/test-i18n/dto-default?lang=en')
          .send({});

        assertErrorEnvelope(res, 400, 'VALIDATION_FAILED');
        const emptyErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISNOTEMPTY',
        );
        expect(emptyErr).toBeDefined();
        expect(emptyErr.message).toMatch(/Username (?:should not|cannot) be empty/i);

        const stringErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISSTRING',
        );
        expect(stringErr).toBeDefined();
        expect(stringErr.message).toBe('Username must be a string');
      });

      it('Dịch tự động sang Tiếng Trung khi lang=zh', async () => {
        const res = await request(app.getHttpServer())
          .post('/test-i18n/dto-default?lang=zh')
          .send({});

        assertErrorEnvelope(res, 400, 'VALIDATION_FAILED');
        const emptyErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISNOTEMPTY',
        );
        expect(emptyErr).toBeDefined();
        expect(emptyErr.message).toMatch(/用户名\s*不能为空/);

        const stringErr = res.body.error.details.find(
          (d: any) => d.field === 'username' && d.code === 'ISSTRING',
        );
        expect(stringErr).toBeDefined();
        expect(stringErr.message).toMatch(/用户名\s*必须是字符串/);
      });
    });
  });

  // =========================================================================
  // SUITE 2: SYSTEM EXCEPTIONS ĐA NGÔN NGỮ (vi, en, zh)
  // =========================================================================
  describe('2. System Exceptions Multilingual Support', () => {
    describe('NotFoundException (404)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/not-found?lang=vi');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('Không tìm thấy tài nguyên yêu cầu');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/not-found?lang=en');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('Requested resource not found');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/not-found?lang=zh');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('未找到请求的资源');
      });
    });

    describe('BadRequestException (400)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/bad-request?lang=vi');
        assertErrorEnvelope(res, 400, 'BAD_REQUEST');
        expect(res.body.message).toBe('Yêu cầu không hợp lệ');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/bad-request?lang=en');
        assertErrorEnvelope(res, 400, 'BAD_REQUEST');
        expect(res.body.message).toBe('Bad request');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/bad-request?lang=zh');
        assertErrorEnvelope(res, 400, 'BAD_REQUEST');
        expect(res.body.message).toBe('无效请求');
      });
    });

    describe('ForbiddenException (403)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/forbidden?lang=vi');
        assertErrorEnvelope(res, 403, 'FORBIDDEN_RESOURCE');
        expect(res.body.message).toBe('Bạn không có quyền truy cập tài nguyên này');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/forbidden?lang=en');
        assertErrorEnvelope(res, 403, 'FORBIDDEN_RESOURCE');
        expect(res.body.message).toBe('You do not have permission to access this resource');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/forbidden?lang=zh');
        assertErrorEnvelope(res, 403, 'FORBIDDEN_RESOURCE');
        expect(res.body.message).toBe('您没有权限访问此资源');
      });
    });

    describe('UnauthorizedException (401)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/unauthorized?lang=vi');
        assertErrorEnvelope(res, 401, 'AUTH_UNAUTHORIZED');
        expect(res.body.message).toBe('Yêu cầu đăng nhập hoặc phiên làm việc không hợp lệ');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/unauthorized?lang=en');
        assertErrorEnvelope(res, 401, 'AUTH_UNAUTHORIZED');
        expect(res.body.message).toBe('Authentication required or invalid session');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/unauthorized?lang=zh');
        assertErrorEnvelope(res, 401, 'AUTH_UNAUTHORIZED');
        expect(res.body.message).toBe('需要身份验证或登录会话无效');
      });
    });

    describe('ConflictException (409)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/conflict?lang=vi');
        assertErrorEnvelope(res, 409, 'RESOURCE_CONFLICT');
        expect(res.body.message).toBe('Xung đột dữ liệu hệ thống');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/conflict?lang=en');
        assertErrorEnvelope(res, 409, 'RESOURCE_CONFLICT');
        expect(res.body.message).toBe('System resource conflict');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/conflict?lang=zh');
        assertErrorEnvelope(res, 409, 'RESOURCE_CONFLICT');
        expect(res.body.message).toBe('系统资源冲突');
      });
    });

    describe('TooManyRequests Exception (429)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/too-many-requests?lang=vi');
        assertErrorEnvelope(res, 429, 'TOO_MANY_REQUESTS');
        expect(res.body.message).toBe('Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/too-many-requests?lang=en');
        assertErrorEnvelope(res, 429, 'TOO_MANY_REQUESTS');
        expect(res.body.message).toBe('Too many requests. Please try again later.');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/too-many-requests?lang=zh');
        assertErrorEnvelope(res, 429, 'TOO_MANY_REQUESTS');
        expect(res.body.message).toBe('请求过多，请稍后再试。');
      });
    });
  });

  // =========================================================================
  // SUITE 3: PRISMA ORM EXCEPTIONS ĐA NGÔN NGỮ (vi, en, zh)
  // =========================================================================
  describe('3. Prisma ORM Exceptions Multilingual Support', () => {
    describe('P2002: Unique Constraint Violation (409 DATA_CONFLICT)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2002?lang=vi');
        assertErrorEnvelope(res, 409, 'DATA_CONFLICT');
        expect(res.body.message).toBe('Dữ liệu đã tồn tại trong hệ thống (vi phạm tính duy nhất)');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2002?lang=en');
        assertErrorEnvelope(res, 409, 'DATA_CONFLICT');
        expect(res.body.message).toBe(
          'Data already exists in the system (unique constraint violation)',
        );
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2002?lang=zh');
        assertErrorEnvelope(res, 409, 'DATA_CONFLICT');
        expect(res.body.message).toBe('数据已存在于系统中（违反唯一性约束）');
      });
    });

    describe('P2025: Record Not Found (404 RESOURCE_NOT_FOUND)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2025?lang=vi');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('Không tìm thấy tài nguyên yêu cầu');
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2025?lang=en');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('Requested resource not found');
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2025?lang=zh');
        assertErrorEnvelope(res, 404, 'RESOURCE_NOT_FOUND');
        expect(res.body.message).toBe('未找到请求的资源');
      });
    });

    describe('P2003: Foreign Key Constraint Violation (400 FOREIGN_KEY_CONSTRAINT_VIOLATION)', () => {
      it('Dịch chính xác tiếng Việt', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2003?lang=vi');
        assertErrorEnvelope(res, 400, 'FOREIGN_KEY_CONSTRAINT_VIOLATION');
        expect(res.body.message).toBe(
          'Không thể thực hiện thao tác do dữ liệu đang được sử dụng ở bảng khác',
        );
      });

      it('Dịch chính xác tiếng Anh', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2003?lang=en');
        assertErrorEnvelope(res, 400, 'FOREIGN_KEY_CONSTRAINT_VIOLATION');
        expect(res.body.message).toBe(
          'Cannot perform operation because data is in use by another entity',
        );
      });

      it('Dịch chính xác tiếng Trung', async () => {
        const res = await request(app.getHttpServer()).get('/test-i18n/prisma-p2003?lang=zh');
        assertErrorEnvelope(res, 400, 'FOREIGN_KEY_CONSTRAINT_VIOLATION');
        expect(res.body.message).toBe('无法执行此操作，因为该数据已被其他实体关联使用');
      });
    });
  });

  // =========================================================================
  // SUITE 4: CẤU TRÚC RESPONSE ENVELOPE THEO QUY CHUẨN
  // =========================================================================
  describe('4. Universal Error Response Envelope Verification', () => {
    it('Phải đảm bảo 100% phản hồi lỗi chứa message, error, meta và X-Trace-Id header', async () => {
      const res = await request(app.getHttpServer()).get('/test-i18n/not-found');
      expect(res.headers['x-trace-id']).toBeDefined();
      expect(res.body).toEqual({
        message: expect.any(String),
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: expect.any(String),
        },
        meta: {
          timestamp: expect.any(String),
          traceId: expect.any(String),
        },
      });
    });
  });
});
