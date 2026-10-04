import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import * as path from 'path';
import * as fs from 'fs';
import { WorldStore } from '../worlds/world-store';
import type { WorldRecord } from '../worlds/world-store';

export interface DockerServerStatus {
  exists: boolean;
  running: boolean;
  status: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface DockerResourceStats {
  cpu_usage: number;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  network_rx: number;
  network_tx: number;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Dockerode;
  private containerName: string;

  constructor(
    private configService: ConfigService,
    private worlds: WorldStore,
  ) {
    this.docker = new Dockerode();
    this.containerName =
      this.configService.get<string>('MINECRAFT_CONTAINER_NAME') ||
      'calebs-minecraft-server';
  }

  async onModuleInit() {
    const dataPath =
      this.configService.get<string>('MINECRAFT_DATA_PATH') ||
      './minecraft-data';
    const absolutePath = path.resolve(dataPath);

    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
  }

  async getContainer(world?: WorldRecord): Promise<Dockerode.Container | null> {
    const name =
      world?.containerName ||
      this.worlds.active()?.containerName ||
      this.containerName;
    try {
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find((c) => c.Names.includes(`/${name}`));

      if (container) {
        return this.docker.getContainer(container.Id);
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  async createContainer(world?: WorldRecord): Promise<Dockerode.Container> {
    world ||= this.worlds.active();
    const image =
      world?.image ||
      this.configService.get<string>('MINECRAFT_DOCKER_IMAGE') ||
      'itzg/minecraft-server:latest';
    const dataPath = path.resolve(
      world?.dataPath ||
        this.configService.get<string>('MINECRAFT_DATA_PATH') ||
        './minecraft-data',
    );
    const serverPort =
      this.configService.get<number>('MINECRAFT_SERVER_PORT') || 25565;
    const rconPort = this.configService.get<number>('RCON_PORT') || 25575;
    const memory = this.configService.get<string>('MINECRAFT_MEMORY') || '4G';
    const minecraftVersion =
      world?.minecraftVersion ||
      this.configService.get<string>('MINECRAFT_VERSION') ||
      '1.20.1';
    const minecraftType =
      this.configService.get<string>('MINECRAFT_TYPE') || 'FORGE';
    const forgeVersion =
      world?.forgeVersion || this.configService.get<string>('FORGE_VERSION');
    const levelType = this.configService.get<string>('LEVEL_TYPE');
    // itzg's variable is ENABLE_WHITELIST; 'WHITE_LIST' was silently ignored,
    // which left white-list=false and the access/approve flow unenforced.
    const enableWhitelist =
      this.configService.get<string>('ENABLE_WHITELIST') || 'false';
    const rconPassword =
      this.configService.get<string>('RCON_PASSWORD') || 'minecraft';

    // Managed worlds use the adopted image ID already present on this host.
    // Never silently replace it by pulling a mutable latest tag.
    if (!world) {
      const stream = await this.docker.pull(image);
      await new Promise<void>((resolve, reject) =>
        this.docker.modem.followProgress(stream, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }

    const container = await this.docker.createContainer({
      Image: image,
      name: world?.containerName || this.containerName,
      Env: [
        'EULA=TRUE',
        `MEMORY=${memory}`,
        `VERSION=${minecraftVersion}`,
        `TYPE=${minecraftType}`,
        ...(forgeVersion ? [`FORGE_VERSION=${forgeVersion}`] : []),
        ...(levelType ? [`LEVEL_TYPE=${levelType}`] : []),
        'ENABLE_RCON=true',
        `RCON_PASSWORD=${rconPassword}`,
        `RCON_PORT=${rconPort}`,
        'ONLINE_MODE=true',
        `ENABLE_WHITELIST=${enableWhitelist}`,
        'ENFORCE_WHITELIST=true',
      ],
      HostConfig: {
        Binds: [`${dataPath}:/data`],
        PortBindings: {
          '25565/tcp': [{ HostPort: serverPort.toString() }],
          [`${rconPort}/tcp`]: [{ HostPort: rconPort.toString() }],
        },
        RestartPolicy: {
          Name: 'unless-stopped',
        },
      },
      ExposedPorts: {
        '25565/tcp': {},
        [`${rconPort}/tcp`]: {},
      },
    });

    return container;
  }

  async assertNoOtherRunning(world: WorldRecord) {
    for (const candidate of this.worlds.list()) {
      if (candidate.id === world.id) continue;
      const container = await this.getContainer(candidate);
      if (container && (await container.inspect()).State.Running)
        throw new Error('Another world is still running');
    }
  }

  async startServer(): Promise<{ status: ServerStatus; message: string }> {
    console.log('Starting server');
    try {
      let container: Dockerode.Container | null = await this.getContainer();

      if (!container) {
        container = await this.createContainer();
      }

      const info = await container.inspect();

      if (!info.State.Running) {
        await container.start();
        return {
          status: ServerStatus.STARTED,
          message: 'Minecraft server started',
        };
      }

      return {
        status: ServerStatus.ALREADY_RUNNING,
        message: 'Server is already running',
      };
    } catch (error) {
      return { status: ServerStatus.ERROR, message: (error as Error).message };
    }
  }

  async stopServer() {
    const container = await this.getContainer();

    if (!container) {
      return { status: 'not_found', message: 'Container not found' };
    }

    const info = await container.inspect();

    if (info.State.Running) {
      await container.stop({ t: 30 });
      return { status: 'stopped', message: 'Minecraft server stopped' };
    }

    return { status: 'already_stopped', message: 'Server is already stopped' };
  }

  async restartServer() {
    const container = await this.getContainer();

    if (!container) {
      return await this.startServer();
    }

    await container.restart({ t: 30 });
    return { status: 'restarted', message: 'Minecraft server restarted' };
  }

  async getServerStatus(): Promise<DockerServerStatus> {
    const container = await this.getContainer();

    if (!container) {
      return {
        exists: false,
        running: false,
        status: 'not_created',
      };
    }

    const info = await container.inspect();

    return {
      exists: true,
      running: info.State.Running,
      status: info.State.Status,
      startedAt: info.State.StartedAt,
      finishedAt: info.State.FinishedAt,
    };
  }

  async getServerLogs(tail = 100) {
    const container = await this.getContainer();

    if (!container) {
      return '';
    }

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    return logs.toString();
  }

  async getServerStats(): Promise<DockerResourceStats | null> {
    const container = await this.getContainer();

    if (!container) {
      return null;
    }

    const info = await container.inspect();

    if (!info.State.Running) {
      return null;
    }

    const stats = await container.stats({ stream: false });

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta =
      (stats.cpu_stats.system_cpu_usage || 0) -
      (stats.precpu_stats.system_cpu_usage || 0);
    const cpuCount =
      stats.cpu_stats.online_cpus ||
      stats.cpu_stats.cpu_usage.percpu_usage?.length ||
      1;
    const cpuPercent =
      cpuDelta >= 0 && systemDelta > 0
        ? (cpuDelta / systemDelta) * cpuCount * 100
        : 0;

    // Docker's raw memory usage includes reclaimable file cache. Removing it
    // matches the working-set figure shown by `docker stats` and makes the
    // dashboard a better indicator of memory pressure.
    const memoryDetails = stats.memory_stats.stats as
      | Record<string, number>
      | undefined;
    const reclaimableCache =
      memoryDetails?.inactive_file ||
      memoryDetails?.total_inactive_file ||
      memoryDetails?.cache ||
      0;
    const memoryUsage = Math.max(
      0,
      (stats.memory_stats.usage || 0) - reclaimableCache,
    );
    const networks = Object.values(stats.networks || {}) as Array<{
      rx_bytes: number;
      tx_bytes: number;
    }>;

    return {
      cpu_usage: stats.cpu_stats.cpu_usage.total_usage,
      cpu_percent: cpuPercent,
      memory_usage: memoryUsage,
      memory_limit: stats.memory_stats.limit || 0,
      network_rx: networks.reduce(
        (total, network) => total + network.rx_bytes,
        0,
      ),
      network_tx: networks.reduce(
        (total, network) => total + network.tx_bytes,
        0,
      ),
    };
  }
}

export enum ServerStatus {
  STARTED = 'started',
  ALREADY_RUNNING = 'already_running',
  STOPPED = 'stopped',
  ALREADY_STOPPED = 'already_stopped',
  NOT_FOUND = 'not_found',
  ERROR = 'error',
}
