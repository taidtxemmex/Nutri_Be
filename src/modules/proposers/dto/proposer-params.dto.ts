import { CreateProposerDto } from './create-proposer.dto';
import { UpdateProposerDto } from './update-proposer.dto';
import { ProposerQueryDto } from './proposer-query.dto';

export class FindProposersParamsDto {
  query?: ProposerQueryDto;
}

export class GetMeProposerParamsDto {
  userId: string;
}

export class FindProposerByIdParamsDto {
  id: number;
}

export class InsertProposerParamsDto {
  userId: string;
  dto: CreateProposerDto;
}

export class UpdateProposerParamsDto {
  id: number;
  userId: string;
  isAdmin: boolean;
  dto: UpdateProposerDto;
}
