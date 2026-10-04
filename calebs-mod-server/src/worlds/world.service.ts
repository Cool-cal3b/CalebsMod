import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as yauzl from 'yauzl';
import { WorldStore } from './world-store';
import type { WorldFile, WorldOperation, WorldRecord } from './world-store';
import { DockerService } from '../docker/docker.service';
import { RconService } from '../rcon/rcon.service';
import {
  contained,
  hashFile,
  listFiles,
  requireSpace,
  safeRelative,
} from './world-paths';
import { readArchive, writeArchive } from './world-archive';
import type { ArchiveSource } from './world-archive';
import {
  readServerProperties,
  SERVER_SETTINGS,
  validateAndNormalizeSettings,
  writeServerProperties,
} from '../server/server-properties.util';

const ACCESS_FILES = [
  'whitelist.json',
  'ops.json',
  'banned-players.json',
  'banned-ips.json',
];
const PACK_ROOTS = [
  'mods',
  'config',
  'defaultconfigs',
  'resourcepacks',
  'shaderpacks',
  'panoramas',
  'thingpacks',
  'fancymenu_data',
  'globalresources',
  'patchouli_books',
];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WorldService {
  constructor(
    readonly store: WorldStore,
    private docker: DockerService,
    private rcon: RconService,
  ) {}

  activeInfo() {
    const world = this.store.active();
    return {
      world: world ? this.summary(world) : null,
      maintenance: this.store.pending().length > 0,
      editing: fs.existsSync(
        path.join(this.store.storage, 'world-operation.lock'),
      ),
    };
  }
  summary(world: WorldRecord) {
    const backups = this.backups(world.id);
    return {
      id: world.id,
      name: world.name,
      original: world.original,
      archived: world.archived,
      initialized: world.initialized,
      revision: world.revision,
      generation: world.generation,
      minecraftVersion: world.minecraftVersion,
      forgeVersion: world.forgeVersion,
      active: this.store.active()?.id === world.id,
      mods: world.published.filter((f) => f.fileType === 'mod').length,
      pendingChanges:
        JSON.stringify(world.draft) !== JSON.stringify(world.published),
      latestBackup: backups[0] || null,
    };
  }
  list() {
    return {
      ...this.activeInfo(),
      switchingEnabled: this.switchingEnabled(),
      worlds: this.store.list().map((w) => this.summary(w)),
      operations: this.store.pending(),
    };
  }
  switchingEnabled() {
    return (
      (
        this.store.db
          .prepare(
            "SELECT value FROM app_settings WHERE key='world_switching_enabled'",
          )
          .get() as { value: string } | undefined
      )?.value === '1'
    );
  }
  enableSwitching() {
    return this.store.exclusive(async () => {
      const original = this.store.list().find((w) => w.original);
      if (
        !original ||
        !this.backups(original.id).some((b) => b.kind === 'migration')
      )
        throw new ConflictException(
          'A verified Original World migration backup is required',
        );
      this.store.db
        .prepare(
          "INSERT INTO app_settings(key,value,updated_at) VALUES('world_switching_enabled','1',?) ON CONFLICT(key) DO UPDATE SET value='1',updated_at=excluded.updated_at",
        )
        .run(Date.now());
      return { enabled: true };
    });
  }
  detail(id: string) {
    const world = this.store.get(id);
    return {
      ...this.summary(world),
      published: world.published,
      draft: world.draft,
      backups: this.backups(id),
      settings: this.settings(id),
    };
  }
  backups(id: string) {
    return this.store.db
      .prepare(
        'SELECT id,world_id AS worldId,kind,created_at AS createdAt,sha256,size FROM world_backups WHERE world_id=? ORDER BY created_at DESC',
      )
      .all(id) as any[];
  }
  backupRecord(id: string) {
    const row = this.store.db
      .prepare('SELECT * FROM world_backups WHERE id=?')
      .get(id) as any;
    if (!row) throw new BadRequestException('Backup not found');
    return row;
  }
  phase(op: WorldOperation, phase: string) {
    op.phase = phase;
    this.store.saveOperation(op);
  }
  begin(
    kind: string,
    worldId: string | undefined,
    fn: (op: WorldOperation) => Promise<unknown>,
  ): WorldOperation {
    this.store.acquire();
    const op: WorldOperation = {
      id: randomUUID(),
      kind,
      worldId,
      status: 'running',
      phase: 'queued',
      createdAt: Date.now(),
    };
    try {
      this.store.saveOperation(op);
    } catch (error) {
      this.store.release();
      throw error;
    }
    void (async () => {
      try {
        op.result = await fn(op);
        op.status = 'completed';
        op.phase = 'done';
      } catch (error) {
        op.error = (error as Error).message;
        try {
          await this.rollback(op);
          this.removeUnregisteredWorld(op);
          op.status = 'failed';
          op.phase = 'rolled_back';
        } catch (recoveryError) {
          op.status = 'recovery_required';
          op.phase = 'recovery_required';
          op.error += `; recovery failed: ${(recoveryError as Error).message}`;
        }
      } finally {
        this.store.saveOperation(op);
        this.store.release();
      }
      if (op.status === 'completed') this.pruneBackups();
    })();
    return { ...op };
  }

  private legacy(): WorldRecord {
    const containerName =
      this.store.config.get<string>('MINECRAFT_CONTAINER_NAME') ||
      'calebs-minecraft-server';
    const world = this.store.newWorld('Original World', '');
    return {
      ...world,
      original: true,
      initialized: true,
      containerName,
      dataPath: this.store.dataPath(),
    };
  }
  adopt() {
    if (this.store.active())
      throw new ConflictException('Original World has already been adopted');
    return this.begin('adopt', undefined, async (op) => {
      const world = this.legacy();
      const container = await this.docker.getContainer(world);
      if (!container)
        throw new Error(
          'Existing Minecraft container is required for adoption',
        );
      const info = await container.inspect();
      const mount = info.Mounts?.find((m) => m.Destination === '/data');
      if (
        !mount ||
        path.resolve(mount.Source).toLowerCase() !==
          path.resolve(world.dataPath).toLowerCase()
      )
        throw new Error(
          'Container data mount does not match the existing world directory',
        );
      const env = info.Config.Env || [];
      const version = env.find((e) => e.startsWith('VERSION='))?.slice(8);
      const forge = env.find((e) => e.startsWith('FORGE_VERSION='))?.slice(14);
      if (version !== '1.20.1' || forge !== '47.4.10')
        throw new Error(
          'Existing container must use Minecraft 1.20.1 and Forge 47.4.10',
        );
      world.image = info.Image;
      // Persist the original descriptor for crash recovery before stopping anything.
      (op as WorldOperation & { sourceWorld: WorldRecord }).sourceWorld = world;
      op.wasRunning = info.State.Running;
      this.store.saveOperation(op);
      await this.stopClean(world, op);
      this.phase(op, 'capture_actual_server_files');
      const rows = this.store.db.prepare('SELECT * FROM files').all() as any[];
      const byPath = new Map<string, WorldFile>();
      for (const row of rows) {
        const file: WorldFile = {
          sha256: row.sha256,
          relativePath: row.relative_path.replace(/\\/g, '/'),
          fileName: row.file_name,
          fileSize: row.file_size,
          fileType: row.file_type,
          serverOnly: !!row.server_only,
          clientOnly: !!row.client_only,
          required: !!row.required,
        };
        const key = safeRelative(file.relativePath).toLowerCase();
        if (byPath.has(key))
          throw new Error(
            `Existing manifest has duplicate destination: ${file.relativePath}`,
          );
        if (!fs.existsSync(this.store.blob(file.sha256)))
          throw new Error(`Missing pack bytes: ${file.fileName}`);
        byPath.set(key, file);
      }
      for (const root of PACK_ROOTS) {
        for (const relative of listFiles(path.join(world.dataPath, root))) {
          const name = `${root}/${relative}`;
          const data = fs.readFileSync(contained(world.dataPath, name));
          const hash = this.store.put(data);
          const existing = byPath.get(name.toLowerCase());
          if (existing && existing.clientOnly) continue;
          if (existing) existing.serverSha256 = hash;
          else
            byPath.set(name.toLowerCase(), {
              sha256: hash,
              serverSha256: hash,
              relativePath: name,
              fileName: path.basename(name),
              fileSize: data.length,
              fileType: root === 'mods' ? 'mod' : 'config',
              serverOnly: true,
              clientOnly: false,
              required: true,
            });
        }
      }
      const files = [...byPath.values()];
      for (const file of files)
        if (
          !file.clientOnly &&
          !fs.existsSync(contained(world.dataPath, file.relativePath))
        )
          throw new Error(`Missing server file: ${file.relativePath}`);
      this.store.validatePack(files);
      world.published = files;
      world.draft = structuredClone(files);
      this.phase(op, 'migration_backup');
      const backup = await this.makeBackup(world, 'migration', true);
      op.rollbackBackup = backup.id;
      this.store.saveOperation(op);
      this.phase(op, 'verify_restore');
      const verification = path.join(this.store.storage, 'staging', op.id);
      fs.mkdirSync(verification, { recursive: true });
      try {
        await readArchive(this.backupRecord(backup.id).file_path, verification);
      } finally {
        this.removeStaging(verification);
      }
      this.captureAccess(world);
      this.phase(op, 'adopt_in_place');
      this.store.db.transaction(() => {
        this.store.publish(world, files);
        this.store.setActive(world.id);
      });
      op.worldId = world.id;
      op.sourceId = world.id;
      this.store.saveOperation(op);
      if (op.wasRunning) await this.startReady(world, op);
      this.store.save(world);
      this.store.db.logAudit('adopt_world', 'world', world.id, undefined, {
        backupId: backup.id,
      });
      return this.summary(world);
    });
  }

  private async stopClean(
    world: WorldRecord,
    op: WorldOperation,
    countdown = false,
  ) {
    const container = await this.docker.getContainer(world);
    if (!container || !(await container.inspect()).State.Running) return;
    this.phase(op, 'saving');
    if (countdown) {
      const players = await this.rcon.listPlayers();
      if (!/There are 0 of/.test(players)) {
        this.phase(op, 'countdown');
        await this.rcon.say(
          'World maintenance in 60 seconds. Please disconnect.',
        );
        await wait(30000);
        await this.rcon.say('World maintenance in 30 seconds.');
        await wait(20000);
        await this.rcon.say('World maintenance in 10 seconds.');
        await wait(10000);
      }
    }
    const saved = await this.rcon.send('save-all flush');
    if (/failed|unknown command|error/i.test(saved))
      throw new Error('Minecraft refused to save');
    await container.update({ RestartPolicy: { Name: 'no' } });
    this.phase(op, 'stopping');
    // Do not call Docker stop with a force-kill deadline. Minecraft exits itself.
    await this.rcon.stop().catch(() => undefined);
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const info = await container.inspect();
      if (!info.State.Running) {
        if (info.State.OOMKilled || info.State.ExitCode !== 0)
          throw new Error('Minecraft did not shut down cleanly');
        await this.rcon.resetConnection();
        return;
      }
      await wait(1000);
    }
    throw new Error(
      'Minecraft shutdown timed out; no backup or file changes were performed',
    );
  }
  private async startReady(world: WorldRecord, op: WorldOperation) {
    this.phase(op, 'starting');
    this.validateWorld(world);
    await this.validateBlobs(world.published);
    await this.docker.assertNoOtherRunning(world);
    let container = await this.docker.getContainer(world);
    if (!container) container = await this.docker.createContainer(world);
    const info = await container.inspect();
    const mount = info.Mounts?.find((m) => m.Destination === '/data');
    if (
      !mount ||
      path.resolve(mount.Source).toLowerCase() !==
        path.resolve(world.dataPath).toLowerCase()
    )
      throw new Error('World container mount mismatch');
    await this.rcon.resetConnection();
    await container.update({ RestartPolicy: { Name: 'unless-stopped' } });
    if (!info.State.Running) await container.start();
    this.phase(op, 'waiting_for_minecraft');
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const state = (await container.inspect()).State;
      if (!state.Running) throw new Error('Minecraft exited during startup');
      try {
        const players = await this.rcon.listPlayers();
        if (/There are \d+ of a max of \d+ players online/.test(players)) {
          if (!fs.existsSync(contained(world.dataPath, 'world/level.dat')))
            throw new Error('Expected world save was not created');
          world.initialized = true;
          return;
        }
      } catch {
        /* Retry until Minecraft and RCON are ready. */
      }
      await wait(2000);
    }
    throw new Error('Minecraft readiness timed out');
  }
  private validateWorld(world: WorldRecord) {
    if (world.archived) throw new Error('Unarchive this world first');
    if (world.minecraftVersion !== '1.20.1' || world.forgeVersion !== '47.4.10')
      throw new Error('Unsupported world versions');
    if (!fs.existsSync(world.dataPath))
      throw new Error('World directory is missing');
    const values = readServerProperties(world.dataPath).values;
    if (values['level-name'] !== 'world')
      throw new Error('The world must use level-name=world');
    if (
      world.initialized &&
      !fs.existsSync(contained(world.dataPath, 'world/level.dat'))
    )
      throw new Error(
        'Existing save is missing; refusing to generate a replacement',
      );
    this.store.validatePack(world.published);
    for (const file of world.published) {
      if (
        !fs.existsSync(this.store.blob(file.sha256)) ||
        (file.serverSha256 &&
          !fs.existsSync(this.store.blob(file.serverSha256)))
      )
        throw new Error(`Missing pack file: ${file.fileName}`);
      if (
        !file.clientOnly &&
        !fs.existsSync(contained(world.dataPath, file.relativePath))
      )
        throw new Error(`Missing installed server file: ${file.relativePath}`);
    }
    requireSpace(world.dataPath, 0);
  }

  private async validateBlobs(files: WorldFile[]) {
    const hashes = new Set(
      files.flatMap((file) => [
        file.sha256,
        ...(file.serverSha256 ? [file.serverSha256] : []),
      ]),
    );
    for (const hash of hashes)
      if ((await hashFile(this.store.blob(hash))) !== hash)
        throw new Error(`Pack bytes are corrupt: ${hash}`);
  }
  private captureAccess(world: WorldRecord) {
    const shared = path.join(this.store.storage, 'shared-access');
    fs.mkdirSync(shared, { recursive: true });
    for (const name of ACCESS_FILES) {
      const source = contained(world.dataPath, name);
      if (fs.existsSync(source)) {
        JSON.parse(fs.readFileSync(source, 'utf8'));
        fs.copyFileSync(source, path.join(shared, name));
      } else fs.writeFileSync(path.join(shared, name), '[]');
    }
  }
  private applyAccess(world: WorldRecord) {
    for (const name of ACCESS_FILES) {
      const source = path.join(this.store.storage, 'shared-access', name);
      if (fs.existsSync(source))
        fs.copyFileSync(source, contained(world.dataPath, name));
    }
  }
  switchWorld(id: string) {
    if (!this.switchingEnabled())
      throw new ConflictException(
        'Release the updated Windows and macOS clients, then enable switching in Admin > Worlds',
      );
    const target = this.store.get(id);
    const source = this.store.active();
    if (!source) throw new ConflictException('Adopt Original World first');
    if (source.id === id)
      throw new BadRequestException('This world is already active');
    this.validateWorld(target);
    return this.begin('switch', id, async (op) => {
      op.sourceId = source.id;
      op.wasRunning =
        !!(await this.docker.getContainer(source)) &&
        !!(await (await this.docker.getContainer(source))!.inspect()).State
          .Running;
      this.store.saveOperation(op);
      await this.stopClean(source, op, true);
      this.captureAccess(source);
      this.phase(op, 'backup');
      await this.makeBackup(source, 'automatic');
      this.phase(op, 'backup_incoming_world');
      op.targetBackup = (await this.makeBackup(target, 'automatic')).id;
      this.store.saveOperation(op);
      this.applyAccess(target);
      await this.startReady(target, op);
      this.phase(op, 'commit');
      this.store.save(target);
      this.store.setActive(target.id);
      this.store.db.logAudit('switch_world', 'world', target.id, undefined, {
        sourceId: source.id,
      });
      return this.summary(target);
    });
  }
  control(action: 'start' | 'stop' | 'restart') {
    const world = this.store.active() || this.legacy();
    return this.begin(action, world.id, async (op) => {
      if (this.store.active()) op.sourceId = world.id;
      else
        (op as WorldOperation & { sourceWorld: WorldRecord }).sourceWorld =
          world;
      op.wasRunning = !!(
        await (await this.docker.getContainer(world))?.inspect()
      )?.State.Running;
      this.store.saveOperation(op);
      if (action !== 'start') await this.stopClean(world, op);
      this.captureAccess(world);
      if (action !== 'stop') {
        this.applyAccess(world);
        await this.startReady(world, op);
      }
      if (this.store.active()) this.store.save(world);
      return { status: action === 'stop' ? 'stopped' : 'started' };
    });
  }
  backup(id: string) {
    const world = this.store.get(id);
    return this.begin('backup', id, async (op) => {
      op.sourceId = id;
      op.wasRunning = !!(
        await (await this.docker.getContainer(world))?.inspect()
      )?.State.Running;
      this.store.saveOperation(op);
      await this.stopClean(world, op, true);
      this.phase(op, 'backup');
      const backup = await this.makeBackup(world, 'manual');
      if (op.wasRunning) await this.startReady(world, op);
      return backup;
    });
  }

  private async makeBackup(
    world: WorldRecord,
    kind: 'manual' | 'automatic' | 'migration',
    recovery = false,
  ) {
    const container = await this.docker.getContainer(world);
    if (container && (await container.inspect()).State.Running)
      throw new Error('Cannot back up a running world');
    const id = randomUUID();
    const dir = path.join(this.store.storage, 'world-backups', world.id);
    fs.mkdirSync(dir, { recursive: true });
    const sources: ArchiveSource[] = [];
    for (const relative of listFiles(world.dataPath)) {
      if (!recovery && ['.rcon-cli.env', '.rcon-cli.yaml'].includes(relative))
        continue;
      const file = contained(world.dataPath, relative);
      if (!recovery && relative === 'server.properties')
        sources.push({
          name: `data/${relative}`,
          data: Buffer.from(
            fs
              .readFileSync(file, 'utf8')
              .replace(/^rcon\.password=.*$/gm, 'rcon.password='),
          ),
        });
      else sources.push({ name: `data/${relative}`, file });
    }
    const hashes = recovery
      ? listFiles(this.store.blobs)
      : [
          ...new Set(
            [...world.published, ...world.draft].flatMap((f) => [
              f.sha256,
              ...(f.serverSha256 ? [f.serverSha256] : []),
            ]),
          ),
        ];
    for (const hash of hashes)
      sources.push({ name: `pack-files/${hash}`, file: this.store.blob(hash) });
    const dbSnapshot = path.join(dir, `${id}.sqlite.partial`);
    try {
      if (recovery) {
        await this.store.db.getDb().backup(dbSnapshot);
        sources.push({ name: 'private/database.sqlite', file: dbSnapshot });
      }
      const file = path.join(dir, `${id}.zip`);
      const current = this.store
        .pending()
        .find((operation) => operation.status === 'running');
      const result = await writeArchive(
        file,
        world,
        kind,
        sources,
        (done, total) => {
          if (current) {
            const latest = this.store.operation(current.id);
            latest.progress = { done, total };
            this.store.saveOperation(latest);
          }
        },
      );
      this.store.db
        .prepare(
          'INSERT INTO world_backups(id,world_id,kind,created_at,file_path,sha256,size) VALUES(?,?,?,?,?,?,?)',
        )
        .run(id, world.id, kind, Date.now(), file, result.sha256, result.size);
      return {
        id,
        worldId: world.id,
        kind,
        sha256: result.sha256,
        size: result.size,
      };
    } finally {
      if (fs.existsSync(dbSnapshot)) fs.unlinkSync(dbSnapshot);
    }
  }
  private pruneBackups() {
    try {
      const worlds = this.store.db
        .prepare('SELECT DISTINCT world_id FROM world_backups')
        .all() as { world_id: string }[];
      for (const { world_id } of worlds) {
        const old = this.store.db
          .prepare(
            "SELECT id,file_path FROM world_backups WHERE world_id=? AND kind='automatic' ORDER BY created_at DESC LIMIT -1 OFFSET 10",
          )
          .all(world_id) as { id: string; file_path: string }[];
        for (const item of old) {
          const root = path.join(this.store.storage, 'world-backups');
          const relative = path
            .relative(root, item.file_path)
            .replace(/\\/g, '/');
          const file = contained(root, relative);
          if (fs.existsSync(file)) fs.unlinkSync(file);
          this.store.db
            .prepare('DELETE FROM world_backups WHERE id=?')
            .run(item.id);
        }
      }
    } catch (error) {
      console.error('Backup retention failed', error);
    }
  }
  private removeStaging(directory: string) {
    const root = path.join(this.store.storage, 'staging');
    const checked = contained(
      root,
      path.relative(root, directory).replace(/\\/g, '/'),
    );
    fs.rmSync(checked, { recursive: true, force: true });
  }

  private removeUnregisteredWorld(op: WorldOperation) {
    if (
      !['create', 'copy', 'import', 'restore'].includes(op.kind) ||
      !op.worldId ||
      this.store.list().some((w) => w.id === op.worldId)
    )
      return;
    if (!/^[a-f0-9-]{36}$/.test(op.worldId))
      throw new Error('Invalid staged world ID');
    const directory = contained(
      path.join(this.store.storage, 'worlds'),
      op.worldId,
    );
    if (fs.existsSync(directory))
      fs.rmSync(directory, { recursive: true, force: true });
  }

  private initializeRecord(world: WorldRecord) {
    const draft = structuredClone(world.draft);
    this.store.publish(world, world.published);
    world.draft = draft;
    this.store.save(world);
  }
  create(body: {
    name: string;
    sourceId?: string;
    copy?: boolean;
    seed?: string;
  }) {
    const active = this.store.active();
    if (!active) throw new ConflictException('Adopt Original World first');
    if (body.copy && !body.sourceId)
      throw new BadRequestException('A source world is required');
    if (
      body.seed !== undefined &&
      (typeof body.seed !== 'string' ||
        body.seed.length > 128 ||
        /[\r\n]/.test(body.seed))
    )
      throw new BadRequestException('Invalid seed');
    const source = body.sourceId ? this.store.get(body.sourceId) : undefined;
    const world = this.store.newWorld(body.name, active.image);
    return this.begin(body.copy ? 'copy' : 'create', world.id, async (op) => {
      fs.mkdirSync(world.dataPath, { recursive: true });
      if (source && body.copy) {
        op.sourceId = source.id;
        op.wasRunning = !!(
          await (await this.docker.getContainer(source))?.inspect()
        )?.State.Running;
        this.store.saveOperation(op);
        await this.stopClean(source, op, true);
        this.phase(op, 'backup');
        const backup = await this.makeBackup(source, 'automatic');
        this.phase(op, 'copying');
        await this.extractIntoNewWorld(
          this.backupRecord(backup.id).file_path,
          world,
          op,
        );
        if (op.wasRunning) await this.startReady(source, op);
      } else {
        this.phase(op, 'creating');
        if (source) {
          world.published = structuredClone(source.published);
          const properties = readServerProperties(source.dataPath).values;
          const copied = Object.fromEntries(
            SERVER_SETTINGS.map((s) => [s.key, properties[s.key] ?? s.default]),
          );
          writeServerProperties(copied, world.dataPath);
        }
        writeServerProperties(
          {
            'level-name': 'world',
            ...(body.seed !== undefined ? { 'level-seed': body.seed } : {}),
          },
          world.dataPath,
        );
        this.installChanges(world, [], world.published);
        world.draft = structuredClone(world.published);
        this.applyAccess(world);
      }
      this.initializeRecord(world);
      this.store.db.logAudit('create_world', 'world', world.id, undefined, {
        sourceId: source?.id,
        copy: !!body.copy,
      });
      return this.summary(world);
    });
  }
  importBackup(file: string, name: string) {
    const active = this.store.active();
    if (!active) throw new ConflictException('Adopt Original World first');
    const world = this.store.newWorld(name, active.image);
    return this.begin('import', world.id, async (op) => {
      try {
        fs.mkdirSync(world.dataPath, { recursive: true });
        await this.extractIntoNewWorld(file, world, op);
        this.initializeRecord(world);
        return this.summary(world);
      } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    });
  }
  restore(id: string, name: string) {
    return this.importExistingBackup(this.backupRecord(id).file_path, name);
  }
  private importExistingBackup(file: string, name: string) {
    const active = this.store.active();
    if (!active) throw new ConflictException('Adopt Original World first');
    const world = this.store.newWorld(name, active.image);
    return this.begin('restore', world.id, async (op) => {
      fs.mkdirSync(world.dataPath, { recursive: true });
      await this.extractIntoNewWorld(file, world, op);
      this.initializeRecord(world);
      return this.summary(world);
    });
  }
  private async extractIntoNewWorld(
    file: string,
    world: WorldRecord,
    op: WorldOperation,
  ) {
    this.phase(op, 'verifying_import');
    const staging = path.join(this.store.storage, 'staging', op.id);
    fs.mkdirSync(staging, { recursive: true });
    try {
      const manifest = await readArchive(file, staging);
      if (
        manifest.world.minecraftVersion !== '1.20.1' ||
        manifest.world.forgeVersion !== '47.4.10'
      )
        throw new Error('Backup uses unsupported Minecraft or Forge versions');
      this.store.validatePack(manifest.world.published);
      this.store.validatePack(manifest.world.draft);
      for (const file of [
        ...manifest.world.published,
        ...manifest.world.draft,
      ]) {
        for (const hash of [
          file.sha256,
          ...(file.serverSha256 ? [file.serverSha256] : []),
        ]) {
          const source = contained(staging, `pack-files/${hash}`);
          if (!fs.existsSync(source))
            throw new Error('Backup is missing referenced pack bytes');
          if (!fs.existsSync(this.store.blob(hash)))
            fs.copyFileSync(
              source,
              this.store.blob(hash),
              fs.constants.COPYFILE_EXCL,
            );
        }
      }
      this.phase(op, 'importing');
      for (const relative of listFiles(path.join(staging, 'data'))) {
        const target = contained(world.dataPath, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(
          contained(staging, `data/${relative}`),
          target,
          fs.constants.COPYFILE_EXCL,
        );
      }
      world.published = manifest.world.published;
      world.draft = manifest.world.draft;
      if (typeof manifest.world.initialized !== 'boolean')
        throw new Error('Invalid world initialization state');
      world.initialized = manifest.world.initialized;
      writeServerProperties(
        {
          'rcon.password':
            this.store.config.get<string>('RCON_PASSWORD') || 'minecraft',
        },
        world.dataPath,
      );
      this.applyAccess(world);
      this.validateWorld(world);
    } finally {
      this.removeStaging(staging);
    }
  }
  async edit(id: string, changes: { name?: string; archived?: boolean }) {
    return this.store.exclusive(async () => {
      const world = this.store.get(id);
      if (changes.name !== undefined)
        world.name = this.store.newWorld(changes.name, world.image).name;
      if (changes.archived !== undefined) {
        if (typeof changes.archived !== 'boolean')
          throw new BadRequestException('archived must be boolean');
        if (changes.archived && this.store.active()?.id === id)
          throw new ConflictException('The active world cannot be archived');
        world.archived = changes.archived;
      }
      this.store.save(world);
      return this.summary(world);
    });
  }
  async remove(id: string) {
    return this.store.exclusive(async () => {
      const world = this.store.get(id);
      if (this.store.active()?.id === id)
        throw new ConflictException(
          'Switch to another world before deleting the active world',
        );
      if (world.original)
        throw new ConflictException('Original World cannot be deleted');
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw new BadRequestException('Invalid world ID');
      const directory = contained(path.join(this.store.storage, 'worlds'), id);
      const dataPath = contained(directory, 'minecraft-data');
      const backups = contained(
        path.join(this.store.storage, 'world-backups'),
        id,
      );
      if (
        path.resolve(world.dataPath) !== dataPath ||
        world.containerName !== `calebs-world-${id}`
      )
        throw new ConflictException(
          'World storage or container does not match its ID',
        );
      const container = await this.docker.getContainer(world);
      if (container) {
        const info = await container.inspect();
        if (info.State.Running)
          throw new ConflictException('A running world cannot be deleted');
        const mount = info.Mounts?.find((m) => m.Destination === '/data');
        if (!mount || path.resolve(mount.Source) !== dataPath)
          throw new ConflictException('World container mount mismatch');
        await container.remove();
      }
      await fs.promises.rm(directory, { recursive: true, force: true });
      await fs.promises.rm(backups, { recursive: true, force: true });
      this.store.db.transaction(() => {
        this.store.db
          .prepare('DELETE FROM world_backups WHERE world_id=?')
          .run(id);
        this.store.db
          .prepare('DELETE FROM world_revisions WHERE world_id=?')
          .run(id);
        this.store.db.prepare('DELETE FROM worlds WHERE id=?').run(id);
      });
      return { deletedId: id };
    });
  }
  settings(id: string) {
    const world = this.store.get(id);
    const { values, fileExists } = readServerProperties(world.dataPath);
    return {
      fileExists,
      settings: SERVER_SETTINGS.map((s) => ({
        ...s,
        liveCommand: undefined,
        value: values[s.key] ?? s.default,
        appliesLive: !!s.liveCommand,
      })),
    };
  }
  async updateSettings(id: string, updates: Record<string, string>) {
    return this.store.exclusive(async () => {
      const world = this.store.get(id);
      const normalized = validateAndNormalizeSettings(updates);
      writeServerProperties(normalized, world.dataPath);
      const live: string[] = [];
      const restartRequired: string[] = [];
      if (
        this.store.active()?.id === id &&
        (await (await this.docker.getContainer(world))?.inspect())?.State
          .Running
      ) {
        for (const [key, value] of Object.entries(normalized)) {
          const definition = SERVER_SETTINGS.find((s) => s.key === key);
          if (definition?.liveCommand) {
            try {
              await this.rcon.send(definition.liveCommand(value));
              live.push(key);
            } catch {
              restartRequired.push(key);
            }
          } else restartRequired.push(key);
        }
      }
      return { ...this.settings(id), appliedLive: live, restartRequired };
    });
  }
  async editDraft(
    id: string,
    body: {
      relativePath?: string;
      remove?: boolean;
      serverOnly?: boolean;
      clientOnly?: boolean;
      discard?: boolean;
    },
  ) {
    return this.store.exclusive(async () => {
      const world = this.store.get(id);
      if (body.discard) world.draft = structuredClone(world.published);
      else {
        safeRelative(body.relativePath!);
        const file = world.draft.find(
          (f) => f.relativePath === body.relativePath,
        );
        if (!file) throw new BadRequestException('Draft file not found');
        if (body.remove) world.draft = world.draft.filter((f) => f !== file);
        else {
          if (
            typeof body.serverOnly !== 'boolean' ||
            typeof body.clientOnly !== 'boolean' ||
            (body.serverOnly && body.clientOnly)
          )
            throw new BadRequestException('Invalid file flags');
          file.serverOnly = body.serverOnly;
          file.clientOnly = body.clientOnly;
        }
      }
      this.store.validatePack(world.draft);
      this.store.save(world);
      return this.detail(id);
    });
  }
  async uploadDraft(id: string, file: string) {
    return this.store.exclusive(async () => {
      try {
        const world = this.store.get(id);
        const draft = new Map(
          world.draft.map((f) => [f.relativePath.toLowerCase(), f]),
        );
        const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
          yauzl.open(
            file,
            { lazyEntries: true, validateEntrySizes: true },
            (error, zip) => (error ? reject(error) : resolve(zip!)),
          ),
        );
        let count = 0,
          bytes = 0;
        const seen = new Set<string>();
        try {
          await new Promise<void>((resolve, reject) => {
            zip.on('error', reject);
            zip.on('end', resolve);
            zip.on('entry', (entry: yauzl.Entry) => {
              void (async () => {
                if (
                  ++count > 200000 ||
                  (bytes += entry.uncompressedSize) > 2 * 1024 ** 3
                )
                  throw new Error('Modpack upload is too large');
                const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
                if (
                  (mode && mode !== 0x8000 && mode !== 0x4000) ||
                  entry.isEncrypted()
                )
                  throw new Error('Unsupported pack entry');
                const directory = entry.fileName.endsWith('/');
                const original = safeRelative(
                  directory ? entry.fileName.slice(0, -1) : entry.fileName,
                );
                if (directory) {
                  zip.readEntry();
                  return;
                }
                if (entry.uncompressedSize > 256 * 1024 ** 2)
                  throw new Error('Modpack file is too large');
                let relative = original;
                if (relative.includes('overrides/'))
                  relative = relative.split('overrides/')[1];
                const clientOnly = relative.includes('.for-manual-install/');
                if (clientOnly)
                  relative = relative.split('.for-manual-install/')[1];
                const match = relative.match(
                  /^[^/]+\/(mods|config|defaultconfigs|resourcepacks|shaderpacks|panoramas|thingpacks)\//,
                );
                if (match) relative = relative.slice(relative.indexOf('/') + 1);
                if (
                  !PACK_ROOTS.some((root) => relative.startsWith(root + '/')) &&
                  !['options.txt', 'servers.dat', 'server.dat'].includes(
                    relative,
                  )
                ) {
                  zip.readEntry();
                  return;
                }
                safeRelative(relative);
                if (seen.has(relative.toLowerCase()))
                  throw new Error(`Duplicate pack path: ${relative}`);
                seen.add(relative.toLowerCase());
                const stream = await new Promise<NodeJS.ReadableStream>(
                  (res, rej) =>
                    zip.openReadStream(entry, (error, stream) =>
                      error ? rej(error) : res(stream!),
                    ),
                );
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of stream as AsyncIterable<Buffer>) {
                  size += chunk.length;
                  if (size > entry.uncompressedSize)
                    throw new Error('Pack entry size mismatch');
                  chunks.push(chunk);
                }
                const data = Buffer.concat(chunks);
                const hash = this.store.put(data);
                draft.set(relative.toLowerCase(), {
                  sha256: hash,
                  relativePath: relative,
                  fileName: path.basename(relative),
                  fileSize: data.length,
                  fileType: relative.startsWith('mods/')
                    ? 'mod'
                    : relative.split('/')[0],
                  serverOnly: false,
                  clientOnly:
                    clientOnly ||
                    ['options.txt', 'servers.dat', 'server.dat'].includes(
                      relative,
                    ),
                  required: true,
                });
                zip.readEntry();
              })().catch(reject);
            });
            zip.readEntry();
          });
        } finally {
          zip.close();
        }
        world.draft = [...draft.values()];
        this.store.validatePack(world.draft);
        this.store.save(world);
        return { filesProcessed: seen.size };
      } finally {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    });
  }
  changes(id: string) {
    const world = this.store.get(id);
    const old = new Map(world.published.map((f) => [f.relativePath, f]));
    const next = new Map(world.draft.map((f) => [f.relativePath, f]));
    return [...new Set([...old.keys(), ...next.keys()])]
      .filter(
        (key) => JSON.stringify(old.get(key)) !== JSON.stringify(next.get(key)),
      )
      .map((relativePath) => ({
        relativePath,
        action: !next.has(relativePath)
          ? 'remove'
          : old.has(relativePath)
            ? 'change'
            : 'add',
      }));
  }
  apply(id: string) {
    const world = this.store.get(id);
    if (!this.changes(id).length)
      throw new BadRequestException('There are no pending pack changes');
    this.store.validatePack(world.draft);
    return this.begin('apply', id, async (op) => {
      op.sourceId = id;
      op.wasRunning = !!(
        await (await this.docker.getContainer(world))?.inspect()
      )?.State.Running;
      this.store.saveOperation(op);
      await this.stopClean(world, op, true);
      this.phase(op, 'backup');
      const backup = await this.makeBackup(world, 'automatic');
      op.rollbackBackup = backup.id;
      this.store.saveOperation(op);
      this.phase(op, 'applying');
      this.installChanges(world, world.published, world.draft);
      const next = { ...world, published: structuredClone(world.draft) };
      if (op.wasRunning) await this.startReady(next, op);
      this.phase(op, 'publishing');
      this.store.publish(next, next.published);
      return this.summary(next);
    });
  }
  private installChanges(
    world: WorldRecord,
    before: WorldFile[],
    after: WorldFile[],
  ) {
    const old = new Map(
      before.filter((f) => !f.clientOnly).map((f) => [f.relativePath, f]),
    );
    const next = new Map(
      after.filter((f) => !f.clientOnly).map((f) => [f.relativePath, f]),
    );
    for (const [relative, file] of next) {
      const hash = file.serverSha256 || file.sha256;
      const previous = old.get(relative);
      if (previous && (previous.serverSha256 || previous.sha256) === hash)
        continue;
      const source = this.store.blob(hash);
      if (!fs.existsSync(source))
        throw new Error(`Missing pack bytes: ${relative}`);
      const target = contained(world.dataPath, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    for (const relative of old.keys())
      if (!next.has(relative)) {
        const file = contained(world.dataPath, relative);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
  }
  private async stopForRollback(
    world: WorldRecord,
    op: WorldOperation,
    backupId?: string,
  ) {
    try {
      await this.stopClean(world, op);
    } catch (error) {
      // A force-stop fallback is allowed only when every pre-operation byte
      // has a verified snapshot that will immediately be restored afterward.
      if (!backupId) throw error;
      const record = this.backupRecord(backupId);
      await readArchive(record.file_path);
      const container = await this.docker.getContainer(world);
      if (container && (await container.inspect()).State.Running) {
        await container.update({ RestartPolicy: { Name: 'no' } });
        await container.stop({ t: 120 });
        if ((await container.inspect()).State.Running)
          throw new Error('Failed to stop the unsuccessful world startup');
      }
      await this.rcon.resetConnection();
    }
  }
  private async restoreData(
    world: WorldRecord,
    backupId: string,
    op: WorldOperation,
  ) {
    const container = await this.docker.getContainer(world);
    if (container && (await container.inspect()).State.Running)
      throw new Error('Refusing to restore over a running world');
    const staging = path.join(
      this.store.storage,
      'staging',
      op.id + '-rollback',
    );
    fs.mkdirSync(staging, { recursive: true });
    try {
      const manifest = await readArchive(
        this.backupRecord(backupId).file_path,
        staging,
      );
      const files = listFiles(path.join(staging, 'data'));
      const expected = new Set(files);
      for (const relative of listFiles(world.dataPath))
        if (
          !expected.has(relative) &&
          !['.rcon-cli.env', '.rcon-cli.yaml'].includes(relative)
        )
          fs.unlinkSync(contained(world.dataPath, relative));
      for (const relative of files) {
        const destination = contained(world.dataPath, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(contained(staging, `data/${relative}`), destination);
      }
      writeServerProperties(
        {
          'rcon.password':
            this.store.config.get<string>('RCON_PASSWORD') || 'minecraft',
        },
        world.dataPath,
      );
      world.published = manifest.world.published;
      world.revision = manifest.world.revision;
      world.initialized = manifest.world.initialized;
      this.store.save(world);
    } finally {
      this.removeStaging(staging);
    }
  }
  private async rollback(op: WorldOperation) {
    const source = op.sourceId
      ? this.store.get(op.sourceId)
      : (op as WorldOperation & { sourceWorld?: WorldRecord }).sourceWorld;
    if (!source) return;
    this.phase(op, 'recovering_previous_world');
    if (op.kind === 'switch' && op.worldId && op.worldId !== source.id) {
      const target = this.store.get(op.worldId);
      await this.stopForRollback(target, op, op.targetBackup);
      if (op.targetBackup) await this.restoreData(target, op.targetBackup, op);
    }
    if (op.kind === 'apply' && op.rollbackBackup) {
      await this.stopForRollback(source, op, op.rollbackBackup);
      await this.restoreData(source, op.rollbackBackup, op);
    }
    if (this.store.list().some((w) => w.id === source.id))
      this.store.setActive(source.id);
    if (op.wasRunning) await this.startReady(source, op);
  }
  recover() {
    const hadLock = fs.existsSync(
      path.join(this.store.storage, 'world-operation.lock'),
    );
    this.store.recoverLock();
    const pending = this.store.pending();
    if (!pending.length && !hadLock)
      throw new BadRequestException('No interrupted operation needs recovery');
    for (const item of pending) {
      item.status = 'failed';
      this.store.saveOperation(item);
    }
    return this.begin('recover', undefined, async (op) => {
      try {
        for (const item of pending) {
          this.phase(op, `recovering_${item.kind}`);
          await this.rollback(item);
          item.status = 'failed';
          item.phase = 'rolled_back';
          item.error ||= 'Operation interrupted by server restart';
          this.store.saveOperation(item);
        }
        return { recovered: true };
      } catch (error) {
        for (const item of pending) {
          item.status = 'recovery_required';
          this.store.saveOperation(item);
        }
        throw error;
      }
    });
  }
}
