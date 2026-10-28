import { CreateNutritionGuideDto } from './create-nutrition-guide.dto';
import { UpdateNutritionGuideDto } from './update-nutrition-guide.dto';

export class GetNutritionGuideByIdParamsDto {
  id: number;
}

export class CreateNutritionGuideParamsDto {
  dto: CreateNutritionGuideDto;
  userId?: string;
}

export class UpdateNutritionGuideParamsDto {
  id: number;
  dto: UpdateNutritionGuideDto;
}

export class DeleteNutritionGuideParamsDto {
  id: number;
}
