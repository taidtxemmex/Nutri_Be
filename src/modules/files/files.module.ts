import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { LocalStorageService } from './services/local-storage.service';
import { FileMagicBytePipe } from './pipes/file-magic-byte.pipe';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FilesController],
  providers: [LocalStorageService, FileMagicBytePipe],
  exports: [LocalStorageService, FileMagicBytePipe],
})
export class FilesModule {}
