import { Response } from 'express';
import { Writable } from 'stream';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  IngredientQueryDto,
  ExportIngredientDto,
  CalculateSummaryDto,
} from './index';

export class ExistsByMaterialParamsDto {
  material: string;
  excludeId?: bigint | number | string;
}

export class FindAllIngredientsParamsDto {
  query?: IngredientQueryDto;
}

export class FindIngredientByIdParamsDto {
  id: bigint | number | string;
}

export class CreateIngredientParamsDto {
  dto: CreateIngredientDto;
  currentUser?: { id?: string; role?: string };
}

export class UpdateIngredientParamsDto {
  id: bigint | number | string;
  dto: UpdateIngredientDto;
  currentUser?: { id?: string; role?: string };
}

export class DeleteIngredientParamsDto {
  id: bigint | number | string;
}

export class ApproveIngredientParamsDto {
  pendingId: bigint | number | string;
}

export class RejectIngredientParamsDto {
  pendingId: bigint | number | string;
  reason?: string;
}

export class CalculateSummaryParamsDto {
  dto: CalculateSummaryDto;
}

export class GenerateIngredientTemplateParamsDto {
  columns?: string[];
}

export class StreamExportIngredientsParamsDto {
  dto: ExportIngredientDto;
  outputStream: Response | Writable;
}

export class ExportIngredientsParamsDto {
  dto: ExportIngredientDto;
}

export class ImportIngredientExcelParamsDto {
  fileBuffer: Buffer;
  userId?: string;
}
