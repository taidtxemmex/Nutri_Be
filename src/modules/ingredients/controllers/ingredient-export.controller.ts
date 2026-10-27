import { Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { IngredientExcelService } from '../services/ingredient-excel.service';
import { ExportIngredientDto } from '../dto/export-ingredient.dto';
import { ApiController, SkipTransform } from '../../../common/decorators';

@ApiController('Export', ['export', 'v1/export'])
export class IngredientExportController {
  constructor(private readonly excelService: IngredientExcelService) {}

  @Post('ingredients')
  @SkipTransform()
  @ApiOperation({
    summary: 'Xuất danh sách nguyên liệu ra file Excel dạng Stream O(1) RAM (Tương thích đường dẫn NutriFE)',
  })
  async exportIngredients(@Body() dto: ExportIngredientDto, @Res() res: Response): Promise<void> {
    await this.excelService.streamExportIngredients(dto, res);
  }
}
