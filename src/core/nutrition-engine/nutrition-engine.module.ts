import { Global, Module } from '@nestjs/common';
import { NutritionCalculatorService } from './nutrition-calculator.service';

@Global()
@Module({
  providers: [NutritionCalculatorService],
  exports: [NutritionCalculatorService],
})
export class NutritionEngineModule {}
