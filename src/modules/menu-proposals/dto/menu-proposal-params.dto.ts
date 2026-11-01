import { RejectProposalDto, MenuProposalQueryDto } from './menu-proposal.dto';

export class ProposeMenuParamsDto {
  menuIdParam: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class GetAdminProposalsParamsDto {
  query?: MenuProposalQueryDto;
}

export class GetMyProposalsParamsDto {
  currentUser: { id: string; role?: string };
}

export class GetProposalDetailParamsDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class GetProposalDayDetailParamsDto {
  id: string | number | bigint;
  weekNo?: number;
  dayOfWeek?: number;
  currentUser?: { id: string; role?: string };
}

export class ApproveProposalParamsDto {
  id: string | number | bigint;
  currentUser: { id: string; role?: string };
}

export class RejectProposalParamsDto {
  id: string | number | bigint;
  dto: RejectProposalDto;
  currentUser: { id: string; role?: string };
}

export class ExportProposalExcelParamsDto {
  id: string | number | bigint;
  columns?: string[];
  currentUser?: { id: string; role?: string };
}

export class DeleteProposalParamsDto {
  idParam: string | number | bigint;
  currentUser: { id: string; role?: string };
}
