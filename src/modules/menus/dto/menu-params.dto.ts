import { Response } from 'express';
import { Writable } from 'stream';
import { CreateMenuDto, UpdateMenuDto, MenuQueryDto, ResolveDishDto } from './index';
import { MenuExportOptions } from '../services/menu-excel.service';

export class GetAllMenusParamsDto {
  query: MenuQueryDto;
  currentUser: { id: string; role?: string };
}

export class GetMenuByIdParamsDto {
  id: string | number | bigint;
  weekNo?: number;
  dayOfWeek?: number;
  currentUser?: { id: string; role?: string };
}

export class GetFullMenuParamsDto {
  id: string | number | bigint;
  currentUser?: { id: string; role?: string };
}

export class CreateMenuParamsDto {
  dto: CreateMenuDto;
  currentUser: { id: string; role?: string };
}

export class UpdateMenuParamsDto {
  id: string | number | bigint;
  dto: UpdateMenuDto;
  currentUser: { id: string; role?: string };
}

export class DeleteMenuParamsDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class CloneMenuParamsDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class ResolveDishForMenuParamsDto {
  dto: ResolveDishDto;
  currentUser: { id: string; role?: string };
}

export class ExportMenuExcelParamsDto {
  menuIdOrData: bigint | number | string | any;
  options?: MenuExportOptions;
}

export class StreamMenuExcelParamsDto {
  menuIdOrData: bigint | number | string | any;
  outputStream: Response | Writable;
  options?: MenuExportOptions;
}

export class StreamMarketPlanExcelParamsDto {
  menuIdOrData: bigint | number | string | any;
  outputStream: Response | Writable;
  options?: {
    servings?: number;
    cycle?: string;
    week?: number;
    day?: number;
    userId?: string;
  };
}
