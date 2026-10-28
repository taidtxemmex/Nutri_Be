import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdorDefenseService } from './idor/idor-defense.service';
import { IdorUserOwnershipGuard } from './idor/idor-user-ownership.guard';
import { AdminOnlyGuard } from './idor/admin-only.guard';
import { RefreshTokenRotationService } from './token/refresh-token-rotation.service';
import { AuthRateLimitGuard } from './rate-limit/auth-rate-limit.guard';
import { ThrottlerBehindProxyGuard } from './rate-limit/throttler-behind-proxy.guard';
import { ExcelMagicByteValidationPipe } from './excel/excel-magic-byte.pipe';
import { ExcelThrottleGuard } from './excel/excel-throttle.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { PrismaModule } from '../core/database/prisma.module';
import {
  THROTTLE_DEFAULT_LIMIT,
  THROTTLE_DEFAULT_TTL,
  THROTTLE_AUTH_LIMIT,
  THROTTLE_AUTH_TTL,
  THROTTLE_SENSITIVE_LIMIT,
  THROTTLE_SENSITIVE_TTL,
} from '../config/constants/auth.constants';

@Global()
@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE_DEFAULT_TTL * 1000, // 60s -> 60000ms
        limit: THROTTLE_DEFAULT_LIMIT, // 100 req / min
      },
      {
        name: 'auth',
        ttl: THROTTLE_AUTH_TTL * 1000, // 60s -> 60000ms
        limit: THROTTLE_AUTH_LIMIT, // 5 req / min cho /api/auth/login, /api/auth/register
      },
      {
        name: 'sensitive',
        ttl: THROTTLE_SENSITIVE_TTL * 1000, // 60s -> 60000ms
        limit: THROTTLE_SENSITIVE_LIMIT, // 3 req / min cho forgot-password, reset-password
      },
    ]),
  ],
  providers: [
    IdorDefenseService,
    IdorUserOwnershipGuard,
    AdminOnlyGuard,
    RefreshTokenRotationService,
    AuthRateLimitGuard,
    ExcelMagicByteValidationPipe,
    ExcelThrottleGuard,
    SubscriptionGuard,
    ThrottlerBehindProxyGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
  exports: [
    IdorDefenseService,
    IdorUserOwnershipGuard,
    AdminOnlyGuard,
    RefreshTokenRotationService,
    AuthRateLimitGuard,
    ExcelMagicByteValidationPipe,
    ExcelThrottleGuard,
    SubscriptionGuard,
    ThrottlerBehindProxyGuard,
    ThrottlerModule,
  ],
})
export class SecurityModule {}
