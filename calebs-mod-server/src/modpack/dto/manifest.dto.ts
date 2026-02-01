export class PackFileDto {
  sha256: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  relativePath: string;
  originalUrl?: string;
  modId?: string;
  modVersion?: string;
  required: boolean;
}
