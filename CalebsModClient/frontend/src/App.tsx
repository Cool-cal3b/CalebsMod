import './App.css';
import logo from './assets/images/CalebsModLogo.png';
import { Link } from 'react-router-dom';
import {
	StartMinecraftClient,
	DeleteLauncher,
	SyncMods,
	ResetClient,
	GetClientStatus,
	GetServerStatus,
	GetClientVersion,
	CheckForClientUpdate,
	ApplyClientUpdate,
} from '../wailsjs/go/main/MinecraftService';
import { go_services } from '../wailsjs/go/models';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from './components/ConfirmModal';
import Progress from './components/Progress';
import { useToast, errorText } from './components/Toast';
import {
	DownloadIcon,
	GlobeIcon,
	PackageIcon,
	PlayIcon,
	RestoreIcon,
	ServerIcon,
	ShieldIcon,
	SyncIcon,
	TrashIcon,
	UpdateIcon,
	UsersIcon,
	BookIcon,
} from './components/Icons';

const SERVER_STATUS_POLL_MS = 20000;
const SERVER_ADDRESS = 'mc.calebwash.com';

type SyncProgress = { phase: string; done: number; total: number };
type UpdateProgress = { phase: string; done: number; total: number };
type Dialog = 'reset' | 'delete-launcher' | 'update' | null;

const UPDATE_PHASE_LABELS: Record<string, string> = {
	downloading: 'Downloading update',
	verifying: 'Checking the download',
	extracting: 'Unpacking update',
	installing: 'Installing',
	done: 'Restarting',
};

function App() {
	const toast = useToast();

	const [isSyncing, setIsSyncing] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [isDeletingLauncher, setIsDeletingLauncher] = useState(false);
	const [dialog, setDialog] = useState<Dialog>(null);
	const [progress, setProgress] = useState<SyncProgress | null>(null);
	const [clientStatus, setClientStatus] = useState<go_services.ClientStatus | null>(null);
	const [serverStatus, setServerStatus] = useState<go_services.ServerStatusResponse | null>(null);
	const [serverChecked, setServerChecked] = useState(false);
	const [version, setVersion] = useState('');
	const [update, setUpdate] = useState<go_services.UpdateStatus | null>(null);
	const [updateChecked, setUpdateChecked] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);

	const refreshClientStatus = useCallback(async () => {
		try {
			setClientStatus(await GetClientStatus());
		} catch (error) {
			console.error('Failed to get client status:', error);
		}
	}, []);

	const refreshServerStatus = useCallback(async () => {
		try {
			setServerStatus(await GetServerStatus());
		} catch (error) {
			console.error('Failed to get server status:', error);
			setServerStatus(null);
		} finally {
			setServerChecked(true);
		}
	}, []);

	useEffect(() => {
		EventsOn('sync:progress', (p: SyncProgress) => setProgress(p));
		EventsOn('update:progress', (p: UpdateProgress) => setUpdateProgress(p));
		return () => {
			EventsOff('sync:progress');
			EventsOff('update:progress');
		};
	}, []);

	useEffect(() => {
		refreshClientStatus();
		refreshServerStatus();
		GetClientVersion().then(setVersion).catch(() => setVersion(''));

		// Checked once at startup rather than on a timer: this is a launcher
		// people open, use and close, and each check costs the server a
		// presigned S3 URL.
		CheckForClientUpdate()
			.then(setUpdate)
			.catch(() => setUpdate(null))
			.finally(() => setUpdateChecked(true));

		const timer = setInterval(refreshServerStatus, SERVER_STATUS_POLL_MS);
		return () => clearInterval(timer);
	}, [refreshClientStatus, refreshServerStatus]);

	const syncMods = async () => {
		if (isSyncing) return;
		setIsSyncing(true);
		try {
			if (await SyncMods()) {
				toast.success('Modpack synced', 'The server has been added to your Minecraft server list.');
			} else {
				toast.error('Sync failed', 'Check that PrismLauncher is installed and closed, then try again.');
			}
		} catch (error) {
			console.error('Failed to sync mods:', error);
			toast.error('Sync failed', errorText(error));
		} finally {
			setIsSyncing(false);
			setProgress(null);
			refreshClientStatus();
		}
	};

	const applyUpdate = async () => {
		setDialog(null);
		setIsUpdating(true);
		try {
			await ApplyClientUpdate();
			// The window closes on its own once the new client is on screen,
			// so this toast is the last thing shown rather than a lasting state.
			toast.success('Update installed', 'Restarting into the new version…');
		} catch (error) {
			console.error('Failed to update client:', error);
			toast.error('Update failed', errorText(error));
			setIsUpdating(false);
			setUpdateProgress(null);
		}
	};

	const resetClient = async () => {
		setDialog(null);
		setIsResetting(true);
		try {
			if (await ResetClient()) {
				toast.success('Client reset', 'Everything was re-downloaded from scratch.');
			} else {
				toast.error('Reset failed', 'Make sure PrismLauncher and Minecraft are both closed.');
			}
		} catch (error) {
			console.error('Failed to reset client:', error);
			toast.error('Reset failed', errorText(error));
		} finally {
			setIsResetting(false);
			setProgress(null);
			refreshClientStatus();
		}
	};

	const connectToServer = async () => {
		try {
			await StartMinecraftClient();
			toast.info('Launching Minecraft', 'PrismLauncher is starting up — this can take a moment.');
		} catch (error) {
			console.error('Failed to launch Minecraft:', error);
			toast.error('Could not launch Minecraft', errorText(error));
		}
	};

	const deleteLauncher = async () => {
		setDialog(null);
		setIsDeletingLauncher(true);
		try {
			if (await DeleteLauncher()) {
				toast.success('PrismLauncher removed');
			} else {
				toast.error('Could not remove PrismLauncher', 'Close Minecraft and PrismLauncher, then try again.');
			}
		} catch (error) {
			console.error('Failed to delete PrismLauncher:', error);
			toast.error('Could not remove PrismLauncher', errorText(error));
		} finally {
			setIsDeletingLauncher(false);
			refreshClientStatus();
		}
	};

	/* ---------------------------------------------------------------- state */

	const busy = isSyncing || isResetting || isUpdating;
	const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : null;
	const progressLabel = progress
		? progress.phase === 'verifying'
			? 'Checking existing files'
			: `Downloading files — ${progress.done} of ${progress.total}`
		: isResetting
			? 'Resetting client'
			: 'Preparing';

	const updateAvailable = !!update?.updateAvailable;

	// The footer says where the client stands even when there is nothing to do,
	// so "no banner" reads as "checked, you are current" rather than as "never
	// looked". A dev build has no version to compare and stays silent.
	const clientState = (() => {
		if (isUpdating) return { text: 'Updating…', tone: 't-warn', dot: 'dot--warn', title: '' };
		if (!updateChecked) return { text: 'Checking…', tone: 't-off', dot: '', title: '' };
		if (!update || !update.supported) return null;
		if (update.error)
			return {
				text: 'Update check failed',
				tone: 't-off',
				dot: 'dot--off',
				title: update.error,
			};
		if (update.updateAvailable)
			return {
				text: `v${update.latestVersion} available`,
				tone: 't-warn',
				dot: 'dot--warn',
				title: `You are on v${update.currentVersion}`,
			};
		return { text: 'Up to date', tone: 't-ok', dot: 'dot--ok', title: 'You have the latest client' };
	})();
	const updatePercent =
		updateProgress && updateProgress.total > 0
			? (updateProgress.done / updateProgress.total) * 100
			: null;
	const updateLabel = updateProgress
		? UPDATE_PHASE_LABELS[updateProgress.phase] ?? 'Updating'
		: 'Preparing update';

	const launcherInstalled = !!clientStatus?.launcherInstalled;
	const serverOnline = !!serverStatus?.dockerStatus?.running;
	const players = serverStatus?.players;

	// SyncMods needs the Prism instance to already exist (it is created through
	// Prism's import UI on first launch), so only offer it once it does.
	const canSync = launcherInstalled && !!clientStatus?.instanceExists && !!clientStatus?.needsSync;

	const syncLabel = (() => {
		if (!clientStatus) return 'Sync Modpack';
		if (!clientStatus.serverInConfig && clientStatus.filesMissing > 0) return 'Add Server & Sync Modpack';
		if (!clientStatus.serverInConfig) return 'Add Server to Minecraft';
		return 'Sync Modpack';
	})();

	// One primary action per screen: whatever the player needs to do next.
	const primary: 'install' | 'sync' | 'launch' = !clientStatus
		? 'launch'
		: !launcherInstalled
			? 'install'
			: canSync
				? 'sync'
				: 'launch';

	const hint = (() => {
		if (!clientStatus) return null;
		if (!launcherInstalled) return 'PrismLauncher is not installed yet.';
		if (!clientStatus.instanceExists) return 'Open PrismLauncher once to finish importing the modpack.';
		if (canSync && clientStatus.filesMissing > 0)
			return `${clientStatus.filesMissing} file${clientStatus.filesMissing === 1 ? '' : 's'} out of date — sync before you join.`;
		if (canSync) return 'The server still needs to be added to your Minecraft server list.';
		if (!serverOnline && serverChecked) return 'The server is offline right now, but you can still play locally.';
		return null;
	})();

	const mods = (() => {
		if (!clientStatus) return { value: '—', tone: '', hint: 'Checking…', dot: '' };
		if (clientStatus.manifestError)
			return { value: 'Unknown', tone: 't-warn', hint: 'Could not reach the server', dot: 'dot--warn' };
		if (!clientStatus.instanceExists)
			return { value: 'Not installed', tone: 't-off', hint: 'Not imported yet', dot: 'dot--off' };
		if (clientStatus.filesMissing > 0)
			return {
				value: `${clientStatus.filesMissing} missing`,
				tone: 't-warn',
				hint: clientStatus.missingExamples?.slice(0, 2).join(', ') || 'Sync to download them',
				dot: 'dot--warn',
			};
		return {
			value: 'Up to date',
			tone: 't-ok',
			hint: `${clientStatus.filesExpected} files · ${clientStatus.modsExpected} mods`,
			dot: 'dot--ok',
		};
	})();

	/* -------------------------------------------------------------- render */

	return (
		<div className="home">
			<main className="home__main">
				<div className="hero">
					<img src={logo} alt="CalebsMod" className="hero__logo" />
					<p className="hero__tag">Private modpack for friends</p>
				</div>

				{(updateAvailable || isUpdating) && (
					<section className="update-banner" aria-label="Client update">
						{isUpdating ? (
							<Progress label={updateLabel} percent={updatePercent} />
						) : (
							<>
								<UpdateIcon className="update-banner__icon" />
								<div className="update-banner__text">
									<strong>Version {update?.latestVersion} is available</strong>
									<span>You are on v{update?.currentVersion}. Updating takes a few seconds.</span>
								</div>
								<button
									className="btn btn--primary btn--sm"
									onClick={() => setDialog('update')}
									disabled={busy}
								>
									Update
								</button>
							</>
						)}
					</section>
				)}

				<section className="tiles" aria-label="Status">
					<div className="tile">
						<div className="tile__label"><ServerIcon /> Server</div>
						<div className={`tile__value ${serverChecked ? (serverOnline ? 't-ok' : 't-off') : ''}`}>
							<span className={`dot ${!serverChecked ? '' : serverOnline ? 'dot--ok dot--live' : 'dot--off'}`} />
							{!serverChecked ? 'Checking…' : serverOnline ? 'Online' : 'Offline'}
						</div>
						<div className="tile__hint">
							{!serverChecked ? ' ' : serverOnline ? 'Ready to join' : 'Nobody has started it'}
						</div>
					</div>

					<div className="tile">
						<div className="tile__label"><UsersIcon /> Players</div>
						<div className="tile__value">
							{serverOnline && players ? `${players.online}${players.max ? ` / ${players.max}` : ''}` : '—'}
						</div>
						<div className="tile__hint" title={players?.players?.join(', ')}>
							{serverOnline && players?.players?.length
								? players.players.join(', ')
								: serverOnline
									? 'Nobody online yet'
									: ' '}
						</div>
					</div>

					<div className="tile">
						<div className="tile__label"><PackageIcon /> Modpack</div>
						<div className={`tile__value ${mods.tone}`}>
							{mods.dot && <span className={`dot ${mods.dot}`} />}
							{mods.value}
						</div>
						<div className="tile__hint" title={clientStatus?.manifestError || mods.hint}>{mods.hint}</div>
					</div>
				</section>

				<section className="card launch-panel">
					{busy && <Progress label={progressLabel} percent={percent} />}

					{primary === 'install' ? (
						<Link className="btn btn--primary btn--lg btn--block" to="/install-launcher">
							<DownloadIcon />
							Install PrismLauncher
						</Link>
					) : primary === 'sync' ? (
						<button className="btn btn--primary btn--lg btn--block" onClick={syncMods} disabled={busy}>
							{isSyncing ? <span className="spinner" /> : <SyncIcon />}
							{isSyncing ? 'Syncing…' : syncLabel}
						</button>
					) : (
						<button
							className="btn btn--primary btn--lg btn--block"
							onClick={connectToServer}
							disabled={!launcherInstalled || busy}
						>
							<PlayIcon />
							Launch Minecraft
						</button>
					)}

					{primary === 'sync' && (
						<button className="btn btn--lg btn--block" onClick={connectToServer} disabled={busy}>
							<PlayIcon />
							Launch Anyway
						</button>
					)}

					{primary === 'install' && (
						<button className="btn btn--lg btn--block" disabled>
							<PlayIcon />
							Launch Minecraft
						</button>
					)}

					{hint && <p className="launch-panel__hint">{hint}</p>}

					<div className="launch-panel__maintenance">
						{launcherInstalled && !canSync && clientStatus?.instanceExists && (
							<button className="btn btn--ghost btn--sm" onClick={syncMods} disabled={busy}>
								{isSyncing ? <span className="spinner" /> : <SyncIcon />}
								Re-sync
							</button>
						)}
						{launcherInstalled && (
							<button
								className="btn btn--ghost btn--sm"
								onClick={() => setDialog('reset')}
								disabled={busy}
							>
								{isResetting ? <span className="spinner" /> : <RestoreIcon />}
								Reset client
							</button>
						)}
						{launcherInstalled ? (
							<button
								className="btn btn--ghost-danger btn--sm"
								onClick={() => setDialog('delete-launcher')}
								disabled={busy || isDeletingLauncher}
							>
								{isDeletingLauncher ? <span className="spinner" /> : <TrashIcon />}
								Remove launcher
							</button>
						) : (
							<Link className="btn btn--ghost btn--sm" to="/install-launcher">
								<DownloadIcon />
								Setup guide
							</Link>
						)}
					</div>
				</section>
			</main>

			<footer className="home__footer">
				<span className="home__address">
					<GlobeIcon />
					<code>{SERVER_ADDRESS}</code>
				</span>
				<span className="spacer" />
				{version && <span className="home__version">v{version}</span>}
				{clientState && (
					<span className={`home__client-state ${clientState.tone}`} title={clientState.title}>
						{clientState.dot && <span className={`dot ${clientState.dot}`} />}
						{clientState.text}
					</span>
				)}
				<Link className="btn btn--ghost btn--sm" to="/wiki">
					<BookIcon />
					Wiki
				</Link>
				<Link className="btn btn--ghost btn--sm" to="/admin">
					<ShieldIcon />
					Admin
				</Link>
			</footer>

			<ConfirmModal
				isOpen={dialog === 'reset'}
				title="Reset client?"
				message="This deletes your CalebsMod instance and all local modpack data, then re-downloads everything from scratch. Your Microsoft login is kept. Close Minecraft first."
				confirmLabel="Reset client"
				onConfirm={resetClient}
				onCancel={() => setDialog(null)}
			/>

			<ConfirmModal
				isOpen={dialog === 'update'}
				tone="neutral"
				title={`Update to v${update?.latestVersion}?`}
				message="The launcher downloads the new version, replaces itself and reopens. Your modpack, saves and Microsoft login are untouched. Minecraft can stay open."
				confirmLabel="Update & restart"
				onConfirm={applyUpdate}
				onCancel={() => setDialog(null)}
			/>

			<ConfirmModal
				isOpen={dialog === 'delete-launcher'}
				title="Remove PrismLauncher?"
				message="This deletes the PrismLauncher install, including the CalebsMod instance and your saved Microsoft login. You will need to run the setup again to play."
				confirmLabel="Remove launcher"
				onConfirm={deleteLauncher}
				onCancel={() => setDialog(null)}
			/>
		</div>
	);
}

export default App;
