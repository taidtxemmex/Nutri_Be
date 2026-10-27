import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { MysqlQueueService } from './mysql-queue.service';
import { EmbeddedQueueWorkerService } from './embedded-queue-worker.service';
import { InMemoryMailerService } from './in-memory-mailer.service';
import { QUEUE_SERVICE_TOKEN } from './queue.interface';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    MysqlQueueService,
    {
      provide: QUEUE_SERVICE_TOKEN,
      useExisting: MysqlQueueService,
    },
    EmbeddedQueueWorkerService,
    InMemoryMailerService,
  ],
  exports: [
    MysqlQueueService,
    QUEUE_SERVICE_TOKEN,
    EmbeddedQueueWorkerService,
    InMemoryMailerService,
  ],
})
export class QueueModule {}
