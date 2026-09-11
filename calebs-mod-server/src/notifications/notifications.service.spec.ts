import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'calebsmod-notifications-'),
    );
    const config = new ConfigService({ DB_PATH: path.join(dir, 'test.db') });
    const db = new DatabaseService(config);
    db.onModuleInit();
    service = new NotificationsService(db);
  });

  function approved(username: string) {
    const registered = service.register(username, `${username}'s PC`);
    const device = service.authenticate(registered.deviceId, registered.token)!;
    service.approve(device.id);
    return service.getDevice(device.id)!;
  }

  it('issues a secret once and authenticates only its hash', () => {
    const registered = service.register('Caleb', 'Desktop');
    expect(registered.token).toBeTruthy();
    expect(
      service.authenticate(registered.deviceId, registered.token)?.status,
    ).toBe('pending');
    expect(service.authenticate(registered.deviceId, 'wrong')).toBeNull();
  });

  it('queues, acknowledges, and rate-limits direct pings', () => {
    const sender = approved('Caleb');
    approved('Josh');

    expect(service.listRecipients('Caleb')).toEqual([
      { username: 'Josh', acceptsDirectPings: true },
    ]);

    const event = service.createPing(sender, 'josh');
    expect(event.expiresAt - event.createdAt).toBe(30 * 60 * 1000);
    expect(service.pendingFor('Josh')).toHaveLength(1);
    expect(service.acknowledge(event.id, service.getDevice(sender.id)!)).toBe(
      false,
    );

    const recipientDevice = service
      .listDevices()
      .find((d) => d.username === 'Josh')!;
    expect(service.acknowledge(event.id, recipientDevice)).toBe(true);
    expect(service.pendingFor('Josh')).toHaveLength(0);
    expect(() => service.createPing(sender, 'Josh')).toThrow(/wait/i);
  });

  it('rejects self-pings and recipients who opt out', () => {
    const sender = approved('Caleb');
    const recipient = approved('Josh');
    expect(() => service.createPing(sender, 'caleb')).toThrow(/yourself/i);

    service.updateCapabilities(recipient.id, false);
    expect(() => service.createPing(sender, 'Josh')).toThrow(/not accepting/i);
  });
});
