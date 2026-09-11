import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlayerActivityService } from '../player-activity/player-activity.service';
import { ServerService } from '../server/server.service';

const REPORT_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SECRET_HEADER = 'X-CalebsMod-Status-Secret';

export interface CalebsModStatusReport {
  schemaVersion: 1;
  reportedAtUtc: string;
  service: { startedAtUtc: string; uptimeSeconds: number };
  minecraft: {
    containerExists: boolean;
    running: boolean;
    state: string;
    startedAtUtc?: string;
    finishedAtUtc?: string;
    rconConnected: boolean;
    playerDataAvailable: boolean;
    playersOnline: number;
    playersMax: number;
    playerNames: string[];
  };
  players: Array<{
    username: string;
    uuid: string | null;
    lastConnectedAtUtc: string;
    joinCount: number;
  }>;
  clientVersions: { windows: string; mac: string };
}

@Injectable()
export class StatusReportService implements OnModuleInit, OnModuleDestroy {
  private readonly startedAtUtc = new Date(
    Date.now() - process.uptime() * 1000,
  ).toISOString();
  private readonly reportUrl: string;
  private readonly secret: string;
  private timer: NodeJS.Timeout | null = null;
  private sending = false;

  constructor(
    config: ConfigService,
    private readonly serverService: ServerService,
    private readonly playerActivityService: PlayerActivityService,
  ) {
    this.reportUrl = config.get<string>('CALEBS_SUPER_SITE_STATUS_URL') || '';
    this.secret = config.get<string>('CALEBS_SUPER_SITE_STATUS_SECRET') || '';
  }

  onModuleInit() {
    if (!this.reportUrl || !this.secret) {
      console.warn(
        'CalebsSuperSite status reporting is disabled: URL or secret is not configured.',
      );
      return;
    }

    void this.sendNow();
    this.timer = setInterval(() => void this.sendNow(), REPORT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async buildReport(): Promise<CalebsModStatusReport> {
    const status = await this.serverService.getStatus();
    const docker = status.dockerStatus;
    const players = this.playerActivityService.getAllPlayers();

    return {
      schemaVersion: 1,
      reportedAtUtc: new Date().toISOString(),
      service: {
        startedAtUtc: this.startedAtUtc,
        uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
      },
      minecraft: {
        containerExists: docker.exists,
        running: docker.running,
        state: docker.status,
        ...(this.validDate(docker.startedAt)
          ? { startedAtUtc: new Date(docker.startedAt).toISOString() }
          : {}),
        ...(this.validDate(docker.finishedAt)
          ? { finishedAtUtc: new Date(docker.finishedAt).toISOString() }
          : {}),
        rconConnected: status.rconConnected,
        playerDataAvailable: status.rconConnected,
        playersOnline: status.players.online,
        playersMax: status.players.max,
        playerNames: status.players.players,
      },
      players: players.map((player) => ({
        username: player.username,
        uuid: player.uuid,
        lastConnectedAtUtc: new Date(player.lastSeen).toISOString(),
        joinCount: player.joinCount,
      })),
      clientVersions: {
        windows: await this.readClientVersion('windows'),
        mac: await this.readClientVersion('mac'),
      },
    };
  }

  async sendNow(): Promise<void> {
    if (this.sending || !this.reportUrl || !this.secret) return;
    this.sending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const report = await this.buildReport();
      const response = await fetch(this.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SECRET_HEADER]: this.secret,
        },
        body: JSON.stringify(report),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`CalebsSuperSite returned HTTP ${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`CalebsSuperSite status report failed: ${message}`);
    } finally {
      clearTimeout(timeout);
      this.sending = false;
    }
  }

  private async readClientVersion(
    platform: 'windows' | 'mac',
  ): Promise<string> {
    try {
      return await this.serverService.getLatestClientVersion(platform);
    } catch {
      return 'unknown';
    }
  }

  private validDate(value?: string): value is string {
    return !!value && !Number.isNaN(new Date(value).getTime());
  }
}
