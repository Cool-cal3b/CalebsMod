import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rcon } from 'rcon-client';

@Injectable()
export class RconService implements OnModuleInit, OnModuleDestroy {
  private rcon: Rcon | null = null;
  private connected = false;
  private connecting = false;
  private lastConnectionAttempt = 0;
  private readonly CONNECTION_RETRY_DELAY = 5000;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    const now = Date.now();
    if (this.connecting || (now - this.lastConnectionAttempt) < this.CONNECTION_RETRY_DELAY) {
      return;
    }

    this.connecting = true;
    this.lastConnectionAttempt = now;

    try {
      await this.forceDisconnect();

      const host = this.configService.get<string>('RCON_HOST') || 'localhost';
      const port = this.configService.get<number>('RCON_PORT') || 25575;
      const password = this.configService.get<string>('RCON_PASSWORD') || '';

      this.rcon = await Rcon.connect({
        host,
        port,
        password,
        timeout: 5000,
      });

      this.rcon.on('error', () => {
        this.connected = false;
      });

      this.rcon.on('end', () => {
        this.connected = false;
      });

      this.connected = true;
    } catch (error) {
      this.connected = false;
      this.rcon = null;
    } finally {
      this.connecting = false;
    }
  }

  private forceDisconnect() {
    if (this.rcon) {
      try {
        const socket = (this.rcon as any).socket;
        if (socket) {
          socket.removeAllListeners?.();
          socket.destroy();
        }
      } catch (error) {
      }
      this.rcon = null;
    }
    this.connected = false;
  }

  private async disconnect() {
    if (this.rcon) {
      try {
        await this.rcon.end();
      } catch (error) {
      }
      this.forceDisconnect();
    }
  }

  async send(command: string): Promise<string> {
    if (!this.connected || !this.rcon) {
      await this.connect();
    }

    if (!this.connected || !this.rcon) {
      throw new Error('RCON not connected');
    }

    try {
      const response = await this.rcon.send(command);
      return response;
    } catch (error) {
      this.forceDisconnect();
      throw error;
    }
  }

  async whitelist(username: string): Promise<string> {
    return await this.send(`whitelist add ${username}`);
  }

  async removeWhitelist(username: string): Promise<string> {
    return await this.send(`whitelist remove ${username}`);
  }

  async listPlayers(): Promise<string> {
    return await this.send('list');
  }

  async stop(): Promise<string> {
    return await this.send('stop');
  }

  async say(message: string): Promise<string> {
    return await this.send(`say ${message}`);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
