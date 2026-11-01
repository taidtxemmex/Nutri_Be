import { Module } from '@nestjs/common';
import { ExtendedDiseaseGroupsController } from './controllers/extended-disease-groups.controller';
import { ExtendedDiseaseGroupsService } from './services/extended-disease-groups.service';
import { ExtendedDiseaseGroupsImportService } from './services/extended-disease-groups-import.service';

@Module({
  controllers: [ExtendedDiseaseGroupsController],
  providers: [ExtendedDiseaseGroupsService, ExtendedDiseaseGroupsImportService],
  exports: [ExtendedDiseaseGroupsService, ExtendedDiseaseGroupsImportService],
})
export class ExtendedDiseaseGroupsModule {}
