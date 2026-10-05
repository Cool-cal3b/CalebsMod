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
    worldName: string;
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
  health: {
    statusCollectionMs: number;
    previousReportRoundTripMs?: number;
    minecraftPerformance?: {
      ticksPerSecond: number;
      meanTickTimeMs: number;
    };
    resourceUsage?: {
      cpuPercent: number;
      memoryUsedBytes: number;
      memoryLimitBytes: number;
      memoryPercent: number;
      networkRxBytes: number;
      networkTxBytes: number;
      networkRxBytesPerSecond?: number;
      networkTxBytesPerSecond?: number;
    };
  };
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
  private previousReportRoundTripMs: number | undefined;
  private previousNetworkSample:
    | { measuredAtMs: number; receivedBytes: number; sentBytes: number }
    | undefined;

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
    const collectionStartedAt = performance.now();
    const [status, resourceStats] = await Promise.all([
      this.serverService.getStatus(),
      this.serverService.getResourceStats(),
    ]);
    const minecraftPerformance =
      status.dockerStatus.running && status.rconConnected
        ? await this.serverService.getTickHealth()
        : undefined;
    const statusCollectionMs = performance.now() - collectionStartedAt;
    const docker = status.dockerStatus;
    const players = this.playerActivityService.getAllPlayers();
    const measuredAtMs = Date.now();
    let networkRates:
      | { receivedBytesPerSecond: number; sentBytesPerSecond: number }
      | undefined;

    if (resourceStats && this.previousNetworkSample) {
      const elapsedSeconds =
        (measuredAtMs - this.previousNetworkSample.measuredAtMs) / 1000;
      const receivedDelta =
        resourceStats.network_rx - this.previousNetworkSample.receivedBytes;
      const sentDelta =
        resourceStats.network_tx - this.previousNetworkSample.sentBytes;
      if (elapsedSeconds > 0 && receivedDelta >= 0 && sentDelta >= 0) {
        networkRates = {
          receivedBytesPerSecond: receivedDelta / elapsedSeconds,
          sentBytesPerSecond: sentDelta / elapsedSeconds,
        };
      }
    }
    this.previousNetworkSample = resourceStats
      ? {
          measuredAtMs,
          receivedBytes: resourceStats.network_rx,
          sentBytes: resourceStats.network_tx,
        }
      : undefined;

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
        worldName: status.world?.name ?? 'Original World',
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
      health: {
        statusCollectionMs,
        ...(this.previousReportRoundTripMs !== undefined
          ? { previousReportRoundTripMs: this.previousReportRoundTripMs }
          : {}),
        ...(minecraftPerformance ? { minecraftPerformance } : {}),
        ...(resourceStats
          ? {
              resourceUsage: {
                cpuPercent: resourceStats.cpu_percent,
                memoryUsedBytes: resourceStats.memory_usage,
                memoryLimitBytes: resourceStats.memory_limit,
                memoryPercent:
                  resourceStats.memory_limit > 0
                    ? (resourceStats.memory_usage /
                        resourceStats.memory_limit) *
                      100
                    : 0,
                networkRxBytes: resourceStats.network_rx,
                networkTxBytes: resourceStats.network_tx,
                ...(networkRates
                  ? {
                      networkRxBytesPerSecond:
                        networkRates.receivedBytesPerSecond,
                      networkTxBytesPerSecond: networkRates.sentBytesPerSecond,
                    }
                  : {}),
              },
            }
          : {}),
      },
    };
  }

  async sendNow(): Promise<void> {
    if (this.sending || !this.reportUrl || !this.secret) return;
    this.sending = true;
    let timeout: NodeJS.Timeout | undefined;

    try {
      const report = await this.buildReport();
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const requestStartedAt = performance.now();
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
      this.previousReportRoundTripMs = performance.now() - requestStartedAt;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`CalebsSuperSite status report failed: ${message}`);
    } finally {
      if (timeout) clearTimeout(timeout);
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
