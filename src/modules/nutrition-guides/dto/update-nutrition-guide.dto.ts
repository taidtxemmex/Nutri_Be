import { PartialType } from '@nestjs/swagger';
import { CreateNutritionGuideDto } from './create-nutrition-guide.dto';

export class UpdateNutritionGuideDto extends PartialType(CreateNutritionGuideDto) {}
