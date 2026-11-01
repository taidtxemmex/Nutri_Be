import {
  CreateDailyIntakeDto,
  UpdateDailyIntakeDto,
  DailyIntakeQueryDto,
  DailyIntakeExportRequestDto,
} from './index';
import { DailyIntakeClinicalReportType } from '../../../config/enums/domain.enum';
import { Response } from 'express';
import { Writable } from 'stream';

export class GetAllDailyIntakesParamDto {
  query: DailyIntakeQueryDto;
  currentUser: { id: string; role?: string };
}

export class GetDailyIntakeByIdParamDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class GetDailyIntakesByPatientParamDto {
  patientId: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class CreateDailyIntakeParamDto {
  dto: CreateDailyIntakeDto;
  currentUser: { id: string; role?: string };
}

export class UpdateDailyIntakeParamDto {
  id: string | number | bigint;
  dto: UpdateDailyIntakeDto;
  currentUser: { id: string; role?: string };
}

export class DeleteDailyIntakeParamDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class GetRdaReportParamDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
  options?: {
    limitSetId?: string;
    physiologicalStatus?: string;
  };
}

export class GenerateDailyIntakeTemplateParamDto {
  type?: string;
}

export class ImportDailyIntakeExcelParamDto {
  fileBuffer: Buffer;
  options: {
    patientId?: string | number | bigint;
    userId: string;
    userRole?: string;
    date?: string;
    overwrite?: boolean | string;
    notes?: string;
  };
}

export class ExportClinicalReportParamDto {
  intakeIdOrData: bigint | string | number | any;
  reportType?: DailyIntakeClinicalReportType;
  currentUserId?: string;
}

export class StreamClinicalReportParamDto {
  intakeIdOrData: bigint | string | number | any;
  outputStream: Writable | Response;
  reportType?: DailyIntakeClinicalReportType;
  currentUserId?: string;
}

export class ExportReportStreamParamDto {
  dto: DailyIntakeExportRequestDto;
  res: Response;
  user: any;
}
