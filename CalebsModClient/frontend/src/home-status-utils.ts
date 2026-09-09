export const SERVER_STATUS_POLL_MS = 20_000;
export const HOMEPAGE_STATUS_POLL_MS = 60_000;
export const UPDATE_CHECK_POLL_MS = 10 * 60_000;

export type ServerDisplayState = 'checking' | 'online' | 'offline' | 'unavailable';

export function serverDisplayState(
	checked: boolean,
	unavailable: boolean,
	online: boolean,
): ServerDisplayState {
	if (!checked) return 'checking';
	if (unavailable) return 'unavailable';
	return online ? 'online' : 'offline';
}

// The server stores an absolute instant. Formatting it here, rather than on
// the server, makes the hover text match the device and timezone of whoever
// has the client open.
export function formatLocalLastSeen(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short',
	}).format(new Date(timestamp));
}
