export class UploadFileParamsDto {
  file: Express.Multer.File;
  subDirectory?: string;
}

export class GetFileParamsDto {
  objectKey: string;
}

export class CreateReadStreamParamsDto {
  objectKey: string;
}

export class DeleteFileParamsDto {
  objectKey: string;
}

export class GenerateSignedUrlParamsDto {
  objectKey: string;
  action: 'preview' | 'download';
  expiresInSeconds?: number;
  originalFileName?: string;
}

export class VerifySignedUrlParamsDto {
  objectKey: string;
  token: string;
  expires: number;
  action: 'preview' | 'download';
}
