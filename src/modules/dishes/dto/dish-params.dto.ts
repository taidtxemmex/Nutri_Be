import { Response } from 'express';
import { Writable } from 'stream';
import { CreateDishDto, UpdateDishDto, DishCloneRequestDto, ExportDishDto } from './index';
import { DishStatus } from '../../../config/enums/domain.enum';

export class CreateDishParamsDto {
  dto: CreateDishDto;
  currentUser: { id: string; role?: string };
}

export class GetUserDishesParamsDto {
  currentUser: { id: string; role?: string };
  statuses?: DishStatus[];
}

export class GetPublicDishesParamsDto {
  currentUserId?: string;
}

export class FindAllDishesParamsDto {
  query?: any;
}

export class GetAdminDishesParamsDto {
  currentUser: { id: string; role?: string };
  statuses?: DishStatus[];
}

export class AutocompleteDishesParamsDto {
  keyword: string;
  mealType?: string;
  currentUser?: { id: string; role?: string };
}

export class FindDishByIdParamsDto {
  id: string | number;
  currentUser?: { id: string; role?: string };
}

export class UpdateDishParamsDto {
  id: string | number;
  dto: UpdateDishDto;
  currentUser?: { id: string; role?: string };
}

export class CloneDishParamsDto {
  dishId: string | number;
  request: DishCloneRequestDto;
  currentUser: { id: string; role?: string };
}

export class ProposeDishParamsDto {
  dishId: string | number;
  currentUser: { id: string; role?: string };
}

export class ApproveDishParamsDto {
  id: string | number;
  adminUser: { id: string; role?: string };
}

export class RejectDishParamsDto {
  id: string | number;
  reason: string;
  adminUser: { id: string; role?: string };
}

export class DeleteDishParamsDto {
  id: string | number;
  currentUser?: { id: string; role?: string };
}

export class ImportDishExcelParamsDto {
  fileBuffer: Buffer;
  userId: string;
}

export class StreamExportDishesParamsDto {
  dtoOrDishes: ExportDishDto | any[];
  stream: Response | Writable;
  currentUser?: { id: string; role?: string };
  columns?: string[];
}

export class ExportDishesParamsDto {
  dtoOrDishes: ExportDishDto | any[];
  currentUser?: { id: string; role?: string };
  columns?: string[];
}
