import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Dockerode;
  private containerName: string;

  constructor(private configService: ConfigService) {
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

  async getContainer(): Promise<Dockerode.Container | null> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find((c) =>
        c.Names.includes(`/${this.containerName}`),
      );

      if (container) {
        return this.docker.getContainer(container.Id);
      }

      return null;
    } catch (error) {
      console.error('Error getting container:', error);
      return null;
    }
  }

  async createContainer(): Dockerode.Container {
    const image =
      this.configService.get<string>('MINECRAFT_DOCKER_IMAGE') ||
      'itzg/minecraft-server:latest';
    const dataPath = path.resolve(
      this.configService.get<string>('MINECRAFT_DATA_PATH') ||
        './minecraft-data',
    );
    const serverPort =
      this.configService.get<number>('MINECRAFT_SERVER_PORT') || 25565;
    const rconPort = this.configService.get<number>('RCON_PORT') || 25575;
    const memory = this.configService.get<string>('MINECRAFT_MEMORY') || '4G';
    const minecraftVersion =
      this.configService.get<string>('MINECRAFT_VERSION') || '1.20.1';
    const minecraftType =
      this.configService.get<string>('MINECRAFT_TYPE') || 'FORGE';
    const rconPassword =
      this.configService.get<string>('RCON_PASSWORD') || 'minecraft';

    try {
      await this.docker.pull(image);
    } catch (error) {
      console.error('Error pulling image:', error);
    }

    const container = await this.docker.createContainer({
      Image: image,
      name: this.containerName,
      Env: [
        'EULA=TRUE',
        `MEMORY=${memory}`,
        `VERSION=${minecraftVersion}`,
        `TYPE=${minecraftType}`,
        'ENABLE_RCON=true',
        `RCON_PASSWORD=${rconPassword}`,
        `RCON_PORT=${rconPort}`,
        'ONLINE_MODE=true',
        'WHITE_LIST=true',
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
        return { status: ServerStatus.STARTED, message: 'Minecraft server started' };
      }

      return { status: ServerStatus.ALREADY_RUNNING, message: 'Server is already running' };
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

  async getServerStatus() {
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

  async getServerStats() {
    const container = await this.getContainer();

    if (!container) {
      return null;
    }

    const info = await container.inspect();

    if (!info.State.Running) {
      return null;
    }

    const stats = await container.stats({ stream: false });

    return {
      cpu_usage: stats.cpu_stats.cpu_usage.total_usage,
      memory_usage: stats.memory_stats.usage,
      memory_limit: stats.memory_stats.limit,
      network_rx: stats.networks?.eth0?.rx_bytes || 0,
      network_tx: stats.networks?.eth0?.tx_bytes || 0,
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