import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { PackFileDto } from './dto/manifest.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';

@Injectable()
export class ModpackService {
  private readonly filesStorePath: string;
  private readonly cachePath: string;

  private readonly fileTypeMap: Record<string, string> = {
    mods: 'mod',
    config: 'config',
    defaultconfigs: 'defaultconfig',
    resourcepacks: 'resourcepack',
    shaderpacks: 'shaderpack',
    options: 'options',
    servers: 'servers',
    panoramas: 'panorama',
    thingpacks: 'thingpack',
  };

  private readonly rootFilesMap: Record<string, string> = {
    'options.txt': 'options',
    'servers.dat': 'servers',
    'server.dat': 'servers',
  };

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {
    this.filesStorePath = path.join(process.cwd(), 'storage', 'pack-files');
    this.cachePath = path.join(process.cwd(), 'storage', 'cache');

    if (!fs.existsSync(this.filesStorePath)) {
      fs.mkdirSync(this.filesStorePath, { recursive: true });
    }
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  async addFile(
    filePath: string,
    fileName: string,
    fileType: string,
    relativePath: string,
    originalUrl?: string,
    modId?: string,
    modVersion?: string,
    required = true,
    user?: string,
  ) {
    const fileBuffer = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    const targetPath = path.join(this.filesStorePath, sha256);
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(filePath, targetPath);
    }

    const existingFile = this.db
      .prepare('SELECT sha256 FROM files WHERE sha256 = ?')
      .get(sha256);

    if (!existingFile) {
      this.db
        .prepare(
          `
        INSERT INTO files (sha256, file_name, file_size, file_type, relative_path, original_url, mod_id, mod_version, required, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          sha256,
          fileName,
          fileSize,
          fileType,
          relativePath,
          originalUrl,
          modId,
          modVersion,
          required ? 1 : 0,
          Date.now(),
        );
    }

    this.db.logAudit('add_file', 'file', sha256, user, { fileName, fileType });

    return { sha256, fileName, fileSize, fileType, relativePath };
  }

  async uploadModpackZip(zipFilePath: string, user?: string) {
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    const results: Array<{
      sha256: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      relativePath: string;
    }> = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      console.log(entry.entryName);

      const entryPath = entry.entryName.replace(/\\/g, '/');
      
      let relevantPath = entryPath;
      if (entryPath.includes('overrides/')) {
        relevantPath = entryPath.split('overrides/')[1];
      }

      const pathParts = relevantPath.split('/');
      const fileName = path.basename(entryPath);

      let fileType: string | undefined;
      let relativePath: string;

      if (pathParts.length === 1) {
        fileType = this.rootFilesMap[fileName];
        if (!fileType) continue;
        relativePath = fileName;
      } else {
        const topLevelFolder = pathParts[0];
        fileType = this.fileTypeMap[topLevelFolder];
        if (!fileType) continue;

        const relativePathInFolder = pathParts.slice(1).join('/');
        relativePath = path.join(topLevelFolder, relativePathInFolder).replace(/\\/g, '/');
      }

      const tempFilePath = path.join(this.cachePath, `temp-${Date.now()}-${Math.random()}-${fileName}`);
      
      try {
        fs.writeFileSync(tempFilePath, entry.getData());

        const result = await this.addFile(
          tempFilePath,
          fileName,
          fileType,
          relativePath,
          undefined,
          undefined,
          undefined,
          true,
          user,
        );

        results.push(result);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    return {
      filesProcessed: results.length,
      files: results,
    };
  }

  removeFile(sha256: string, user?: string) {
    this.db
      .prepare('DELETE FROM files WHERE sha256 = ?')
      .run(sha256);

    this.db.logAudit('remove_file', 'file', sha256, user);
  }

  getManifest(): PackFileDto[] {
    const files = this.db
      .prepare('SELECT * FROM files')
      .all() as any[];

    return files.map((f) => ({
      sha256: f.sha256,
      fileName: f.file_name,
      fileSize: f.file_size,
      fileType: f.file_type,
      relativePath: f.relative_path,
      originalUrl: f.original_url,
      modId: f.mod_id,
      modVersion: f.mod_version,
      required: f.required === 1,
    }));
  }

  getPackFile(sha256: string): string | null {
    const filePath = path.join(this.filesStorePath, sha256);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
