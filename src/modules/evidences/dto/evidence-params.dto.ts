import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export interface EvidenceUserContext {
  id: string;
  role?: string;
}

export class GeneratePreviewUrlParamsDto {
  id: string | number;
  currentUser: EvidenceUserContext;
}

export class GenerateDownloadUrlParamsDto {
  id: string | number;
  currentUser: EvidenceUserContext;
}

export class GeneratePreviewObjectParamsDto {
  @IsString({ message: 'objectKey phải là chuỗi' })
  @IsNotEmpty({ message: 'objectKey không được để trống' })
  @MaxLength(255, { message: 'objectKey tối đa 255 ký tự' })
  objectKey: string;
}

export class GenerateDownloadObjectParamsDto {
  @IsString({ message: 'objectKey phải là chuỗi' })
  @IsNotEmpty({ message: 'objectKey không được để trống' })
  @MaxLength(255, { message: 'objectKey tối đa 255 ký tự' })
  objectKey: string;

  @IsOptional()
  @IsString({ message: 'originalFileName phải là chuỗi' })
  @MaxLength(255, { message: 'originalFileName tối đa 255 ký tự' })
  originalFileName?: string;
}
