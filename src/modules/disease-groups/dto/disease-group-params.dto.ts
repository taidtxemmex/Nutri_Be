import { CreateDiseaseGroupDto } from './create-disease-group.dto';
import { UpdateDiseaseGroupDto } from './update-disease-group.dto';
import { DiseaseGroupQueryDto } from './disease-group-query.dto';

export class FindDiseaseGroupsParamsDto {
  query?: DiseaseGroupQueryDto;
}

export class FindDiseaseGroupByIdParamsDto {
  id: number;
}

export class CreateDiseaseGroupParamsDto {
  dto: CreateDiseaseGroupDto;
}

export class UpdateDiseaseGroupParamsDto {
  id: number;
  dto: UpdateDiseaseGroupDto;
}

export class DeleteDiseaseGroupParamsDto {
  id: number;
}
