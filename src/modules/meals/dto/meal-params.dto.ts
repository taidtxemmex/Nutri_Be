import { CreateMealDto, UpdateMealDto } from './index';

export class CreateMealParamsDto {
  dto: CreateMealDto;
  currentUser: { id: string; role?: string };
}

export class FindAllMealsParamsDto {
  currentUser?: { id?: string; role?: string };
}

export class FindMealByIdParamsDto {
  id: number | string;
  currentUser?: { id?: string; role?: string };
}

export class UpdateMealParamsDto {
  id: number | string;
  dto: UpdateMealDto;
  currentUser: { id: string; role?: string };
}

export class DeleteMealParamsDto {
  id: number | string;
  currentUser: { id: string; role?: string };
}
