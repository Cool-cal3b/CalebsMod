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

    let isNewFile = false;
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
      isNewFile = true;
    }

    if (isNewFile) {
      this.createRevision([{ sha256, action: 'add' }], user);
    }

    this.db.logAudit('add_file', 'file', sha256, user, { fileName, fileType });

    return { sha256, fileName, fileSize, fileType, relativePath };
  }

  private createRevision(
    files: Array<{ sha256: string; action: 'add' | 'remove' }>,
    user?: string,
  ): number {
    return this.db.transaction(() => {
      const result = this.db
        .prepare(
          'INSERT INTO revisions (created_at, user) VALUES (?, ?)',
        )
        .run(Date.now(), user || null);

      const revisionId = result.lastInsertRowid as number;

      const stmt = this.db.prepare(
        'INSERT INTO revision_files (revision_id, file_sha256, action) VALUES (?, ?, ?)',
      );

      for (const file of files) {
        stmt.run(revisionId, file.sha256, file.action);
      }

      return revisionId;
    });
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
    const newFiles: string[] = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      console.log(entry.entryName);

      const entryPath = entry.entryName.replace(/\\/g, '/');
      
      const normalized = entry.entryName.replace(/\\/g, '/');
      let relevantPath = normalized;

      if (relevantPath.includes('overrides/')) {
        relevantPath = relevantPath.split('overrides/')[1];
      }

      let serverOnly = false;
      let clientOnly = false;

      if (relevantPath.includes('.for-manual-install/')) {
        relevantPath = relevantPath.split('.for-manual-install/')[1];
        clientOnly = true;
      } else if (relevantPath.match(/^(mods|config|thingpacks)\//)) {
        serverOnly = true;
      } else if (entryPath.match(/^[^/]+\/(mods|config|thingpacks)\//)) {
        relevantPath = entryPath.replace(/^[^/]+\//, ''); // <-- add this
        serverOnly = true;
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

        const fileBuffer = fs.readFileSync(tempFilePath);
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const fileSize = fileBuffer.length;

        const targetPath = path.join(this.filesStorePath, sha256);
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(tempFilePath, targetPath);
        }

        const existingFile = this.db
          .prepare('SELECT sha256 FROM files WHERE sha256 = ?')
          .get(sha256);

        if (!existingFile) {
          this.db
            .prepare(
              `
            INSERT INTO files (sha256, file_name, file_size, file_type, relative_path, original_url, mod_id, mod_version, required, server_only, client_only, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            )
            .run(
              sha256,
              fileName,
              fileSize,
              fileType,
              relativePath,
              undefined,
              undefined,
              undefined,
              1,
              serverOnly ? 1 : 0,
              clientOnly ? 1 : 0,
              Date.now(),
            );
          newFiles.push(sha256);
        }

        results.push({ sha256, fileName, fileSize, fileType, relativePath });
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    if (newFiles.length > 0) {
      this.createRevision(
        newFiles.map(sha256 => ({ sha256, action: 'add' })),
        user,
      );
    }

    return {
      filesProcessed: results.length,
      files: results,
      newFilesAdded: newFiles.length,
    };
  }

  removeFile(sha256: string, user?: string) {
    this.db
      .prepare('DELETE FROM files WHERE sha256 = ?')
      .run(sha256);

    this.createRevision([{ sha256, action: 'remove' }], user);

    this.db.logAudit('remove_file', 'file', sha256, user);
  }

  getManifest(): PackFileDto[] {
    const files = this.db
      .prepare('SELECT * FROM files WHERE server_only = 0')
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

  getServerManifest(): PackFileDto[] {
    const files = this.db
      .prepare('SELECT * FROM files WHERE client_only = 0')
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

  getLatestRevision(): number {
    const result = this.db
      .prepare('SELECT MAX(id) as latestRevision FROM revisions')
      .get() as { latestRevision: number | null };
    return result.latestRevision || 0;
  }

  updateFileFlags(sha256: string, serverOnly: boolean, clientOnly: boolean, user?: string) {
    this.db
      .prepare('UPDATE files SET server_only = ?, client_only = ? WHERE sha256 = ?')
      .run(serverOnly ? 1 : 0, clientOnly ? 1 : 0, sha256);

    this.db.logAudit('update_file_flags', 'file', sha256, user, {
      serverOnly,
      clientOnly,
    });
  }

  async createFullResyncRevision(user?: string) {
    const allFiles = this.db
      .prepare('SELECT sha256 FROM files')
      .all() as Array<{ sha256: string }>;

    if (allFiles.length === 0) {
      return { revisionId: 0, filesResynced: 0, message: 'No files to resync' };
    }

    const actions = [
      ...allFiles.map(f => ({ sha256: f.sha256, action: 'remove' as const })),
      ...allFiles.map(f => ({ sha256: f.sha256, action: 'add' as const })),
    ];

    const revisionId = this.createRevision(actions, user);

    this.db.logAudit('full_resync', 'files', 'all', user, {
      revisionId,
      fileCount: allFiles.length,
    });

    return {
      revisionId,
      filesResynced: allFiles.length,
      message: `Created full resync revision ${revisionId}`,
    };
  }

  getAllFiles(search?: string): any[] {
    let query = 'SELECT * FROM files';
    const params: any[] = [];

    if (search && search.trim()) {
      query += ' WHERE file_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY file_name ASC LIMIT 100';

    const files = this.db.prepare(query).all(...params) as any[];
    console.log(`num files: ${files.length}`);

    return files.map((f) => ({
      sha256: f.sha256,
      fileName: f.file_name,
      fileSize: f.file_size,
      fileType: f.file_type,
      relativePath: f.relative_path,
      serverOnly: f.server_only === 1,
      clientOnly: f.client_only === 1,
      required: f.required === 1,
    }));
  }

  deleteAllFiles(user?: string) {
    const allFiles = this.db
      .prepare('SELECT sha256 FROM files')
      .all() as Array<{ sha256: string }>;

    if (allFiles.length === 0) {
      return { filesDeleted: 0, message: 'No files to delete' };
    }

    this.createRevision(
      allFiles.map(f => ({ sha256: f.sha256, action: 'remove' })),
      user,
    );

    this.db.prepare('DELETE FROM files').run();

    this.db.logAudit('delete_all_files', 'files', 'all', user, {
      count: allFiles.length,
    });

    return {
      filesDeleted: allFiles.length,
      message: `Deleted ${allFiles.length} files`,
    };
  }

  async getSyncData(fromRevisionId: number) {
    const latestRevision = this.getLatestRevision();

    if (fromRevisionId >= latestRevision) {
      return {
        upToDate: true,
        latestRevision,
        filesToAdd: [],
        filesToRemove: [],
      };
    }

    const revisionFiles = this.db
      .prepare(
        `
        SELECT rf.file_sha256, rf.action, f.file_name, f.file_type, f.relative_path, f.file_size, f.server_only
        FROM revision_files rf
        LEFT JOIN files f ON rf.file_sha256 = f.sha256
        WHERE rf.revision_id > ?
        ORDER BY rf.revision_id ASC
      `,
      )
      .all(fromRevisionId) as Array<{
      file_sha256: string;
      action: string;
      file_name: string;
      file_type: string;
      relative_path: string;
      file_size: number;
      server_only: number;
    }>;

    const fileMap = new Map<string, { action: string; file: any; serverOnly: boolean }>();

    for (const rf of revisionFiles) {
      if (rf.server_only === 1) {
        continue;
      }

      fileMap.set(rf.file_sha256, {
        action: rf.action,
        serverOnly: rf.server_only === 1,
        file: {
          sha256: rf.file_sha256,
          fileName: rf.file_name,
          fileType: rf.file_type,
          relativePath: rf.relative_path,
          fileSize: rf.file_size,
        },
      });
    }

    const filesToAdd: Array<any> = [];
    const filesToRemove: Array<string> = [];

    for (const [sha256, data] of fileMap) {
      if (data.action === 'add') {
        filesToAdd.push(data.file);
      } else if (data.action === 'remove') {
        filesToRemove.push(data.file.relativePath);
      }
    }

    return {
      upToDate: false,
      latestRevision,
      filesToAdd,
      filesToRemove,
    };
  }

  async createSyncZip(filesToAdd: Array<{ sha256: string; relativePath: string }>): Promise<Buffer> {
    const zip = new AdmZip();

    for (const file of filesToAdd) {
      const sourcePath = this.getPackFile(file.sha256);
      if (sourcePath && fs.existsSync(sourcePath)) {
        zip.addLocalFile(sourcePath, path.dirname(file.relativePath), path.basename(file.relativePath));
      }
    }

    return zip.toBuffer();
  }
}
