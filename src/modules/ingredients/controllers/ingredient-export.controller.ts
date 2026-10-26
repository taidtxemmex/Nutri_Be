import { Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { IngredientExcelService } from '../services/ingredient-excel.service';
import { ExportIngredientDto } from '../dto/export-ingredient.dto';
import { ApiController, SkipTransform } from '../../../common/decorators';

@ApiController('Export', 'export')
export class IngredientExportController {
  constructor(private readonly excelService: IngredientExcelService) {}

  @Post('ingredients')
  @SkipTransform()
  @ApiOperation({
    summary: 'Xuất danh sách nguyên liệu ra file Excel (Tương thích đường dẫn NutriFE)',
  })
  async exportIngredients(@Body() dto: ExportIngredientDto, @Res() res: Response) {
    const buffer = await this.excelService.exportIngredients(dto);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="danh_sach_nguyen_lieu.xlsx"');
    return res.end(buffer);
  }
}
