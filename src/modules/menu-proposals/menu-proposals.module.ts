import { Module } from '@nestjs/common';
import { MenuProposalsController } from './controllers/menu-proposals.controller';
import { MenuProposalsService } from './services/menu-proposals.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';
import { MenusModule } from '../menus/menus.module';

@Module({
  imports: [NutritionEngineModule, MenusModule],
  controllers: [MenuProposalsController],
  providers: [MenuProposalsService],
  exports: [MenuProposalsService],
})
export class MenuProposalsModule {}
