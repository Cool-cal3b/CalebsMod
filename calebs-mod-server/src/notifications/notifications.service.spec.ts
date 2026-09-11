import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { MojangSessionService } from './mojang-session.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let db: DatabaseService;
  let service: NotificationsService;
  // `${lowercase name}:${serverId}` pairs Mojang would confirm a join for.
  let joinedSessions: Set<string>;

  beforeEach(() => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'calebsmod-notifications-'),
    );
    const config = new ConfigService({ DB_PATH: path.join(dir, 'test.db') });
    db = new DatabaseService(config);
    db.onModuleInit();
    joinedSessions = new Set();
    const mojang = {
      hasJoined: (username: string, serverId: string) =>
        Promise.resolve(
          joinedSessions.has(`${username.toLowerCase()}:${serverId}`)
            ? { id: uuidFor(username), name: username }
            : null,
        ),
    };
    service = new NotificationsService(
      db,
      mojang as unknown as MojangSessionService,
    );
  });

  function uuidFor(username: string) {
    const hex = Buffer.from(username.toLowerCase())
      .toString('hex')
      .padEnd(12, '0')
      .slice(0, 12);
    return `00000000-0000-0000-0000-${hex}`;
  }

  function joinServer(username: string) {
    db.prepare(
      `INSERT OR IGNORE INTO player_events (username, uuid, event, occurred_at)
       VALUES (?, ?, 'join', ?)`,
    ).run(username, uuidFor(username), Date.now());
  }

  function register(
    username: string,
    existing?: { deviceId: string; token: string },
  ) {
    const serverId = randomBytes(20).toString('hex');
    joinedSessions.add(`${username.toLowerCase()}:${serverId}`);
    return service.register({
      username,
      serverId,
      deviceName: `${username}'s PC`,
      deviceId: existing?.deviceId,
      token: existing?.token,
    });
  }

  async function device(username: string) {
    joinServer(username);
    const { deviceId, token } = await register(username);
    return service.authenticate(deviceId, token)!;
  }

  it('registers only accounts Mojang vouches for that have played here', async () => {
    await expect(
      service.register({
        username: 'Caleb',
        serverId: 'ab'.repeat(20),
        deviceName: 'Desktop',
      }),
    ).rejects.toThrow(/Mojang/);
    await expect(register('Caleb')).rejects.toThrow(/not joined/);

    joinServer('Caleb');
    const registered = await register('Caleb');
    expect(
      service.authenticate(registered.deviceId, registered.token)?.uuid,
    ).toBe(uuidFor('Caleb'));
    expect(service.authenticate(registered.deviceId, 'wrong')).toBeNull();
  });

  it('moves a PC to the new account when it switches players', async () => {
    joinServer('Caleb');
    joinServer('Josh');
    const first = await register('Caleb');
    const second = await register('Josh', first);

    expect(second.deviceId).toBe(first.deviceId);
    expect(service.authenticate(first.deviceId, first.token)).toBeNull();
    expect(service.authenticate(second.deviceId, second.token)?.username).toBe(
      'Josh',
    );
  });

  it('queues, acknowledges, and rate-limits direct pings', async () => {
    const sender = await device('Caleb');
    const recipient = await device('Josh');

    expect(service.listRecipients('Caleb')).toEqual([
      { username: 'Josh', acceptsDirectPings: true },
    ]);

    const event = service.createPing(sender, 'josh');
    expect(event.expiresAt - event.createdAt).toBe(30 * 60 * 1000);
    expect(service.pendingFor('Josh')).toHaveLength(1);
    expect(service.acknowledge(event.id, sender)).toBe(false);
    expect(service.acknowledge(event.id, recipient)).toBe(true);
    expect(service.pendingFor('Josh')).toHaveLength(0);
    expect(() => service.createPing(sender, 'Josh')).toThrow(/wait/i);
  });

  it('rejects self-pings and recipients who opt out', async () => {
    const sender = await device('Caleb');
    const recipient = await device('Josh');
    expect(() => service.createPing(sender, 'caleb')).toThrow(/yourself/i);

    service.updateCapabilities(recipient.id, false);
    expect(() => service.createPing(sender, 'Josh')).toThrow(/not accepting/i);
  });
});
