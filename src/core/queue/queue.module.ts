import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { MysqlQueueService } from './mysql-queue.service';
import { EmbeddedQueueWorkerService } from './embedded-queue-worker.service';
import { InMemoryMailerService, MAILER_SERVICE_TOKEN } from './in-memory-mailer.service';
import { SmtpMailerService } from './smtp-mailer.service';
import { EmailTemplateService } from './email-template.service';
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
    SmtpMailerService,
    {
      provide: InMemoryMailerService,
      useExisting: SmtpMailerService,
    },
    {
      provide: MAILER_SERVICE_TOKEN,
      useExisting: SmtpMailerService,
    },
    EmailTemplateService,
  ],
  exports: [
    MysqlQueueService,
    QUEUE_SERVICE_TOKEN,
    EmbeddedQueueWorkerService,
    InMemoryMailerService,
    SmtpMailerService,
    MAILER_SERVICE_TOKEN,
    EmailTemplateService,
  ],
})
export class QueueModule {}
