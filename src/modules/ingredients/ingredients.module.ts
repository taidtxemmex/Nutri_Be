import { Module } from '@nestjs/common';
import { IngredientsController } from './controllers/ingredients.controller';
import { IngredientExportController } from './controllers/ingredient-export.controller';
import { IngredientsService } from './services/ingredients.service';
import { IngredientExcelService } from './services/ingredient-excel.service';

@Module({
  controllers: [IngredientsController, IngredientExportController],
  providers: [IngredientsService, IngredientExcelService],
  exports: [IngredientsService, IngredientExcelService],
})
export class IngredientsModule {}
