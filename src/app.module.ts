import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/database/prisma.module';
import { CacheModule } from './core/cache/cache.module';
import { I18nModule } from './core/i18n/i18n.module';
import { I18nLocaleMiddleware } from './common/middlewares/i18n-locale.middleware';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    CacheModule,
    I18nModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nLocaleMiddleware).forRoutes('*');
  }
}
