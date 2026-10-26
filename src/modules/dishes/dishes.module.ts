import { Module } from '@nestjs/common';
import { DishesController } from './controllers/dishes.controller';
import { DishesService } from './services/dishes.service';
import { DishExcelService } from './services/dish-excel.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';

@Module({
  imports: [NutritionEngineModule],
  controllers: [DishesController],
  providers: [DishesService, DishExcelService],
  exports: [DishesService, DishExcelService],
})
export class DishesModule {}
