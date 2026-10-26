import { Module } from '@nestjs/common';
import { EvidencesController } from './controllers/evidences.controller';
import { EvidencesService } from './services/evidences.service';
import { EvidenceStorageService } from './services/evidence-storage.service';

@Module({
  controllers: [EvidencesController],
  providers: [EvidencesService, EvidenceStorageService],
  exports: [EvidencesService, EvidenceStorageService],
})
export class EvidencesModule {}
