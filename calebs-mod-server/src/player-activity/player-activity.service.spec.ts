import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { PlayerActivityService } from './player-activity.service';

describe('PlayerActivityService status summary', () => {
  it('returns every known player without a time-window cutoff', () => {
    const rows = [
      { username: 'Recent', uuid: 'one', lastSeen: 2000, joinCount: 3 },
      { username: 'OldFriend', uuid: null, lastSeen: 1000, joinCount: 1 },
    ];
    const all = jest.fn().mockReturnValue(rows);
    let capturedQuery = '';
    const prepare = jest.fn((query: string) => {
      capturedQuery = query;
      return { all };
    });
    const config = {
      get: jest.fn().mockReturnValue('./minecraft-data'),
    } as unknown as ConfigService;
    const database = { prepare } as unknown as DatabaseService;
    const service = new PlayerActivityService(config, database);

    expect(service.getAllPlayers()).toEqual(rows);
    expect(all).toHaveBeenCalledWith();
    expect(capturedQuery).toContain("WHERE p.event = 'join'");
    expect(capturedQuery).not.toContain('occurred_at >=');
  });
});
