import { describe, expect, it } from 'vitest';
import {
	formatLocalLastSeen,
	HOMEPAGE_STATUS_POLL_MS,
	serverDisplayState,
	SERVER_STATUS_POLL_MS,
	UPDATE_CHECK_POLL_MS,
} from './home-status-utils';

describe('homepage refresh policy', () => {
	it('uses the agreed polling intervals', () => {
		expect(SERVER_STATUS_POLL_MS).toBe(20_000);
		expect(HOMEPAGE_STATUS_POLL_MS).toBe(60_000);
		expect(UPDATE_CHECK_POLL_MS).toBe(600_000);
	});
});

describe('server display state', () => {
	it('keeps an unreachable API distinct from a stopped Minecraft server', () => {
		expect(serverDisplayState(false, false, false)).toBe('checking');
		expect(serverDisplayState(true, false, true)).toBe('online');
		expect(serverDisplayState(true, false, false)).toBe('offline');
		expect(serverDisplayState(true, true, false)).toBe('unavailable');
	});
});

describe('local last-seen formatting', () => {
	it('includes the date, time, and local timezone', () => {
		const timestamp = Date.UTC(2026, 8, 9, 21, 42, 17);
		const formatted = formatLocalLastSeen(timestamp);
		expect(formatted).toContain('2026');
		expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
	});
});
