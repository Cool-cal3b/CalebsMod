import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { PackFileDto } from './dto/manifest.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';

export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const MAX_BATCH_FILES = 1000;

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
    files: Array<
      | { sha256: string; action: 'add' }
      | { sha256: string; action: 'remove'; relativePath: string; serverOnly: boolean }
    >,
    user?: string,
  ): number {
    if (files.length === 0 || this.isRevisionTrackingPaused()) {
      return 0;
    }

    return this.db.transaction(() => {
      const result = this.db
        .prepare(
          'INSERT INTO revisions (created_at, user) VALUES (?, ?)',
        )
        .run(Date.now(), user || null);

      const revisionId = result.lastInsertRowid as number;

      const stmt = this.db.prepare(
        'INSERT INTO revision_files (revision_id, file_sha256, action, relative_path, server_only) VALUES (?, ?, ?, ?, ?)',
      );

      for (const file of files) {
        if (file.action === 'add') {
          stmt.run(revisionId, file.sha256, file.action, null, null);
        } else {
          stmt.run(revisionId, file.sha256, file.action, file.relativePath, file.serverOnly ? 1 : 0);
        }
      }

      return revisionId;
    });
  }

  private isRevisionTrackingPaused(): boolean {
    const row = this.db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get('revision_tracking_paused') as { value: string } | undefined;
    return row?.value === '1';
  }

  private setRevisionTrackingPausedValue(paused: boolean) {
    this.db
      .prepare(
        `
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('revision_tracking_paused', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      )
      .run(paused ? '1' : '0', Date.now());
  }

  private createBaselineRevisionIfNeeded(user?: string): number {
    const latestRevision = this.getLatestRevision();
    if (latestRevision > 0) {
      return 0;
    }

    const allFiles = this.db
      .prepare('SELECT sha256 FROM files')
      .all() as Array<{ sha256: string }>;

    if (allFiles.length === 0) {
      return 0;
    }

    return this.db.transaction(() => {
      const result = this.db
        .prepare('INSERT INTO revisions (created_at, user) VALUES (?, ?)')
        .run(Date.now(), user || null);
      const revisionId = result.lastInsertRowid as number;

      const stmt = this.db.prepare(
        'INSERT INTO revision_files (revision_id, file_sha256, action, relative_path, server_only) VALUES (?, ?, ?, ?, ?)',
      );

      for (const file of allFiles) {
        stmt.run(revisionId, file.sha256, 'add', null, null);
      }

      return revisionId;
    });
  }

  private clearRevisionHistory() {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM revision_files').run();
      this.db.prepare('DELETE FROM revisions').run();
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

      // Nothing ingested from a pack is server-only. mods/, config/ and
      // thingpacks/ all have to exist on the client too: thingpacks in
      // particular define registry entries via JsonThings, so a client missing
      // them fails the FML handshake with "Missing registry data". Marking them
      // server-only here is what forced a manual flag-fixing pass after upload.
      const serverOnly = false;
      let clientOnly = false;

      if (relevantPath.includes('.for-manual-install/')) {
        relevantPath = relevantPath.split('.for-manual-install/')[1];
        clientOnly = true;
      } else if (
        !relevantPath.match(/^(mods|config|thingpacks)\//) &&
        entryPath.match(/^[^/]+\/(mods|config|thingpacks)\//)
      ) {
        // Pack zips usually nest everything under one top-level folder; strip it.
        relevantPath = entryPath.replace(/^[^/]+\//, '');
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
    const file = this.db
      .prepare('SELECT relative_path, server_only FROM files WHERE sha256 = ?')
      .get(sha256) as { relative_path: string; server_only: number } | undefined;

    if (!file) {
      return;
    }

    this.createRevision(
      [{ sha256, action: 'remove', relativePath: file.relative_path, serverOnly: file.server_only === 1 }],
      user,
    );

    this.db.prepare('DELETE FROM files WHERE sha256 = ?').run(sha256);

    const filePath = path.join(this.filesStorePath, sha256);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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
    // Store filenames are lowercase hex digests. Validating here stops a
    // crafted id (e.g. '..%2F..%2Fpackage.json') from escaping the store via
    // path.join and being served by the public files/:sha256 route.
    if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) {
      return null;
    }

    const filePath = path.join(this.filesStorePath, sha256);
    return fs.existsSync(filePath) ? filePath : null;
  }

  async createBatchZip(sha256s: string[]): Promise<Buffer> {
    const zip = new AdmZip();

    for (const sha256 of sha256s) {
      const sourcePath = this.getPackFile(sha256);
      if (sourcePath) {
        // Entries are keyed by hash, not path: the client already knows the
        // hash -> path mapping from the manifest, and this keeps the batch
        // content-addressed so it can be verified on arrival.
        zip.addLocalFile(sourcePath, '', sha256);
      }
    }

    return zip.toBuffer();
  }

  getLatestRevision(): number {
    const result = this.db
      .prepare('SELECT MAX(id) as latestRevision FROM revisions')
      .get() as { latestRevision: number | null };
    return result.latestRevision || 0;
  }

  getRevisionTrackingStatus() {
    return {
      paused: this.isRevisionTrackingPaused(),
      latestRevision: this.getLatestRevision(),
    };
  }

  setRevisionTrackingPaused(paused: boolean, user?: string, resetHistory = false) {
    const wasPaused = this.isRevisionTrackingPaused();

    if (resetHistory) {
      this.clearRevisionHistory();
    }

    this.setRevisionTrackingPausedValue(paused);

    let baselineRevision = 0;
    if ((wasPaused || resetHistory) && !paused) {
      baselineRevision = this.createBaselineRevisionIfNeeded(user);
    }

    this.db.logAudit('set_revision_tracking_paused', 'modpack', 'revision_tracking', user, {
      paused,
      resetHistory,
      baselineRevision,
    });

    return {
      paused,
      resetHistory,
      baselineRevision,
      latestRevision: this.getLatestRevision(),
    };
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
    if (this.isRevisionTrackingPaused()) {
      return {
        revisionId: 0,
        filesResynced: 0,
        message: 'Revision tracking is paused',
      };
    }

    const allFiles = this.db
      .prepare('SELECT sha256, relative_path, server_only FROM files')
      .all() as Array<{ sha256: string; relative_path: string; server_only: number }>;

    if (allFiles.length === 0) {
      return { revisionId: 0, filesResynced: 0, message: 'No files to resync' };
    }

    const actions = [
      ...allFiles.map(f => ({
        sha256: f.sha256,
        action: 'remove' as const,
        relativePath: f.relative_path,
        serverOnly: f.server_only === 1,
      })),
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
      .prepare('SELECT sha256, relative_path, server_only FROM files')
      .all() as Array<{ sha256: string; relative_path: string; server_only: number }>;

    if (allFiles.length === 0) {
      return { filesDeleted: 0, message: 'No files to delete' };
    }

    this.createRevision(
      allFiles.map(f => ({
        sha256: f.sha256,
        action: 'remove' as const,
        relativePath: f.relative_path,
        serverOnly: f.server_only === 1,
      })),
      user,
    );

    for (const f of allFiles) {
      const filePath = path.join(this.filesStorePath, f.sha256);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

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
        SELECT rf.file_sha256, rf.action, rf.relative_path as rf_relative_path, rf.server_only as rf_server_only,
               f.file_name, f.file_type, f.relative_path as f_relative_path, f.file_size, f.server_only as f_server_only
        FROM revision_files rf
        LEFT JOIN files f ON rf.file_sha256 = f.sha256
        WHERE rf.revision_id > ?
        ORDER BY rf.revision_id ASC
      `,
      )
      .all(fromRevisionId) as Array<{
      file_sha256: string;
      action: string;
      rf_relative_path: string | null;
      rf_server_only: number | null;
      file_name: string | null;
      file_type: string | null;
      f_relative_path: string | null;
      file_size: number | null;
      f_server_only: number | null;
    }>;

    const fileMap = new Map<string, { action: string; file: any; serverOnly: boolean }>();

    for (const rf of revisionFiles) {
      const serverOnly = rf.rf_server_only ?? rf.f_server_only ?? 0;
      if (serverOnly === 1) {
        continue;
      }

      const relativePath = rf.rf_relative_path ?? rf.f_relative_path ?? '';
      fileMap.set(rf.file_sha256, {
        action: rf.action,
        serverOnly: serverOnly === 1,
        file: {
          sha256: rf.file_sha256,
          fileName: rf.file_name ?? '',
          fileType: rf.file_type ?? '',
          relativePath,
          fileSize: rf.file_size ?? 0,
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
