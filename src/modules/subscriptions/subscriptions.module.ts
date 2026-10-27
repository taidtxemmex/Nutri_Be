import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { CacheModule } from '../../core/cache/cache.module';
import { SubscriptionsService } from './services/subscriptions.service';
import { PlansController } from './controllers/plans.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [PlansController, SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
