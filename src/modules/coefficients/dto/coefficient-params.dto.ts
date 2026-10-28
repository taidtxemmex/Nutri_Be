import { CreateCoefficientDto } from './create-coefficient.dto';
import { UpdateCoefficientDto } from './update-coefficient.dto';

export interface CoefficientUserContext {
  id: string;
  role?: string;
}

export class CreateCoefficientParamsDto {
  dto: CreateCoefficientDto;
  currentUser: CoefficientUserContext;
}

export class FindAllCoefficientsParamsDto {
  currentUser?: {
    id?: string;
    role?: string;
  };
}

export class FindMyCoefficientsParamsDto {
  currentUser: {
    id: string;
  };
}

export class FindCoefficientByIdParamsDto {
  id: string | number;
}

export class UpdateCoefficientParamsDto {
  id: string | number;
  dto: UpdateCoefficientDto;
  currentUser: CoefficientUserContext;
}

export class DeleteCoefficientParamsDto {
  id: string | number;
  currentUser: CoefficientUserContext;
}
