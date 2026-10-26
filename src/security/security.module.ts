import { Module, Global } from '@nestjs/common';
import { IdorDefenseService } from './idor/idor-defense.service';
import { IdorUserOwnershipGuard } from './idor/idor-user-ownership.guard';
import { AdminOnlyGuard } from './idor/admin-only.guard';
import { RefreshTokenRotationService } from './token/refresh-token-rotation.service';
import { AuthRateLimitGuard } from './rate-limit/auth-rate-limit.guard';
import { PrismaModule } from '../core/database/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    IdorDefenseService,
    IdorUserOwnershipGuard,
    AdminOnlyGuard,
    RefreshTokenRotationService,
    AuthRateLimitGuard,
  ],
  exports: [
    IdorDefenseService,
    IdorUserOwnershipGuard,
    AdminOnlyGuard,
    RefreshTokenRotationService,
    AuthRateLimitGuard,
  ],
})
export class SecurityModule {}
