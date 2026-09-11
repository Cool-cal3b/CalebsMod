import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { MojangProfile, MojangSessionService } from './mojang-session.service';

export interface NotificationDevice {
  id: string;
  username: string;
  uuid: string;
  deviceName: string;
  acceptsDirectPings: boolean;
  createdAt: number;
  lastConnectedAt: number | null;
}

export interface RegisterRequest {
  username: string;
  serverId: string;
  deviceName: string;
  /**
   * Credentials this PC already holds. Presenting them moves the existing
   * device to the new account, so switching accounts in Prism does not leave
   * the old name registered to a PC that no longer plays as it.
   */
  deviceId?: string;
  token?: string;
}

export interface NotificationEvent {
  id: string;
  type: 'direct_ping';
  senderUsername: string;
  recipientUsername: string;
  payload: { senderUsername: string };
  createdAt: number;
  expiresAt: number;
}

interface DeviceRow {
  id: string;
  username: string;
  uuid: string;
  device_name: string;
  accepts_direct_pings: number;
  created_at: number;
  last_connected_at: number | null;
  token_hash?: string;
}

interface EventRow {
  id: string;
  type: 'direct_ping';
  sender_username: string;
  recipient_username: string;
  payload: string;
  created_at: number;
  expires_at: number;
}

interface RecipientRow {
  username: string;
  accepts_direct_pings: number;
}

const MINECRAFT_USERNAME = /^[A-Za-z0-9_]{3,16}$/;
// Minecraft's own server ids are signed SHA-1 hex digests; the client sends a
// random value of the same shape.
const SESSION_SERVER_ID = /^-?[0-9a-f]{1,40}$/;
const PING_TTL_MS = 30 * 60 * 1000;
const PING_COOLDOWN_MS = 5 * 60 * 1000;
const DEVICE_COLUMNS =
  'id, username, uuid, device_name, accepts_direct_pings, created_at, last_connected_at';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mojang: MojangSessionService,
  ) {}

  async register(request: RegisterRequest) {
    const username = request.username?.trim();
    if (!MINECRAFT_USERNAME.test(username)) {
      throw new Error(
        'Minecraft usernames must be 3-16 letters, numbers, or underscores',
      );
    }
    const serverId = request.serverId?.trim();
    if (!serverId || !SESSION_SERVER_ID.test(serverId)) {
      throw new Error(
        'Missing Minecraft session proof. Update CalebsMod and try again',
      );
    }

    const profile = await this.mojang.hasJoined(username, serverId);
    if (!profile) {
      throw new Error('Mojang could not confirm this Minecraft account');
    }
    if (!this.hasPlayedHere(profile)) {
      throw new Error(`${profile.name} has not joined the server yet`);
    }

    const deviceName = (request.deviceName?.trim() || 'Windows PC').slice(
      0,
      80,
    );
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const existing = this.authenticate(
      request.deviceId ?? '',
      request.token ?? '',
    );

    let deviceId: string;
    if (existing) {
      deviceId = existing.id;
      this.db
        .prepare(
          `UPDATE notification_devices
           SET username = ?, uuid = ?, token_hash = ?, device_name = ?
           WHERE id = ?`,
        )
        .run(profile.name, profile.id, tokenHash, deviceName, deviceId);
    } else {
      deviceId = randomUUID();
      this.db
        .prepare(
          `INSERT INTO notification_devices
           (id, username, uuid, token_hash, device_name, accepts_direct_pings, created_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
        )
        .run(
          deviceId,
          profile.name,
          profile.id,
          tokenHash,
          deviceName,
          Date.now(),
        );
    }

    return { deviceId, token, username: profile.name, uuid: profile.id };
  }

  authenticate(deviceId: string, token: string): NotificationDevice | null {
    if (!deviceId || !token) return null;
    const row = this.db
      .prepare(
        `SELECT ${DEVICE_COLUMNS}, token_hash FROM notification_devices WHERE id = ?`,
      )
      .get(deviceId) as DeviceRow | undefined;
    if (!row?.token_hash) return null;
    const expected = Buffer.from(row.token_hash, 'hex');
    const actual = Buffer.from(this.hashToken(token), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    return this.mapDevice(row);
  }

  markConnected(deviceId: string) {
    this.db
      .prepare(
        'UPDATE notification_devices SET last_connected_at = ? WHERE id = ?',
      )
      .run(Date.now(), deviceId);
  }

  updateCapabilities(deviceId: string, acceptsDirectPings: boolean) {
    this.db
      .prepare(
        'UPDATE notification_devices SET accepts_direct_pings = ? WHERE id = ?',
      )
      .run(acceptsDirectPings ? 1 : 0, deviceId);
  }

  getDevice(deviceId: string): NotificationDevice | null {
    const row = this.db
      .prepare(
        `SELECT ${DEVICE_COLUMNS} FROM notification_devices WHERE id = ?`,
      )
      .get(deviceId) as DeviceRow | undefined;
    return row ? this.mapDevice(row) : null;
  }

  listRecipients(senderUsername: string) {
    return this.db
      .prepare(
        `SELECT username, MAX(accepts_direct_pings) AS accepts_direct_pings
         FROM notification_devices
         WHERE lower(username) != lower(?)
         GROUP BY lower(username)
         ORDER BY username COLLATE NOCASE`,
      )
      .all(senderUsername)
      .map((row: RecipientRow) => ({
        username: row.username,
        acceptsDirectPings: Boolean(row.accepts_direct_pings),
      }));
  }

  createPing(
    sender: NotificationDevice,
    recipientValue: string,
  ): NotificationEvent {
    const recipientUsername = recipientValue?.trim();
    if (!MINECRAFT_USERNAME.test(recipientUsername))
      throw new Error('Invalid recipient');
    if (recipientUsername.toLowerCase() === sender.username.toLowerCase()) {
      throw new Error('You cannot ping yourself');
    }

    const recipient = this.db
      .prepare(
        `SELECT username FROM notification_devices
         WHERE lower(username) = lower(?) AND accepts_direct_pings = 1 LIMIT 1`,
      )
      .get(recipientUsername) as { username: string } | undefined;
    if (!recipient) throw new Error('That player is not accepting pings');

    const now = Date.now();
    const recent = this.db
      .prepare(
        `SELECT created_at FROM notification_events
         WHERE type = 'direct_ping' AND lower(sender_username) = lower(?)
           AND lower(recipient_username) = lower(?) AND created_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(sender.username, recipient.username, now - PING_COOLDOWN_MS) as
      | { created_at: number }
      | undefined;
    if (recent) {
      const error = new Error(
        'Please wait before pinging this player again',
      ) as Error & {
        retryAfterMs?: number;
      };
      error.retryAfterMs = PING_COOLDOWN_MS - (now - recent.created_at);
      throw error;
    }

    const event: NotificationEvent = {
      id: randomUUID(),
      type: 'direct_ping',
      senderUsername: sender.username,
      recipientUsername: recipient.username,
      payload: { senderUsername: sender.username },
      createdAt: now,
      expiresAt: now + PING_TTL_MS,
    };

    this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM notification_events WHERE expires_at <= ?')
        .run(now);
      this.db
        .prepare(
          `INSERT INTO notification_events
           (id, type, sender_username, recipient_username, payload, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.type,
          event.senderUsername,
          event.recipientUsername,
          JSON.stringify(event.payload),
          event.createdAt,
          event.expiresAt,
        );
    });
    return event;
  }

  pendingFor(username: string): NotificationEvent[] {
    const rows = this.db
      .prepare(
        `SELECT id, type, sender_username, recipient_username, payload,
                created_at, expires_at
         FROM notification_events
         WHERE lower(recipient_username) = lower(?) AND expires_at > ?
           AND acknowledged_at IS NULL
         ORDER BY created_at`,
      )
      .all(username, Date.now()) as EventRow[];
    return rows.map((row) => this.mapEvent(row));
  }

  acknowledge(eventId: string, device: NotificationDevice): boolean {
    const result = this.db
      .prepare(
        `UPDATE notification_events
         SET acknowledged_at = ?, acknowledged_by_device_id = ?
         WHERE id = ? AND lower(recipient_username) = lower(?)
           AND acknowledged_at IS NULL AND expires_at > ?`,
      )
      .run(Date.now(), device.id, eventId, device.username, Date.now());
    return result.changes > 0;
  }

  /**
   * The server runs in online mode, so every join in its log was already
   * authenticated by Mojang. Requiring one keeps pings among people who play
   * here, rather than open to anyone with a Minecraft account.
   */
  private hasPlayedHere(profile: MojangProfile) {
    return !!this.db
      .prepare(
        `SELECT 1 FROM player_events
         WHERE uuid = ? OR lower(username) = lower(?) LIMIT 1`,
      )
      .get(profile.id, profile.name);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private mapDevice(row: DeviceRow): NotificationDevice {
    return {
      id: row.id,
      username: row.username,
      uuid: row.uuid,
      deviceName: row.device_name,
      acceptsDirectPings: Boolean(row.accepts_direct_pings),
      createdAt: row.created_at,
      lastConnectedAt: row.last_connected_at ?? null,
    };
  }

  private mapEvent(row: EventRow): NotificationEvent {
    const parsed = JSON.parse(row.payload) as { senderUsername?: unknown };
    const senderUsername =
      typeof parsed.senderUsername === 'string'
        ? parsed.senderUsername
        : row.sender_username;
    return {
      id: row.id,
      type: row.type,
      senderUsername: row.sender_username,
      recipientUsername: row.recipient_username,
      payload: { senderUsername },
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}
