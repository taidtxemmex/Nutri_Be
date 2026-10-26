import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomValidationPipe } from './common/pipes/custom-validation.pipe';
import { Request, Response, NextFunction } from 'express';
import { DEFAULT_UPLOAD_DIR, STATIC_UPLOAD_PREFIX } from './config/upload.constants';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 0. Static Asset Serving: /uploads/* maps directly to project public/uploads/*
  app.useStaticAssets(DEFAULT_UPLOAD_DIR, {
    prefix: `${STATIC_UPLOAD_PREFIX}/`,
  });

  // 1. URL Rewriting Middleware: Maps legacy /api/v1/* to /api/* for seamless transition
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace('/api/v1/', '/api/');
    }
    next();
  });

  // 2. Global Prefix: api
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // 3. CORS
  const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 4. Global Validation, Interceptors, Filters
  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 5. Swagger OpenAPI UI at /api/docs
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

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`🚀 Application running on: http://localhost:${port}/${globalPrefix}`);
  logger.log(`📚 Swagger Docs available at: http://localhost:${port}/${globalPrefix}/docs`);
}

bootstrap();
