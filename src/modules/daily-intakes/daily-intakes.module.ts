import { Module } from '@nestjs/common';
import { DailyIntakesController } from './controllers/daily-intakes.controller';
import { DailyIntakesService } from './services/daily-intakes.service';
import { DailyIntakeExcelService } from './services/daily-intake-excel.service';
import { DailyIntakeReportStreamService } from './services/daily-intake-report-stream.service';
import { NutritionEngineModule } from '../../core/nutrition-engine/nutrition-engine.module';

@Module({
  imports: [NutritionEngineModule],
  controllers: [DailyIntakesController],
  providers: [DailyIntakesService, DailyIntakeExcelService, DailyIntakeReportStreamService],
  exports: [DailyIntakesService, DailyIntakeExcelService, DailyIntakeReportStreamService],
})
export class DailyIntakesModule {}
