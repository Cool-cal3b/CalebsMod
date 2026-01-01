import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rcon } from 'rcon-client';

@Injectable()
export class RconService implements OnModuleInit, OnModuleDestroy {
  private rcon: Rcon | null = null;
  private connected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const host = this.configService.get<string>('RCON_HOST') || 'localhost';
      const port = this.configService.get<number>('RCON_PORT') || 25575;
      const password = this.configService.get<string>('RCON_PASSWORD') || '';

      this.rcon = await Rcon.connect({
        host,
        port,
        password,
      });

      this.connected = true;
    } catch (error) {
      console.error('Failed to connect to RCON:', error.message);
      this.connected = false;
    }
  }

  private async disconnect() {
    if (this.rcon && this.connected) {
      await this.rcon.end();
      this.connected = false;
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
      this.connected = false;
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
