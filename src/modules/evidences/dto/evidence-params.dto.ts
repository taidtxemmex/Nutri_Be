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
  objectKey: string;
}

export class GenerateDownloadObjectParamsDto {
  objectKey: string;
  originalFileName?: string;
}
