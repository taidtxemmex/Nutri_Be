import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserContext } from '../../../common/interfaces/user-context.interface';

export type EvidenceUserContext = UserContext;

export class GeneratePreviewUrlParamsDto {
  id: string | number;
  currentUser: EvidenceUserContext;
}

export class GenerateDownloadUrlParamsDto {
  id: string | number;
  currentUser: EvidenceUserContext;
}

export class GeneratePreviewObjectParamsDto {
  @IsString({ message: 'validation.evidences.object_key_string' })
  @IsNotEmpty({ message: 'validation.evidences.object_key_required' })
  @MaxLength(255, { message: 'validation.evidences.object_key_max_255' })
  objectKey: string;
}

export class GenerateDownloadObjectParamsDto {
  @IsString({ message: 'validation.evidences.object_key_string' })
  @IsNotEmpty({ message: 'validation.evidences.object_key_required' })
  @MaxLength(255, { message: 'validation.evidences.object_key_max_255' })
  objectKey: string;

  @IsOptional()
  @IsString({ message: 'validation.evidences.original_filename_prop_string' })
  @MaxLength(255, { message: 'validation.evidences.original_filename_prop_max_255' })
  originalFileName?: string;
}
