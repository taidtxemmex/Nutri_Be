import { Module } from '@nestjs/common';
import { DiseaseGroupsController } from './controllers/disease-groups.controller';
import { DiseaseGroupsService } from './services/disease-groups.service';

@Module({
  controllers: [DiseaseGroupsController],
  providers: [DiseaseGroupsService],
  exports: [DiseaseGroupsService],
})
export class DiseaseGroupsModule {}
