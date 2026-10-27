import { Module } from '@nestjs/common';
import { DailyIntakesController } from './controllers/daily-intakes.controller';
import { DailyIntakesService } from './services/daily-intakes.service';
import { DailyIntakeExcelService } from './services/daily-intake-excel.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';

@Module({
  imports: [NutritionEngineModule],
  controllers: [DailyIntakesController],
  providers: [DailyIntakesService, DailyIntakeExcelService],
  exports: [DailyIntakesService, DailyIntakeExcelService],
})
export class DailyIntakesModule {}
