import { Module } from '@nestjs/common';
import { MenusController } from './controllers/menus.controller';
import { MenusService } from './services/menus.service';
import { MenuExcelService } from './services/menu-excel.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';

@Module({
  imports: [NutritionEngineModule],
  controllers: [MenusController],
  providers: [MenusService, MenuExcelService],
  exports: [MenusService, MenuExcelService],
})
export class MenusModule {}
