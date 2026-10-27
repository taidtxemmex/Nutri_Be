import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../database/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { AccountDowngradeCronService } from './account-downgrade-cron.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, CacheModule],
  providers: [AccountDowngradeCronService],
  exports: [AccountDowngradeCronService],
})
export class CronModule {}
