import { CreateExtendedDiseaseGroupDto } from './create-extended-disease-group.dto';
import { UpdateExtendedDiseaseGroupDto } from './update-extended-disease-group.dto';
import { ExtendedDiseaseGroupQueryDto } from './extended-disease-group-query.dto';

export class FindExtendedDiseaseGroupsParamsDto {
  userId: string;
  query?: ExtendedDiseaseGroupQueryDto;
}

export class FindExtendedDiseaseGroupByIdParamsDto {
  id: number;
  userId: string;
}

export class CreateExtendedDiseaseGroupParamsDto {
  userId: string;
  dto: CreateExtendedDiseaseGroupDto;
}

export class UpdateExtendedDiseaseGroupParamsDto {
  id: number;
  userId: string;
  dto: UpdateExtendedDiseaseGroupDto;
}

export class DeleteExtendedDiseaseGroupParamsDto {
  id: number;
  userId: string;
}

export class ImportExtendedDiseaseGroupsParamsDto {
  userId: string;
  file: Express.Multer.File;
}
