import { CreateIngredientProposalDto } from './create-ingredient-proposal.dto';

export interface ProposalUserContext {
  id: string;
  role?: string;
}

export class CreateIngredientProposalParamsDto {
  dto: CreateIngredientProposalDto;
  currentUser: ProposalUserContext;
}

export class FindAllIngredientProposalsParamsDto {
  currentUser: ProposalUserContext;
  status?: string;
}

export class FindIngredientProposalByIdParamsDto {
  id: string | number | bigint;
  currentUser: ProposalUserContext;
}

export class ApproveIngredientProposalParamsDto {
  id: string | number | bigint;
  currentUser: ProposalUserContext;
}

export class RejectIngredientProposalParamsDto {
  id: string | number | bigint;
  reason?: string;
  currentUser: ProposalUserContext;
}
