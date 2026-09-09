import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { DatabaseService } from '../database/database.service';

export interface RecentPlayer {
  username: string;
  uuid: string | null;
  lastSeen: number;
  joinCount: number;
}

interface PlayerEvent {
  username: string;
  uuid: string | null;
  event: 'join' | 'leave';
  occurredAt: number;
}

// `[08Sep2026 23:34:14.158] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: joshburn15 joined the game`
const EVENT_PATTERN =
  /^\[(\d{2})(\w{3})(\d{4}) (\d{2}):(\d{2}):(\d{2})\.\d{3}\].*\[net\.minecraft\.server\.MinecraftServer\/\]: (\S+) (joined|left) the game$/;

// Emitted a few seconds before the join line, and the only place the log ever
// states a player's UUID.
const UUID_PATTERN = /UUID of player (\S+) is ([0-9a-f-]{36})/;

// Rotated game logs. Deliberately excludes `debug-N.log.gz`, which is the same
// events buried in megabytes of Forge chatter.
const ROTATED_LOG_PATTERN = /^(\d{4})-(\d{2})-(\d{2})-\d+\.log\.gz$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const POLL_INTERVAL_MS = 10000;
const MAX_WINDOW_DAYS = 30;
const DEFAULT_WINDOW_DAYS = 7;
// One day past the largest window we serve, so a backfill always covers it.
const BACKFILL_DAYS = MAX_WINDOW_DAYS + 1;

/**
 * Records who joins the server by tailing Minecraft's own log.
 *
 * The container bind-mounts `/data` to `minecraft-data`, so the log is an
 * ordinary file on this machine — no Docker API and no RCON involved. Every
 * write is `INSERT OR IGNORE` against a UNIQUE(username, event, occurred_at)
 * constraint, which is what lets us re-read a file as often as we like: on
 * startup, after a rotation, or when we simply aren't sure. Nothing has to
 * remember durably how far it got.
 */
@Injectable()
export class PlayerActivityService implements OnModuleInit, OnModuleDestroy {
  private logsDir: string;
  private timer: NodeJS.Timeout | null = null;
  private offset = 0;
  private partialLine = '';

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
  ) {
    const dataPath =
      this.configService.get<string>('MINECRAFT_DATA_PATH') ||
      './minecraft-data';
    this.logsDir = path.join(path.resolve(dataPath), 'logs');
  }

  onModuleInit() {
    try {
      this.backfillRotatedLogs();
    } catch (error) {
      console.error('Player activity backfill failed:', error);
    }

    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getRecentPlayers(days?: number): { windowDays: number; players: RecentPlayer[] } {
    const windowDays = this.clampDays(days);
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    const rows = this.db
      .prepare(
        `
        SELECT
          p.username AS username,
          MAX(p.occurred_at) AS lastSeen,
          COUNT(*) AS joinCount,
          (
            SELECT p2.uuid FROM player_events p2
            WHERE p2.username = p.username AND p2.uuid IS NOT NULL
            ORDER BY p2.occurred_at DESC LIMIT 1
          ) AS uuid
        FROM player_events p
        WHERE p.event = 'join' AND p.occurred_at >= ?
        GROUP BY p.username
        ORDER BY lastSeen DESC
      `,
      )
      .all(since) as RecentPlayer[];

    return { windowDays, players: rows };
  }

  private clampDays(days?: number): number {
    if (!days || !Number.isFinite(days)) return DEFAULT_WINDOW_DAYS;
    return Math.min(Math.max(Math.floor(days), 1), MAX_WINDOW_DAYS);
  }

  /**
   * One tick of the tailer. `latest.log` shrinking means it was rotated — at
   * the UTC day boundary, or on any server restart — so whatever landed in it
   * since the last tick is now in a `.gz` we have to go back for.
   */
  private poll() {
    const latestLog = path.join(this.logsDir, 'latest.log');

    try {
      if (!fs.existsSync(latestLog)) {
        this.resetPosition();
        return;
      }

      const size = fs.statSync(latestLog).size;

      if (size < this.offset) {
        this.resetPosition();
        this.backfillRotatedLogs();
      }

      if (size === this.offset) return;

      const handle = fs.openSync(latestLog, 'r');
      try {
        const length = size - this.offset;
        const buffer = Buffer.alloc(length);
        const read = fs.readSync(handle, buffer, 0, length, this.offset);
        this.offset += read;
        this.ingestChunk(buffer.subarray(0, read).toString('utf8'));
      } finally {
        fs.closeSync(handle);
      }
    } catch (error) {
      console.error('Player activity poll failed:', error);
      this.resetPosition();
    }
  }

  private resetPosition() {
    this.offset = 0;
    this.partialLine = '';
  }

  /**
   * A chunk can end mid-line, so the tail is held over for the next tick.
   */
  private ingestChunk(chunk: string) {
    const text = this.partialLine + chunk;
    const lines = text.split(/\r?\n/);
    this.partialLine = lines.pop() ?? '';
    this.recordEvents(this.parseLines(lines));
  }

  private backfillRotatedLogs() {
    if (!fs.existsSync(this.logsDir)) return;

    const cutoff = Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000;

    const files = fs
      .readdirSync(this.logsDir)
      .map((name) => ({ name, match: ROTATED_LOG_PATTERN.exec(name) }))
      .filter(({ match }) => {
        if (!match) return false;
        // Trust the filename's date rather than mtime: copying the folder
        // rewrites mtimes, the name always says which day the log covers.
        const day = Date.UTC(+match[1], +match[2] - 1, +match[3]);
        return day >= cutoff;
      })
      .map(({ name }) => name)
      .sort();

    for (const name of files) {
      try {
        const raw = zlib.gunzipSync(fs.readFileSync(path.join(this.logsDir, name)));
        this.recordEvents(this.parseLines(raw.toString('utf8').split(/\r?\n/)));
      } catch (error) {
        console.error(`Player activity: could not read ${name}:`, error);
      }
    }
  }

  private parseLines(lines: string[]): PlayerEvent[] {
    const events: PlayerEvent[] = [];
    // The authenticator logs a UUID shortly before the join line it belongs to.
    const uuids = new Map<string, string>();

    for (const line of lines) {
      const uuidMatch = UUID_PATTERN.exec(line);
      if (uuidMatch) {
        uuids.set(uuidMatch[1], uuidMatch[2]);
        continue;
      }

      const match = EVENT_PATTERN.exec(line);
      if (!match) continue;

      const occurredAt = this.parseTimestamp(match);
      if (occurredAt === null) continue;

      const username = match[7];
      events.push({
        username,
        uuid: uuids.get(username) ?? null,
        event: match[8] === 'joined' ? 'join' : 'leave',
        occurredAt,
      });
    }

    return events;
  }

  /**
   * Log stamps are the container's clock, which is UTC. Building the Date from
   * parts keeps it that way; parsing the string would silently apply this
   * machine's offset and shift every timestamp.
   */
  private parseTimestamp(match: RegExpExecArray): number | null {
    const month = MONTHS.indexOf(match[2]);
    if (month === -1) return null;

    return Date.UTC(+match[3], month, +match[1], +match[4], +match[5], +match[6]);
  }

  private recordEvents(events: PlayerEvent[]) {
    if (events.length === 0) return;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO player_events (username, uuid, event, occurred_at)
      VALUES (?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      for (const event of events) {
        insert.run(event.username, event.uuid, event.event, event.occurredAt);
      }
    });
  }
}
