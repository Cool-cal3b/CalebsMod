export class AddModDto {
  url?: string;
  modId?: string;
  modVersion?: string;
  required?: boolean;
}

export class CreatePackDto {
  name: string;
  minecraftVersion: string;
  loaderType: string;
  loaderVersion: string;
}

export class UpdatePackDto {
  name?: string;
  minecraftVersion?: string;
  loaderType?: string;
  loaderVersion?: string;
}
