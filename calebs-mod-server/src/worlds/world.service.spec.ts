import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { WorldStore } from './world-store';
import { WorldService } from './world.service';
import { readArchive, writeArchive } from './world-archive';
import { contained, safeRelative } from './world-paths';
import type { WorldOperation, WorldRecord } from './world-store';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { WorldModule } from './world.module';
import { DockerService } from '../docker/docker.service';
import { RconService } from '../rcon/rcon.service';
import request from 'supertest';

describe('world management preserves existing data', () => {
  let root: string,
    config: ConfigService,
    db: DatabaseService,
    store: WorldStore,
    service: WorldService;
  let running: Set<string>;
  let failStart: string | undefined;
  let originalName: string;
  let update: jest.Mock;
  let forceStops: jest.Mock;
  let rcon: any;
  let docker: any;
  let removeContainer: jest.Mock;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'calebs-world-tests-'));
    config = new ConfigService({
      DB_PATH: path.join(root, 'db.sqlite'),
      WORLD_STORAGE_PATH: path.join(root, 'storage'),
      MINECRAFT_DATA_PATH: path.join(root, 'original'),
      MINECRAFT_CONTAINER_NAME: 'original-container',
      RCON_PASSWORD: 'host-secret',
    });
    db = new DatabaseService(config);
    db.onModuleInit();
    store = new WorldStore(db, config);
    store.onModuleInit();
    originalName = 'original-container';
    running = new Set();
    failStart = undefined;
    update = jest.fn().mockResolvedValue(undefined);
    forceStops = jest.fn();
    removeContainer = jest.fn().mockResolvedValue(undefined);
    const container = (world: WorldRecord) => ({
      inspect: async () => ({
        Image: 'sha256:pinned',
        Config: { Env: ['VERSION=1.20.1', 'FORGE_VERSION=47.4.10'] },
        Mounts: [{ Destination: '/data', Source: world.dataPath }],
        State: {
          Running: running.has(world.containerName),
          ExitCode: 0,
          OOMKilled: false,
        },
      }),
      update,
      remove: removeContainer,
      stop: async () => {
        forceStops(world.id);
        running.delete(world.containerName);
      },
      start: async () => {
        if (failStart === world.id) throw new Error('Bad target pack');
        running.add(world.containerName);
      },
    });
    docker = {
      getContainer: jest.fn(async (world: WorldRecord) => container(world)),
      createContainer: jest.fn(async (world: WorldRecord) => container(world)),
      assertNoOtherRunning: jest.fn(async (world: WorldRecord) => {
        for (const other of store.list())
          if (other.id !== world.id && running.has(other.containerName))
            throw new Error('Another world is running');
      }),
    };
    rcon = {
      send: jest.fn().mockResolvedValue('Saved the game'),
      say: jest.fn(),
      listPlayers: jest
        .fn()
        .mockResolvedValue('There are 0 of a max of 20 players online:'),
      resetConnection: jest.fn(),
      stop: jest.fn(async () => {
        running.clear();
      }),
    };
    service = new WorldService(store, docker, rcon);
    fs.mkdirSync(path.join(root, 'original', 'world', 'playerdata'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'original', 'world', 'level.dat'),
      'valuable world',
    );
    fs.writeFileSync(
      path.join(root, 'original', 'world', 'playerdata', 'friend.dat'),
      'inventory and progress',
    );
    fs.writeFileSync(
      path.join(root, 'original', 'server.properties'),
      'level-name=world\nrcon.password=host-secret\ndifficulty=hard\n',
    );
    fs.writeFileSync(
      path.join(root, 'original', 'whitelist.json'),
      '[{"name":"Friend","uuid":"friend-uuid"}]',
    );
    fs.mkdirSync(path.join(root, 'original', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'original', 'config', 'example.toml'),
      'runtime config',
    );
    fs.writeFileSync(
      path.join(root, 'original', 'config', 'generated.toml'),
      'generated config',
    );
    const hash = store.put(Buffer.from('uploaded config'));
    db.prepare(
      'INSERT INTO files(sha256,file_name,file_size,file_type,relative_path,created_at) VALUES(?,?,?,?,?,?)',
    ).run(
      hash,
      'example.toml',
      15,
      'config',
      'config/example.toml',
      Date.now(),
    );
  });
  afterEach(() => {
    db.getDb().close();
    const absolute = path.resolve(root);
    if (!absolute.startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw new Error('Unsafe cleanup');
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  async function finish(op: WorldOperation) {
    for (let i = 0; i < 500; i++) {
      const current = store.operation(op.id);
      if (current.status !== 'running') return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Operation did not finish');
  }
  async function adopt() {
    const op = await finish(service.adopt());
    if (op.status !== 'completed') throw new Error(op.error);
    expect(op.status).toBe('completed');
    return store.active()!;
  }

  it('adopts in place after a verified recovery restore, preserving changed and generated configs and legacy tables', async () => {
    running.add(originalName);
    const world = await adopt();
    expect(world.dataPath).toBe(path.join(root, 'original'));
    expect(running.has(originalName)).toBe(true);
    expect(update).toHaveBeenCalledWith({ RestartPolicy: { Name: 'no' } });
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'config', 'example.toml'),
        'utf8',
      ),
    ).toBe('runtime config');
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'config', 'generated.toml'),
        'utf8',
      ),
    ).toBe('generated config');
    expect(
      world.published.find((f) => f.relativePath === 'config/example.toml')!
        .serverSha256,
    ).not.toBe(world.published[0].sha256);
    expect(
      world.published.find((f) => f.relativePath === 'config/generated.toml')!
        .serverOnly,
    ).toBe(true);
    expect(db.prepare('SELECT count(*) AS count FROM files').get()).toEqual({
      count: 1,
    });
    const backup = service.backups(world.id)[0];
    expect(backup.kind).toBe('migration');
    const manifest = await readArchive(
      service.backupRecord(backup.id).file_path,
    );
    expect(
      manifest.checksums['data/world/playerdata/friend.dat'],
    ).toBeDefined();
    expect(manifest.checksums['private/database.sqlite']).toBeDefined();
  });
  it('fresh worlds reuse the pack without copying saves, and copies include player progress', async () => {
    const original = await adopt();
    const fresh = await finish(
      service.create({ name: 'Fresh', sourceId: original.id, seed: '123' }),
    );
    expect(fresh.status).toBe('completed');
    const world = store.get(fresh.worldId!);
    expect(fs.existsSync(path.join(world.dataPath, 'world'))).toBe(false);
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'config', 'example.toml'),
        'utf8',
      ),
    ).toBe('runtime config');
    const copied = await finish(
      service.create({ name: 'Copy', sourceId: original.id, copy: true }),
    );
    expect(copied.status).toBe('completed');
    expect(
      fs.readFileSync(
        path.join(
          store.get(copied.worldId!).dataPath,
          'world',
          'playerdata',
          'friend.dat',
        ),
        'utf8',
      ),
    ).toBe('inventory and progress');
    expect(store.active()!.id).toBe(original.id);
  });
  it('deletes an archived inactive world and its backups while preserving active data and shared pack files', async () => {
    const original = await adopt();
    const copied = await finish(
      service.create({ name: 'Disposable', sourceId: original.id, copy: true }),
    );
    const world = store.get(copied.worldId!);
    await finish(service.backup(world.id));
    const backup = service.backups(world.id)[0];
    const backupPath = service.backupRecord(backup.id).file_path;
    await service.edit(world.id, { archived: true });
    await expect(service.remove(world.id)).resolves.toEqual({
      deletedId: world.id,
    });
    expect(removeContainer).toHaveBeenCalledWith();
    expect(store.list().map((w) => w.id)).toEqual([original.id]);
    expect(store.active()!.id).toBe(original.id);
    expect(fs.existsSync(path.dirname(world.dataPath))).toBe(false);
    expect(fs.existsSync(backupPath)).toBe(false);
    expect(service.backups(world.id)).toEqual([]);
    expect(
      db
        .prepare('SELECT * FROM world_revisions WHERE world_id=?')
        .all(world.id),
    ).toEqual([]);
    expect(
      fs.readFileSync(
        path.join(original.dataPath, 'world', 'level.dat'),
        'utf8',
      ),
    ).toBe('valuable world');
    for (const file of original.published)
      expect(fs.existsSync(store.blob(file.sha256))).toBe(true);
  });
  it('rejects deletion of active, original, running, and unknown worlds', async () => {
    const original = await adopt();
    const world = store.newWorld('Inactive', original.image);
    store.save(world);
    store.setActive(world.id);
    await expect(service.remove(world.id)).rejects.toThrow('active world');
    await expect(service.remove(original.id)).rejects.toThrow('Original World');
    store.setActive(original.id);
    running.add(world.containerName);
    await expect(service.remove(world.id)).rejects.toThrow('running world');
    await expect(service.remove('missing')).rejects.toThrow('World not found');
    expect(removeContainer).not.toHaveBeenCalled();
    expect(store.list()).toHaveLength(2);
  });
  it('deletes a fresh world with no container or backups', async () => {
    const original = await adopt();
    const fresh = await finish(service.create({ name: 'Unused' }));
    docker.getContainer.mockResolvedValue(null);
    await service.remove(fresh.worldId!);
    expect(store.list()).toHaveLength(1);
    expect(store.active()!.id).toBe(original.id);
    expect(removeContainer).not.toHaveBeenCalled();
  });
  it('blocks deletion during maintenance and rejects paths or containers outside the managed world', async () => {
    const original = await adopt();
    const world = store.newWorld('Unsafe', original.image);
    store.save(world);
    store.acquire();
    try {
      await expect(service.remove(world.id)).rejects.toThrow('maintenance');
    } finally {
      store.release();
    }
    world.dataPath = original.dataPath;
    store.save(world);
    await expect(service.remove(world.id)).rejects.toThrow(
      'storage or container',
    );
    world.dataPath = path.join(
      store.storage,
      'worlds',
      world.id,
      'minecraft-data',
    );
    world.containerName = original.containerName;
    store.save(world);
    await expect(service.remove(world.id)).rejects.toThrow(
      'storage or container',
    );
    world.containerName = `calebs-world-${world.id}`;
    store.save(world);
    docker.getContainer.mockResolvedValue({
      inspect: async () => ({
        State: { Running: false },
        Mounts: [{ Destination: '/data', Source: original.dataPath }],
      }),
    });
    await expect(service.remove(world.id)).rejects.toThrow('mount mismatch');
    expect(removeContainer).not.toHaveBeenCalled();
    expect(fs.existsSync(original.dataPath)).toBe(true);
  });
  it('keeps the save and metadata when Docker container removal fails', async () => {
    const original = await adopt();
    const fresh = await finish(service.create({ name: 'Keep on failure' }));
    const world = store.get(fresh.worldId!);
    removeContainer.mockRejectedValue(new Error('Docker unavailable'));
    await expect(service.remove(world.id)).rejects.toThrow(
      'Docker unavailable',
    );
    expect(store.get(world.id)).toEqual(world);
    expect(fs.existsSync(world.dataPath)).toBe(true);
    expect(service.activeInfo().editing).toBe(false);
    expect(store.active()!.id).toBe(original.id);
  });
  it('keeps drafts private, applies only changed paths, and retains shared blob bytes', async () => {
    const world = await adopt();
    await service.editDraft(world.id, {
      relativePath: 'config/example.toml',
      remove: true,
    });
    expect(
      store
        .active()!
        .published.some((f) => f.relativePath === 'config/example.toml'),
    ).toBe(true);
    const oldHash = world.published[0].sha256;
    const op = await finish(service.apply(world.id));
    expect(op.status).toBe('completed');
    expect(
      fs.existsSync(path.join(world.dataPath, 'config', 'example.toml')),
    ).toBe(false);
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'config', 'generated.toml'),
        'utf8',
      ),
    ).toBe('generated config');
    expect(fs.existsSync(store.blob(oldHash))).toBe(true);
    expect(service.backups(world.id).some((b) => b.kind === 'automatic')).toBe(
      true,
    );
  });
  it('restores a portable backup as an independent world and keeps shared access', async () => {
    const original = await adopt();
    const saved = await finish(service.backup(original.id));
    expect(saved.status).toBe('completed');
    const backup = service
      .backups(original.id)
      .find((b) => b.kind === 'manual');
    const manifest = await readArchive(
      service.backupRecord(backup.id).file_path,
    );
    expect(manifest.checksums['private/database.sqlite']).toBeUndefined();
    fs.writeFileSync(
      path.join(store.storage, 'shared-access', 'whitelist.json'),
      '[]',
    );
    const restored = await finish(service.restore(backup.id, 'Restored'));
    expect(restored.status).toBe('completed');
    const world = store.get(restored.worldId!);
    expect(world.id).not.toBe(original.id);
    expect(
      fs.readFileSync(path.join(world.dataPath, 'whitelist.json'), 'utf8'),
    ).toBe('[]');
    expect(
      fs.readFileSync(path.join(world.dataPath, 'server.properties'), 'utf8'),
    ).toContain('rcon.password=host-secret');
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'world', 'playerdata', 'friend.dat'),
        'utf8',
      ),
    ).toBe('inventory and progress');
  });
  it('rolls back failed target startup and never changes the source save', async () => {
    const original = await adopt();
    await service.enableSwitching();
    const copied = await finish(
      service.create({ name: 'Target', sourceId: original.id, copy: true }),
    );
    running.add(original.containerName);
    failStart = copied.worldId;
    const op = await finish(service.switchWorld(copied.worldId!));
    expect(op.status).toBe('failed');
    expect(store.active()!.id).toBe(original.id);
    expect(running.has(original.containerName)).toBe(true);
    expect(
      fs.readFileSync(
        path.join(original.dataPath, 'world', 'level.dat'),
        'utf8',
      ),
    ).toBe('valuable world');
  });
  it('refuses to start an initialized world whose save is missing', async () => {
    const original = await adopt();
    fs.unlinkSync(path.join(original.dataPath, 'world', 'level.dat'));
    const op = await finish(service.control('start'));
    expect(op.status).toBe('failed');
    expect(running.size).toBe(0);
  });

  it('restores the incoming snapshot when a failed startup cannot be stopped through RCON', async () => {
    const original = await adopt();
    await service.enableSwitching();
    const copied = await finish(
      service.create({ name: 'Target', sourceId: original.id, copy: true }),
    );
    const target = store.get(copied.worldId!);
    running.add(original.containerName);
    const realStart = (service as any).startReady.bind(service);
    jest
      .spyOn(service as any, 'startReady')
      .mockImplementation(async (...args: any[]) => {
        if (args[0].id === target.id) {
          running.add(target.containerName);
          fs.writeFileSync(
            path.join(target.dataPath, 'world', 'level.dat'),
            'partial startup',
          );
          throw new Error('RCON unavailable');
        }
        return realStart(...args);
      });
    rcon.send.mockImplementation(async () => {
      if (running.has(target.containerName))
        throw new Error('RCON unavailable');
      return 'Saved the game';
    });
    const op = await finish(service.switchWorld(target.id));
    expect(op.status).toBe('failed');
    expect(forceStops).toHaveBeenCalledWith(target.id);
    expect(
      fs.readFileSync(path.join(target.dataPath, 'world', 'level.dat'), 'utf8'),
    ).toBe('valuable world');
    expect(running).toEqual(new Set([original.containerName]));
    expect(store.active()!.id).toBe(original.id);
  });
  it('fails backup without switching if saving fails, and prevents concurrent changes', async () => {
    const original = await adopt();
    await service.enableSwitching();
    const copied = await finish(
      service.create({ name: 'Target', sourceId: original.id, copy: true }),
    );
    running.add(original.containerName);
    rcon.send.mockRejectedValue(new Error('Save failed'));
    const op = service.switchWorld(copied.worldId!);
    await expect(service.edit(original.id, { name: 'Race' })).rejects.toThrow(
      'maintenance',
    );
    const result = await finish(op);
    expect(result.status).toBe('failed');
    expect(store.active()!.id).toBe(original.id);
    expect(running.has(original.containerName)).toBe(true);
  });
  it('requires rollout enablement and prohibits archiving the active world', async () => {
    const original = await adopt();
    expect(() => service.switchWorld(original.id)).toThrow('Release');
    await expect(service.edit(original.id, { archived: true })).rejects.toThrow(
      'active',
    );
  });
  it('validates archive contents and rejects corrupt backups before registering them', async () => {
    const original = await adopt();
    const file = path.join(root, 'corrupt.zip');
    await writeArchive(file, original, 'manual', [
      { name: 'data/world/level.dat', data: Buffer.from('save') },
    ]);
    const bytes = fs.readFileSync(file);
    bytes.fill(0, 0, 20);
    fs.writeFileSync(file, bytes);
    await expect(readArchive(file)).rejects.toThrow();
    const op = await finish(service.importBackup(file, 'Bad'));
    expect(op.status).toBe('failed');
    expect(store.list()).toHaveLength(1);
  });
  it('prevents links and escaping Windows archive paths', () => {
    for (const name of [
      '../world',
      '/world',
      'config/../../world',
      'config\\bad',
      'config/CON.txt',
      'config/file:stream',
      'config/bad.',
    ])
      expect(() => safeRelative(name)).toThrow();
    expect(contained(root, 'config/good.toml')).toBe(
      path.join(root, 'config', 'good.toml'),
    );
  });
  it('initializes the actual Nest module with only isolated storage and mocked Docker/RCON', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'isolated-test-secret',
              DB_PATH: path.join(root, 'module.sqlite'),
              WORLD_STORAGE_PATH: path.join(root, 'module-storage'),
              MINECRAFT_DATA_PATH: path.join(root, 'module-data'),
            }),
          ],
        }),
        WorldModule,
      ],
    })
      .overrideProvider(DockerService)
      .useValue(docker)
      .overrideProvider(RconService)
      .useValue(rcon)
      .compile();
    await module.init();
    expect(module.get(WorldStore).list()).toEqual([]);
    const app = module.createNestApplication();
    try {
      await app.init();
      await request(app.getHttpServer()).get('/api/worlds/active').expect(200);
      await request(app.getHttpServer()).get('/api/worlds').expect(403);
      await request(app.getHttpServer()).post('/api/worlds/adopt').expect(403);
      await request(app.getHttpServer())
        .delete('/api/worlds/protected')
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/worlds/recover')
        .expect(403);
    } finally {
      await app.close();
      module.get(DatabaseService).getDb().close();
      await module.close();
    }
  });

  it('keeps manual and migration backups while pruning only excess successful automatic backups', async () => {
    const original = await adopt();
    await finish(service.backup(original.id));
    for (let i = 0; i < 4; i++)
      await (service as any).makeBackup(original, 'automatic');
    (service as any).pruneBackups();
    const backups = service.backups(original.id);
    expect(backups.filter((b) => b.kind === 'automatic')).toHaveLength(2);
    expect(backups.filter((b) => b.kind === 'manual')).toHaveLength(1);
    expect(backups.filter((b) => b.kind === 'migration')).toHaveLength(1);
  });
  it('aborts when backup disk space is insufficient and leaves source data and selection intact', async () => {
    const original = await adopt();
    const stat = jest
      .spyOn(require('fs'), 'statfsSync')
      .mockReturnValue({ bavail: 0, bsize: 4096 });
    try {
      const op = await finish(service.backup(original.id));
      expect(op.status).toBe('failed');
      expect(op.error).toContain('disk space');
      expect(store.active()!.id).toBe(original.id);
      expect(
        fs.readFileSync(
          path.join(original.dataPath, 'world', 'level.dat'),
          'utf8',
        ),
      ).toBe('valuable world');
    } finally {
      stat.mockRestore();
    }
  });

  it('recovers an interrupted switch and keeps the outgoing world active', async () => {
    const original = await adopt();
    const copied = await finish(
      service.create({ name: 'Target', sourceId: original.id, copy: true }),
    );
    running.add(store.get(copied.worldId!).containerName);
    const interrupted: WorldOperation = {
      id: 'interrupted',
      kind: 'switch',
      sourceId: original.id,
      worldId: copied.worldId,
      status: 'running',
      phase: 'waiting_for_minecraft',
      wasRunning: true,
      createdAt: Date.now(),
    };
    store.saveOperation(interrupted);
    const op = await finish(service.recover());
    expect(op.status).toBe('completed');
    expect(running).toEqual(new Set([original.containerName]));
    expect(store.active()!.id).toBe(original.id);
    expect(store.operation(interrupted.id).phase).toBe('rolled_back');
  });
  it('restores server files and the previous publication if pack application fails', async () => {
    const original = await adopt();
    running.add(original.containerName);
    const published = structuredClone(original.published);
    await service.editDraft(original.id, {
      relativePath: 'config/example.toml',
      remove: true,
    });
    const realInstall = (service as any).installChanges.bind(service);
    jest
      .spyOn(service as any, 'installChanges')
      .mockImplementation((...args: any[]) => {
        realInstall(...args);
        throw new Error('Disk failure');
      });
    const op = await finish(service.apply(original.id));
    expect(op.status).toBe('failed');
    expect(store.active()!.published).toEqual(published);
    expect(
      fs.readFileSync(
        path.join(original.dataPath, 'config', 'example.toml'),
        'utf8',
      ),
    ).toBe('runtime config');
    expect(running.has(original.containerName)).toBe(true);
  });

  async function zipFile(entries: Record<string, Buffer | string>) {
    const yazl = require('yazl');
    const zip = new yazl.ZipFile();
    for (const [name, data] of Object.entries(entries))
      zip.addBuffer(Buffer.from(data), name);
    zip.end();
    const file = path.join(root, `${Math.random()}.zip`);
    await new Promise((resolve, reject) =>
      zip.outputStream
        .pipe(fs.createWriteStream(file))
        .on('close', resolve)
        .on('error', reject),
    );
    return file;
  }
  const jar = (modId: string, version: string) =>
    zipFile({
      'META-INF/mods.toml': `modLoader="javafml"\n[[mods]]\nmodId="${modId}"\nversion="${version}"\n[[dependencies.${modId}]]\nmodId="forge"\n`,
    }).then((file) => fs.readFileSync(file));

  it('maps pack ZIP entries by whole path segment', () => {
    const { packDestination } = require('./world.service');
    expect(packDestination('overrides/mods/a.jar')).toEqual({
      relative: 'mods/a.jar',
      clientOnly: false,
    });
    expect(packDestination('Pack/overrides/config/a.toml')!.relative).toBe(
      'config/a.toml',
    );
    expect(packDestination('Pack/mods/a.jar')!.relative).toBe('mods/a.jar');
    expect(packDestination('Pack/options.txt')!.relative).toBe('options.txt');
    expect(packDestination('config/somemod/overrides/x.json')!.relative).toBe(
      'config/somemod/overrides/x.json',
    );
    expect(packDestination('config/mods/foo.toml')!.relative).toBe(
      'config/mods/foo.toml',
    );
    expect(packDestination('overrides/.for-manual-install/mods/s.jar')).toEqual(
      { relative: 'mods/s.jar', clientOnly: true },
    );
    expect(packDestination('Pack/patchouli_books/b/x.json')!.relative).toBe(
      'patchouli_books/b/x.json',
    );
    // Unmanaged entries are ignored, even with names Windows cannot store.
    expect(packDestination('manifest.json')).toBeUndefined();
    expect(packDestination('kubejs/bad:name.js')).toBeUndefined();
    expect(() => packDestination('mods/../evil.jar')).toThrow();
  });

  it('keeps side flags on re-upload, removes missing files in replace mode, and reports duplicate mods', async () => {
    const original = await adopt();
    const created = await finish(
      service.create({ name: 'Packs', sourceId: original.id }),
    );
    const id = created.worldId!;
    const oldJar = await jar('jei', '1');
    await service.uploadDraft(
      id,
      await zipFile({
        'Pack/overrides/mods/jei-1.jar': oldJar,
        'Pack/overrides/mods/shaders.jar': 'client mod',
      }),
    );
    await service.editDraft(id, {
      relativePath: 'mods/shaders.jar',
      serverOnly: false,
      clientOnly: true,
    });
    const merged = await service.uploadDraft(
      id,
      await zipFile({
        'Pack/overrides/mods/jei-2.jar': await jar('jei', '2'),
        'Pack/overrides/mods/shaders.jar': 'client mod v2',
      }),
    );
    const draft = () => store.get(id).draft;
    expect(
      draft().find((f) => f.relativePath === 'mods/shaders.jar')!.clientOnly,
    ).toBe(true);
    expect(merged.duplicateMods).toEqual([
      { modId: 'jei', files: ['mods/jei-1.jar', 'mods/jei-2.jar'] },
    ]);
    const op = await finish(service.apply(id));
    expect(op.status).toBe('failed');
    expect(op.error).toContain('duplicate mods');
    const replaced = await service.uploadDraft(
      id,
      await zipFile({
        'Pack/overrides/mods/jei-2.jar': await jar('jei', '2'),
        'Pack/overrides/mods/shaders.jar': 'client mod v2',
      }),
      'replace',
    );
    expect(replaced.removed).toContain('mods/jei-1.jar');
    expect(replaced.duplicateMods).toEqual([]);
    // Server-only files are never part of a client pack, so they stay.
    expect(
      draft().some((f) => f.relativePath === 'config/generated.toml'),
    ).toBe(true);
    expect((await finish(service.apply(id))).status).toBe('completed');
  });

  it('keeps the server copy of a config the uploaded pack did not change', async () => {
    const original = await adopt();
    await service.uploadDraft(
      original.id,
      await zipFile({ 'overrides/config/example.toml': 'uploaded config' }),
    );
    const entry = store
      .get(original.id)
      .draft.find((f) => f.relativePath === 'config/example.toml')!;
    expect(entry.serverSha256).toBeDefined();
    expect(service.changes(original.id)).toEqual([]);
    const changed = await service.uploadDraft(
      original.id,
      await zipFile({ 'overrides/config/example.toml': 'new pack config' }),
    );
    expect(changed.serverCopiesReplaced).toEqual(['config/example.toml']);
  });

  it('resets a world save but keeps its mods, settings, and serverconfig', async () => {
    const original = await adopt();
    const copied = await finish(
      service.create({ name: 'Season 2', sourceId: original.id, copy: true }),
    );
    const world = store.get(copied.worldId!);
    fs.mkdirSync(path.join(world.dataPath, 'world', 'serverconfig'));
    fs.writeFileSync(
      path.join(world.dataPath, 'world', 'serverconfig', 'mod-server.toml'),
      'tuned',
    );
    expect(() =>
      service.resetProgress(world.id, { confirmName: 'wrong' }),
    ).toThrow('Type the world name');
    const op = await finish(
      service.resetProgress(world.id, { confirmName: 'Season 2', seed: '42' }),
    );
    expect(op.status).toBe('completed');
    expect(fs.existsSync(path.join(world.dataPath, 'world', 'level.dat'))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(world.dataPath, 'world', 'playerdata')),
    ).toBe(false);
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'world', 'serverconfig', 'mod-server.toml'),
        'utf8',
      ),
    ).toBe('tuned');
    expect(
      fs.readFileSync(
        path.join(world.dataPath, 'config', 'example.toml'),
        'utf8',
      ),
    ).toBe('runtime config');
    expect(
      fs.readFileSync(path.join(world.dataPath, 'server.properties'), 'utf8'),
    ).toContain('level-seed=42');
    expect(store.get(world.id).initialized).toBe(false);
    expect(service.backups(world.id)[0].kind).toBe('automatic');
    expect(store.active()!.id).toBe(original.id);
  });

  it('never resets Original World', async () => {
    const original = await adopt();
    expect(() =>
      service.resetProgress(original.id, { confirmName: original.name }),
    ).toThrow('Original World is protected');
    expect(
      fs.readFileSync(
        path.join(original.dataPath, 'world', 'level.dat'),
        'utf8',
      ),
    ).toBe('valuable world');
  });

  it('keeps the active world when an operation on another world fails', async () => {
    const original = await adopt();
    running.add(original.containerName);
    const copied = await finish(
      service.create({ name: 'Other', sourceId: original.id, copy: true }),
    );
    const stat = jest
      .spyOn(require('fs'), 'statfsSync')
      .mockReturnValue({ bavail: 0, bsize: 4096 });
    try {
      const op = await finish(service.backup(copied.worldId!));
      expect(op.status).toBe('failed');
    } finally {
      stat.mockRestore();
    }
    expect(store.active()!.id).toBe(original.id);
  });

  it('only blocks players for operations that change what they sync', async () => {
    const original = await adopt();
    const save = (kind: string, worldId?: string) =>
      store.saveOperation({
        id: kind,
        kind,
        worldId,
        status: 'running',
        phase: 'x',
        createdAt: Date.now(),
      });
    save('backup', original.id);
    save('create', 'other');
    save('apply', 'other');
    expect(store.clientBlocked()).toBe(false);
    expect(service.activeInfo().operationPending).toBe(true);
    save('apply', original.id);
    expect(store.clientBlocked()).toBe(true);
  });

  it('reuses an unchanged backup of the incoming world when switching', async () => {
    const original = await adopt();
    await service.enableSwitching();
    const copied = await finish(
      service.create({ name: 'Target', sourceId: original.id, copy: true }),
    );
    const target = copied.worldId!;
    await finish(service.backup(target));
    const before = service.backups(target).length;
    const op = await finish(service.switchWorld(target));
    expect(op.status).toBe('completed');
    expect(service.backups(target)).toHaveLength(before);
  });

  it('accepts a non-zero exit after the log confirms the final save', async () => {
    const original = await adopt();
    running.add(original.containerName);
    fs.mkdirSync(path.join(original.dataPath, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(original.dataPath, 'logs', 'latest.log'), '');
    rcon.stop.mockImplementation(async () => {
      fs.appendFileSync(
        path.join(original.dataPath, 'logs', 'latest.log'),
        'ThreadedAnvilChunkStorage: All dimensions are saved\n',
      );
      running.clear();
    });
    const inspect = docker.getContainer;
    docker.getContainer = jest.fn(async (world: WorldRecord) => {
      const container = await inspect(world);
      const real = container.inspect;
      container.inspect = async () => {
        const info = await real();
        info.State.ExitCode = info.State.Running ? 0 : 1;
        return info;
      };
      return container;
    });
    const op = await finish(service.backup(original.id));
    expect(op.status).toBe('completed');
  });

  it('treats a lock as stale only after its heartbeat stops', () => {
    const lock = path.join(store.storage, 'world-operation.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, instance: 'x' }));
    expect(() => store.recoverLock()).toThrow('still managing worlds');
    const old = new Date(Date.now() - 120000);
    fs.utimesSync(lock, old, old);
    store.recoverLock();
    expect(fs.existsSync(lock)).toBe(false);
  });

  it('cleans up after an interrupted create during recovery', async () => {
    const original = await adopt();
    const orphan = '00000000-0000-4000-8000-000000000000';
    const directory = path.join(store.storage, 'worlds', orphan);
    fs.mkdirSync(path.join(directory, 'minecraft-data'), { recursive: true });
    fs.mkdirSync(path.join(store.storage, 'staging', 'leftover'), {
      recursive: true,
    });
    store.saveOperation({
      id: 'interrupted-create',
      kind: 'create',
      worldId: orphan,
      status: 'running',
      phase: 'creating',
      createdAt: Date.now(),
    });
    const op = await finish(service.recover());
    expect(op.status).toBe('completed');
    expect(fs.existsSync(directory)).toBe(false);
    expect(fs.existsSync(path.join(store.storage, 'staging', 'leftover'))).toBe(
      false,
    );
    expect(store.active()!.id).toBe(original.id);
  });
});
