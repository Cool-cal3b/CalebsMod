import { Injectable } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { RconService } from '../rcon/rcon.service';

@Injectable()
export class ServerService {
  constructor(
    private dockerService: DockerService,
    private rconService: RconService,
  ) {}

  async startServer() {
    return await this.dockerService.startServer();
  }

  async stopServer() {
    try {
      if (this.rconService.isConnected()) {
        await this.rconService.say('Server is shutting down...');
        await this.rconService.stop();
      }
    } catch (error) {
      console.error('Error sending shutdown message:', error);
    }

    return await this.dockerService.stopServer();
  }

  async restartServer() {
    try {
      if (this.rconService.isConnected()) {
        await this.rconService.say('Server is restarting...');
      }
    } catch (error) {
      console.error('Error sending restart message:', error);
    }

    return await this.dockerService.restartServer();
  }

  async getStatus() {
    const dockerStatus = await this.dockerService.getServerStatus();
    const rconConnected = this.rconService.isConnected();

    let players: { online: number; max: number; players: string[] } | null = null;
    if (dockerStatus.running && rconConnected) {
      try {
        const playerList = await this.rconService.listPlayers();
        players = this.parsePlayerList(playerList);
      } catch (error) {
        console.error('Error getting player list:', error);
      }
    }

    return {
      ...dockerStatus,
      rconConnected,
      players,
    };
  }

  async getMetrics() {
    const status = await this.dockerService.getServerStatus();

    if (!status.running) {
      return {
        status: 'offline',
        message: 'Server is not running',
      };
    }

    const stats = await this.dockerService.getServerStats();

    return {
      status: 'online',
      uptime: status.startedAt,
      stats: {
        cpu: stats?.cpu_usage || 0,
        memory: {
          used: stats?.memory_usage || 0,
          limit: stats?.memory_limit || 0,
          percentage: stats
            ? ((stats.memory_usage / stats.memory_limit) * 100).toFixed(2)
            : 0,
        },
        network: {
          rx: stats?.network_rx || 0,
          tx: stats?.network_tx || 0,
        },
      },
    };
  }

  async getLogs(tail = 100) {
    return await this.dockerService.getServerLogs(tail);
  }

  async sendCommand(command: string) {
    if (!this.rconService.isConnected()) {
      throw new Error('RCON is not connected');
    }

    return await this.rconService.send(command);
  }

  private parsePlayerList(
    playerList: string,
  ): { online: number; max: number; players: string[] } | null {
    const match = playerList.match(
      /There are (\d+) of a max of (\d+) players online:(.*)/,
    );

    if (!match) {
      return null;
    }

    const online = parseInt(match[1]);
    const max = parseInt(match[2]);
    const playersStr = match[3].trim();

    const players = playersStr
      ? playersStr.split(',').map((p) => p.trim())
      : [];

    return { online, max, players };
  }
}
