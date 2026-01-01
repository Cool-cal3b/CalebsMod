export class ModDto {
  sha256: string;
  fileName: string;
  fileSize: number;
  originalUrl?: string;
  modId?: string;
  modVersion?: string;
  required: boolean;
}

export class PackManifestDto {
  packName: string;
  packId: string;
  version: string;
  minecraftVersion: string;
  loader: {
    type: string;
    version: string;
  };
  mods: ModDto[];
  updatedAt: number;
}
