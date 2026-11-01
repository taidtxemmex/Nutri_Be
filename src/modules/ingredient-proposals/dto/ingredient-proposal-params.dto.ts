import { UserContext } from '../../../common/interfaces/user-context.interface';
import { CreateIngredientProposalDto } from './create-ingredient-proposal.dto';

export type ProposalUserContext = UserContext;

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
