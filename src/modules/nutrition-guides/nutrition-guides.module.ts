import { Module } from '@nestjs/common';
import { NutritionGuidesController } from './controllers/nutrition-guides.controller';
import { NutritionGuidesService } from './services/nutrition-guides.service';

@Module({
  controllers: [NutritionGuidesController],
  providers: [NutritionGuidesService],
  exports: [NutritionGuidesService],
})
export class NutritionGuidesModule {}
