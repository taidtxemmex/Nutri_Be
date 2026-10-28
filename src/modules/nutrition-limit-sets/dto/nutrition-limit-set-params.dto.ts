import { CreateNutritionLimitSetDto, UpdateNutritionLimitSetDto } from './nutrition-limit-set.dto';

export interface NutritionLimitSetUserContext {
  id: string;
  role?: string;
}

export class CreateNutritionLimitSetParamsDto {
  dto: CreateNutritionLimitSetDto;
  currentUser: NutritionLimitSetUserContext;
}

export class UpdateNutritionLimitSetParamsDto {
  id: string | number | bigint;
  dto: UpdateNutritionLimitSetDto;
  currentUser: NutritionLimitSetUserContext;
}

export class GetNutritionLimitSetByIdParamsDto {
  id: string | number | bigint;
  currentUser: NutritionLimitSetUserContext;
}

export class GetAllNutritionLimitSetsParamsDto {
  currentUser: NutritionLimitSetUserContext;
}

export class DeleteNutritionLimitSetParamsDto {
  id: string | number | bigint;
  currentUser: NutritionLimitSetUserContext;
}
