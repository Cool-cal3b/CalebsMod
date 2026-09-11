import { ConfigService } from '@nestjs/config';
import { PlayerActivityService } from '../player-activity/player-activity.service';
import { ServerService } from '../server/server.service';
import { StatusReportService } from './status-report.service';

describe('StatusReportService', () => {
  const server = {
    getStatus: jest.fn(),
    getLatestClientVersion: jest.fn(),
  };
  const activity = { getAllPlayers: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    server.getStatus.mockResolvedValue({
      dockerStatus: {
        exists: true,
        running: true,
        status: 'running',
        startedAt: '2026-09-10T12:00:00.000Z',
        finishedAt: '0001-01-01T00:00:00.000Z',
      },
      rconConnected: true,
      players: { online: 1, max: 20, players: ['Caleb'] },
    });
    server.getLatestClientVersion.mockImplementation((platform: string) =>
      Promise.resolve(platform === 'windows' ? '1.23' : '1.21'),
    );
    activity.getAllPlayers.mockReturnValue([
      {
        username: 'Caleb',
        uuid: 'abc',
        lastSeen: 1_757_508_000_000,
        joinCount: 4,
      },
    ]);
  });

  function service(
    url = 'https://example.test/api/calebs-mod/status',
    secret = 'status-key',
  ) {
    const config = {
      get: (key: string) => (key.endsWith('_URL') ? url : secret),
    } as ConfigService;
    return new StatusReportService(
      config,
      server as unknown as ServerService,
      activity as unknown as PlayerActivityService,
    );
  }

  it('builds the complete operational report', async () => {
    const report = await service().buildReport();

    expect(report.schemaVersion).toBe(1);
    expect(report.minecraft).toMatchObject({
      running: true,
      rconConnected: true,
      playerDataAvailable: true,
      playersOnline: 1,
      playerNames: ['Caleb'],
    });
    expect(report.players[0]).toMatchObject({
      username: 'Caleb',
      joinCount: 4,
    });
    expect(report.clientVersions).toEqual({ windows: '1.23', mac: '1.21' });
  });

  it('sends the secret in a header and never overlaps reports', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const reporter = service();

    const first = reporter.sendNow();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const second = reporter.sendNow();
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (options.headers as Record<string, string>)['X-CalebsMod-Status-Secret'],
    ).toBe('status-key');

    resolveFetch(new Response('{}', { status: 200 }));
    await first;
    fetchMock.mockRestore();
  });

  it('does nothing when reporting is not configured', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await service('', '').sendNow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('reports immediately and every minute while the module is running', () => {
    jest.useFakeTimers();
    const reporter = service();
    const send = jest.spyOn(reporter, 'sendNow').mockResolvedValue();

    reporter.onModuleInit();
    expect(send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(2);

    reporter.onModuleDestroy();
    jest.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
