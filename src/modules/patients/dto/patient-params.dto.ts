import {
  PatientQueryDto,
  CreatePatientDto,
  UpdatePatientDto,
  AnthropometryQueryDto,
  CreateAnthropometryDto,
  MedicalRecordQueryDto,
  CreateMedicalRecordDto,
} from './index';

export class FindAllPatientsParamDto {
  query: PatientQueryDto;
  currentUser: { id: string; role?: string };
}

export class FindPatientByIdParamDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class CreatePatientParamDto {
  dto: CreatePatientDto;
  currentUser: { id: string; role?: string };
}

export class UpdatePatientParamDto {
  id: string | number | bigint;
  dto: UpdatePatientDto;
  currentUser: { id: string; role?: string };
}

export class DeletePatientParamDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class PreviewPatientCodeParamDto {
  phone?: string;
  excludeId?: string;
  currentUser?: { id?: string; role?: string };
}

export class GetAnthropometryHistoryParamDto {
  id: string | number | bigint;
  query: AnthropometryQueryDto;
  currentUser: { id: string; role?: string };
}

export class CreateAnthropometryParamDto {
  id: string | number | bigint;
  dto: CreateAnthropometryDto;
  currentUser: { id: string; role?: string };
}

export class GetMedicalRecordsParamDto {
  id: string | number | bigint;
  query: MedicalRecordQueryDto;
  currentUser: { id: string; role?: string };
}

export class CreateMedicalRecordParamDto {
  id: string | number | bigint;
  dto: CreateMedicalRecordDto;
  currentUser: { id: string; role?: string };
}

export class ImportPatientExcelParamDto {
  fileBuffer: Buffer;
  currentUser: { id: string; role?: string };
}

export class GetPatientEntityParamDto {
  id: string | number | bigint;
}

export class PreviewCodeAllocatorParamDto {
  userId: string;
  phone?: string;
  excludeId?: string;
}

export class AllocateCodeInTxParamDto {
  tx: any;
  userId: string;
  phone?: string | null;
  customCode?: string | null;
}
