import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { contained, safeRelative } from './world-paths';

export interface WorldFile {
  sha256: string;
  serverSha256?: string;
  relativePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  serverOnly: boolean;
  clientOnly: boolean;
  required: boolean;
}
export interface WorldRecord {
  id: string;
  name: string;
  dataPath: string;
  containerName: string;
  image: string;
  original: boolean;
  archived: boolean;
  initialized: boolean;
  minecraftVersion: string;
  forgeVersion: string;
  generation: string;
  revision: number;
  published: WorldFile[];
  draft: WorldFile[];
  createdAt: number;
}
export interface WorldOperation {
  id: string;
  kind: string;
  worldId?: string;
  sourceId?: string;
  status: 'running' | 'completed' | 'failed' | 'recovery_required';
  phase: string;
  error?: string;
  result?: unknown;
  rollbackBackup?: string;
  targetBackup?: string;
  wasRunning?: boolean;
  createdAt: number;
  progress?: { done: number; total: number };
}

@Injectable()
export class WorldStore implements OnModuleInit {
  readonly storage: string;
  readonly blobs: string;
  private lockHandle?: number;
  constructor(
    readonly db: DatabaseService,
    readonly config: ConfigService,
  ) {
    this.storage = path.resolve(
      config.get<string>('WORLD_STORAGE_PATH') || './storage',
    );
    this.blobs = path.join(this.storage, 'pack-files');
  }
  onModuleInit() {
    fs.mkdirSync(this.storage, { recursive: true });
    fs.mkdirSync(this.blobs, { recursive: true });
    this.db.getDb().pragma('synchronous = FULL');
    this.db.getDb().exec(`
      CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_revisions (world_id TEXT NOT NULL, revision INTEGER NOT NULL, manifest TEXT NOT NULL, PRIMARY KEY(world_id, revision));
      CREATE TABLE IF NOT EXISTS world_operations (id TEXT PRIMARY KEY, record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_backups (id TEXT PRIMARY KEY, world_id TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL, file_path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL);
    `);
  }
  list(): WorldRecord[] {
    return (
      this.db.prepare('SELECT record FROM worlds').all() as { record: string }[]
    ).map((r) => JSON.parse(r.record));
  }
  get(id: string): WorldRecord {
    const row = this.db
      .prepare('SELECT record FROM worlds WHERE id=?')
      .get(id) as { record: string } | undefined;
    if (!row) throw new NotFoundException('World not found');
    return JSON.parse(row.record);
  }
  active(): WorldRecord | undefined {
    const row = this.db
      .prepare("SELECT value FROM app_settings WHERE key='active_world_id'")
      .get() as { value: string } | undefined;
    return row ? this.get(row.value) : undefined;
  }
  dataPath(): string {
    return (
      this.active()?.dataPath ||
      path.resolve(
        this.config.get<string>('MINECRAFT_DATA_PATH') || './minecraft-data',
      )
    );
  }
  save(world: WorldRecord) {
    this.db
      .prepare(
        'INSERT INTO worlds(id,record) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record',
      )
      .run(world.id, JSON.stringify(world));
  }
  setActive(id: string) {
    this.get(id);
    this.db
      .prepare(
        "INSERT INTO app_settings(key,value,updated_at) VALUES('active_world_id',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
      )
      .run(id, Date.now());
  }
  publish(world: WorldRecord, files: WorldFile[]) {
    const latest = this.db
      .prepare(
        'SELECT MAX(revision) AS latest FROM world_revisions WHERE world_id=?',
      )
      .get(world.id) as { latest: number | null };
    world.published = structuredClone(files);
    world.draft = structuredClone(files);
    world.revision = Math.max(world.revision, latest.latest || 0) + 1;
    this.db.transaction(() => {
      this.save(world);
      this.db
        .prepare(
          'INSERT INTO world_revisions(world_id,revision,manifest) VALUES(?,?,?)',
        )
        .run(world.id, world.revision, JSON.stringify(files));
    });
  }
  manifest(id: string, revision?: number): WorldFile[] {
    const world = this.get(id);
    if (revision === undefined || revision === world.revision)
      return world.published;
    const row = this.db
      .prepare(
        'SELECT manifest FROM world_revisions WHERE world_id=? AND revision=?',
      )
      .get(id, revision) as { manifest: string } | undefined;
    if (!row) throw new NotFoundException('Pack revision not found');
    return JSON.parse(row.manifest);
  }
  blob(hash: string): string {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid content hash');
    return contained(this.blobs, hash);
  }
  put(data: Buffer): string {
    const hash = require('crypto')
      .createHash('sha256')
      .update(data)
      .digest('hex');
    const dest = this.blob(hash);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, data, { flag: 'wx' });
    return hash;
  }
  validatePack(files: WorldFile[]) {
    if (!Array.isArray(files) || files.length > 200000)
      throw new Error('Invalid pack manifest');
    const seen = new Set<string>();
    for (const file of files) {
      const key = safeRelative(file.relativePath).toLowerCase();
      if (seen.has(key))
        throw new Error(`Duplicate pack destination: ${file.relativePath}`);
      seen.add(key);
      if (
        !/^(mods|config|defaultconfigs|resourcepacks|shaderpacks|panoramas|thingpacks|fancymenu_data|globalresources|patchouli_books)\//.test(
          file.relativePath,
        ) &&
        !['options.txt', 'servers.dat', 'server.dat'].includes(
          file.relativePath,
        )
      )
        throw new Error('Pack path is not managed');
      this.blob(file.sha256);
      if (file.serverSha256) this.blob(file.serverSha256);
      if (
        typeof file.serverOnly !== 'boolean' ||
        typeof file.clientOnly !== 'boolean' ||
        (file.serverOnly && file.clientOnly) ||
        !Number.isSafeInteger(file.fileSize) ||
        file.fileSize < 0
      )
        throw new Error('Invalid pack file');
    }
  }
  pending(): WorldOperation[] {
    return (
      this.db.prepare('SELECT record FROM world_operations').all() as {
        record: string;
      }[]
    )
      .map((r) => JSON.parse(r.record))
      .filter(
        (r) => r.status === 'running' || r.status === 'recovery_required',
      );
  }
  operation(id: string): WorldOperation {
    const row = this.db
      .prepare('SELECT record FROM world_operations WHERE id=?')
      .get(id) as { record: string } | undefined;
    if (!row) throw new NotFoundException('Operation not found');
    return JSON.parse(row.record);
  }
  saveOperation(op: WorldOperation) {
    this.db
      .prepare(
        'INSERT INTO world_operations(id,record) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record',
      )
      .run(op.id, JSON.stringify(op));
  }
  assertIdle() {
    if (
      this.pending().length ||
      fs.existsSync(path.join(this.storage, 'world-operation.lock'))
    )
      throw new ConflictException(
        'World maintenance is in progress; wait or recover the interrupted operation',
      );
  }
  acquire() {
    this.assertIdle();
    try {
      this.lockHandle = fs.openSync(
        path.join(this.storage, 'world-operation.lock'),
        'wx',
      );
      fs.writeFileSync(
        this.lockHandle,
        JSON.stringify({ pid: process.pid, createdAt: Date.now() }),
      );
    } catch {
      throw new ConflictException('Another process is managing worlds');
    }
  }
  release() {
    if (this.lockHandle === undefined) return;
    fs.closeSync(this.lockHandle);
    this.lockHandle = undefined;
    fs.unlinkSync(path.join(this.storage, 'world-operation.lock'));
  }
  async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  recoverLock() {
    const file = path.join(this.storage, 'world-operation.lock');
    if (fs.existsSync(file)) {
      const { pid } = JSON.parse(fs.readFileSync(file, 'utf8'));
      try {
        process.kill(pid, 0);
        throw new ConflictException('The operation process is still alive');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
      fs.unlinkSync(file);
    }
  }
  newWorld(name: string, image: string): WorldRecord {
    if (typeof name !== 'string' || !name.trim() || name.length > 80)
      throw new Error('World name must have 1 to 80 characters');
    const id = randomUUID();
    return {
      id,
      name: name.trim(),
      dataPath: path.join(this.storage, 'worlds', id, 'minecraft-data'),
      containerName: `calebs-world-${id}`,
      image,
      original: false,
      archived: false,
      initialized: false,
      minecraftVersion: '1.20.1',
      forgeVersion: '47.4.10',
      generation: randomUUID(),
      revision: 0,
      published: [],
      draft: [],
      createdAt: Date.now(),
    };
  }
}
