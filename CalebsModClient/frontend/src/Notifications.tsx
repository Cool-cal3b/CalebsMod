import './App.css';
import { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import { useToast, errorText } from './components/Toast';
import { CheckIcon, SettingsIcon, SyncIcon, UsersIcon } from './components/Icons';
import {
	GetNotificationState,
	GetPingRecipients,
	PingPlayer,
	RegisterNotificationDevice,
	UpdateNotificationSettings,
} from '../wailsjs/go/main/NotificationService';
import { notificationagent } from '../wailsjs/go/models';

function Notifications() {
	const toast = useToast();
	const [state, setState] = useState<notificationagent.State | null>(null);
	const [username, setUsername] = useState('');
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState('');

	const refresh = useCallback(async () => {
		try {
			const next = await GetNotificationState();
			setState(next);
			if (next.registrationStatus === 'approved' && next.backendConnected) {
				next.recipients = await GetPingRecipients();
				setState(next);
			}
		} catch (err) {
			console.error('Could not read notification agent state:', err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
		const timer = setInterval(refresh, 3000);
		return () => clearInterval(timer);
	}, [refresh]);

	const register = async () => {
		if (!/^[A-Za-z0-9_]{3,16}$/.test(username.trim())) {
			toast.error('Invalid Minecraft name', 'Use 3–16 letters, numbers, or underscores.');
			return;
		}
		setBusy('register');
		try {
			setState(await RegisterNotificationDevice(username.trim()));
			toast.success('Device submitted', 'An admin needs to approve it before pings are enabled.');
		} catch (err) {
			toast.error('Registration failed', errorText(err));
		} finally {
			setBusy('');
		}
	};

	const updateSetting = async (key: 'startWithWindows' | 'directPings', value: boolean) => {
		if (!state) return;
		setBusy(key);
		try {
			const settings = new notificationagent.Settings({ ...state.settings, [key]: value });
			setState(await UpdateNotificationSettings(settings));
		} catch (err) {
			toast.error('Could not update notifications', errorText(err));
		} finally {
			setBusy('');
		}
	};

	const ping = async (recipient: string) => {
		setBusy(`ping:${recipient}`);
		try {
			const result = await PingPlayer(recipient);
			toast.success(result.deliveredNow ? 'Ping sent' : 'Ping queued', result.deliveredNow
				? `${recipient}'s notification agent received it.`
				: `${recipient} has 30 minutes to reconnect.`);
		} catch (err) {
			toast.error('Could not send ping', errorText(err));
		} finally {
			setBusy('');
		}
	};

	const statusText = !state
		? 'Starting…'
		: state.registrationStatus === 'unregistered'
			? 'Not registered'
			: state.registrationStatus === 'pending'
				? 'Waiting for admin approval'
				: state.registrationStatus === 'revoked'
					? 'Access revoked'
					: state.backendConnected ? 'Connected' : 'Reconnecting…';

	return (
		<div className="page">
			<TopBar backTo="/" title="Pings" />
			<div className="page__body page__body--narrow">
				<div className="page-head">
					<h1>Ping a friend</h1>
					<p className="lede">Send one quiet nudge to play Minecraft. Pings expire after 30 minutes.</p>
				</div>

				<section className="card">
					<div className="card__head"><UsersIcon /><h2>Your device</h2><span className="spacer" /><span className="meta">{statusText}</span></div>
					<div className="card__body">
						{loading ? <p className="meta">Starting the notification agent…</p> : state?.registrationStatus === 'unregistered' || state?.registrationStatus === 'revoked' ? (
							<div className="notification-register">
								<div className="field">
									<label className="field__label" htmlFor="notification-username">Your Minecraft username</label>
									<input id="notification-username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && register()} />
								</div>
								<button className="btn btn--primary" onClick={register} disabled={busy === 'register'}>{busy === 'register' ? <span className="spinner" /> : <CheckIcon />}{state?.registrationStatus === 'revoked' ? 'Register again' : 'Register this PC'}</button>
							</div>
						) : (
							<p><strong>{state?.username}</strong> · {statusText}</p>
						)}
						{state?.lastError && !state.backendConnected && <p className="meta notification-error">Last connection error: {state.lastError}</p>}
					</div>
				</section>

				{state?.registrationStatus === 'approved' && (
					<section className="card">
						<div className="card__head"><UsersIcon /><h2>Friends</h2><span className="spacer" /><button className="btn btn--ghost btn--sm" onClick={refresh}><SyncIcon />Refresh</button></div>
						<div className="card__body">
							{state.recipients.length === 0 ? <p className="meta">No other approved players are registered yet.</p> : (
								<ul className="notification-list">
									{state.recipients.map((recipient) => (
										<li key={recipient.username} className="notification-row">
											<span><strong>{recipient.username}</strong><span className="meta notification-presence">{recipient.connected ? 'Agent online' : 'Will queue for 30 min'}</span></span>
											<button className="btn btn--sm" onClick={() => ping(recipient.username)} disabled={!recipient.acceptsDirectPings || busy === `ping:${recipient.username}` || !state.backendConnected}>
												{busy === `ping:${recipient.username}` ? <span className="spinner" /> : <UsersIcon />}Ping
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>
				)}

				{state && <section className="card">
					<div className="card__head"><SettingsIcon /><h2>Notification settings</h2></div>
					<div className="card__body notification-settings">
						<label><input type="checkbox" checked={state.settings.startWithWindows} disabled={busy === 'startWithWindows'} onChange={(e) => updateSetting('startWithWindows', e.target.checked)} /><span><strong>Start with Windows</strong><span className="meta">Keep the lightweight agent available after signing in.</span></span></label>
						<label><input type="checkbox" checked={state.settings.directPings} disabled={busy === 'directPings'} onChange={(e) => updateSetting('directPings', e.target.checked)} /><span><strong>Ping notifications</strong><span className="meta">Allow approved friends to send native Windows notifications.</span></span></label>
					</div>
				</section>}
			</div>
		</div>
	);
}

export default Notifications;
