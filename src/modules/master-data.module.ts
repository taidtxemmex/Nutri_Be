import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { DiseaseGroupsModule } from './disease-groups/disease-groups.module';
import { ExtendedDiseaseGroupsModule } from './extended-disease-groups/extended-disease-groups.module';
import { ProposersModule } from './proposers/proposers.module';

@Module({
  imports: [CategoriesModule, DiseaseGroupsModule, ExtendedDiseaseGroupsModule, ProposersModule],
  exports: [CategoriesModule, DiseaseGroupsModule, ExtendedDiseaseGroupsModule, ProposersModule],
})
export class MasterDataModule {}
