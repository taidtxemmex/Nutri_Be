import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { Request, Response, NextFunction } from 'express';
import {
  PUBLIC_UPLOAD_DIR,
  STATIC_UPLOAD_PREFIX,
  ensureUploadDirsExist,
} from './config/upload.constants';
import { I18nService } from './core/i18n/i18n.service';
import { applySecurityHeaders } from './security/headers/helmet.config';
import { createCorsOptions } from './security/cors/cors.config';
import { createSwaggerAuthMiddleware } from './security/swagger/swagger-auth.middleware';
import { validateProductionSecrets } from './security/validation/security-secrets.validator';
import { WinstonLoggerService } from './core/logger/winston-logger.service';

async function bootstrap() {
  const winstonLogger = new WinstonLoggerService();
  const logger = new Logger('Bootstrap');

  // 0. Fail-fast validation of critical security variables & secrets
  validateProductionSecrets();

  // Đảm bảo cây thư mục phân cấp bảo mật uploads tồn tại
  ensureUploadDirsExist();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
  });

  // 0.1. Cấu hình giới hạn kích thước request body 20MB (đồng bộ với Java Spring Boot, hỗ trợ thực đơn 30 ngày & ảnh Base64)
  app.useBodyParser('json', { limit: '20mb' });
  app.useBodyParser('urlencoded', { limit: '20mb', extended: true });

  // 1. HTTP Security Headers (Helmet, noSniff, HSTS, SAMEORIGIN, strip X-Powered-By)
  applySecurityHeaders(app);

  // 2. Static Asset Serving: CHỈ phục vụ thư mục công khai (/uploads/public/* -> public/uploads/public/)
  // Tuyệt đối CẤM mount thư mục protected/ (chứng chỉ, minh chứng y tế, bệnh án, hóa đơn)
  app.useStaticAssets(PUBLIC_UPLOAD_DIR, {
    prefix: `${STATIC_UPLOAD_PREFIX}/`,
  });

  // 3. URL Rewriting Middleware: Maps legacy /api/v1/* to /api/* for seamless transition
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace('/api/v1/', '/api/');
    }
    next();
  });

  // 4. Global Prefix: api
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // 5. Hardened CORS Configuration (Strict whitelist, credentials, exposed headers)
  app.enableCors(createCorsOptions());

  // 6. Global Validation, Interceptors, Filters (Inject I18nService vào Pipe & Filter)
  const i18nService = app.get(I18nService);
  app.useGlobalPipes(new CustomValidationPipe(i18nService));
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new TransformResponseInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(i18nService));

  // 7. Swagger OpenAPI UI Hardening (Basic Auth Protection & Production Disable Gate)
  const isProduction = process.env.NODE_ENV === 'production';
  const isSwaggerEnabled = process.env.ENABLE_SWAGGER === 'true';

  if (!isProduction || isSwaggerEnabled) {
    // Áp dụng HTTP Basic Auth middleware bảo vệ endpoint tài liệu
    const swaggerAuth = createSwaggerAuthMiddleware();
    app.use(`/${globalPrefix}/docs`, swaggerAuth);
    app.use(`/${globalPrefix}/docs-json`, swaggerAuth);
    app.use(`/${globalPrefix}/docs-yaml`, swaggerAuth);

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nutri Clinical Nutrition API')
      .setDescription('Nutri Clinical Nutrition & Diet Management System RESTful API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT Access Token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`📚 Swagger Docs mounted (Secured by Basic Auth) at: /${globalPrefix}/docs`);
  } else {
    logger.log(
      '🔒 Swagger Docs disabled in production environment (Zero Information Disclosure Gate)',
    );
  }

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`🚀 Application running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap error', err);
  process.exit(1);
});
