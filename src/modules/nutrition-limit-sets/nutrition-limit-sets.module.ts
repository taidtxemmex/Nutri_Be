import { Module } from '@nestjs/common';
import { NutritionLimitSetsController } from './controllers/nutrition-limit-sets.controller';
import { NutritionLimitSetsService } from './services/nutrition-limit-sets.service';

@Module({
  controllers: [NutritionLimitSetsController],
  providers: [NutritionLimitSetsService],
  exports: [NutritionLimitSetsService],
})
export class NutritionLimitSetsModule {}
