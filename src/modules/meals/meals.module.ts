import { Module } from '@nestjs/common';
import { MealsController } from './controllers/meals.controller';
import { MealsService } from './services/meals.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';

@Module({
  imports: [NutritionEngineModule],
  controllers: [MealsController],
  providers: [MealsService],
  exports: [MealsService],
})
export class MealsModule {}
