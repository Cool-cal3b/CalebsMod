import './App.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	AdminKeyIsSet,
	IsLoggedIn,
	Login,
	SetAdminKey,
	ClearAdminKey,
	StartServer,
	StopServer,
	RestartServer,
	UpdateDns,
	GetServerStatus,
	GetServerSettings,
	UpdateServerSettings,
	SelectAndUploadModpackZip,
	DeleteAllFiles,
} from '../wailsjs/go/main/Admin';
import {
	ServerStatus,
	MinecraftServerResponse,
	ServerStatusResponse,
	ServerSetting,
	ServerSettingsResponse,
} from './types/admin-types';
import ConfirmModal from './components/ConfirmModal';
import TopBar from './components/TopBar';
import { useToast, errorText } from './components/Toast';
import {
	AlertIcon,
	CheckIcon,
	GlobeIcon,
	InfoIcon,
	KeyIcon,
	ListIcon,
	PackageIcon,
	PowerIcon,
	ServerIcon,
	SettingsIcon,
	ShieldIcon,
	StopIcon,
	SyncIcon,
	TrashIcon,
	UploadIcon,
	UsersIcon,
} from './components/Icons';

const STATUS_POLL_MS = 2000;

type Dialog = 'clear-key' | 'delete-all' | null;

function Admin() {
	const navigate = useNavigate();
	const toast = useToast();

	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [adminKeyIsSet, setAdminKeyIsSet] = useState(false);
	const [adminKeyInput, setAdminKeyInput] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [dialog, setDialog] = useState<Dialog>(null);

	const [serverIsRunning, setServerIsRunning] = useState<boolean | null>(null);
	const [serverState, setServerState] = useState<string | null>(null);
	const [numberOfPlayers, setNumberOfPlayers] = useState<number | null>(null);
	const [maxPlayers, setMaxPlayers] = useState<number | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isRestarting, setIsRestarting] = useState(false);

	const [settings, setSettings] = useState<ServerSetting[] | null>(null);
	const [settingsFileExists, setSettingsFileExists] = useState(true);
	const [settingsEdits, setSettingsEdits] = useState<Record<string, string>>({});
	const [settingsLoading, setSettingsLoading] = useState(false);
	const [settingsSaving, setSettingsSaving] = useState(false);
	const [restartRequiredKeys, setRestartRequiredKeys] = useState<string[]>([]);

	useEffect(() => {
		checkAuthStatus();
	}, []);

	useEffect(() => {
		if (!isLoggedIn) return;

		let timeoutId: ReturnType<typeof setTimeout>;
		let cancelled = false;

		const poll = async () => {
			try {
				const response: ServerStatusResponse = await GetServerStatus();
				if (cancelled) return;
				setServerIsRunning(response.dockerStatus.running);
				setServerState(response.dockerStatus.status);
				setNumberOfPlayers(response.players.online);
				setMaxPlayers(response.players.max);
			} catch (err) {
				console.error('Failed to fetch server status:', err);
			}
			if (!cancelled) timeoutId = setTimeout(poll, STATUS_POLL_MS);
		};

		poll();

		return () => {
			cancelled = true;
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [isLoggedIn]);

	useEffect(() => {
		if (!isLoggedIn) return;
		loadSettings();
	}, [isLoggedIn]);

	const loadSettings = async () => {
		setSettingsLoading(true);
		try {
			const response: ServerSettingsResponse = await GetServerSettings();
			setSettings(response.settings);
			setSettingsFileExists(response.fileExists);
			setSettingsEdits({});
		} catch (err) {
			toast.error('Could not load server settings', errorText(err));
			console.error(err);
		} finally {
			setSettingsLoading(false);
		}
	};

	const checkAuthStatus = async () => {
		try {
			const keySet = await AdminKeyIsSet();
			setAdminKeyIsSet(keySet);
			if (keySet) setIsLoggedIn(await IsLoggedIn());
		} catch (err) {
			setError('Could not check the saved credentials.');
			console.error(err);
		}
	};

	const handleLogin = async () => {
		setLoading(true);
		setError('');
		try {
			await Login();
			setIsLoggedIn(true);
		} catch (err) {
			const message = errorText(err);
			if (message.includes('invalid admin secret')) {
				setError('That secret was rejected. It has been cleared — enter it again.');
				setAdminKeyIsSet(false);
				setAdminKeyInput('');
			} else {
				setError(`Login failed. ${message}`);
			}
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleSetAdminKey = async () => {
		if (!adminKeyInput.trim()) {
			setError('Enter your admin secret first.');
			return;
		}
		setLoading(true);
		setError('');
		try {
			await SetAdminKey(adminKeyInput);
			setAdminKeyIsSet(true);
			setAdminKeyInput('');
		} catch (err) {
			setError(`Could not save the secret. ${errorText(err)}`);
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleClearAdminKey = async () => {
		setDialog(null);
		setLoading(true);
		setError('');
		try {
			await ClearAdminKey();
			setAdminKeyIsSet(false);
			setIsLoggedIn(false);
			setAdminKeyInput('');
			toast.info('Admin secret cleared');
		} catch (err) {
			setError(`Could not clear the secret. ${errorText(err)}`);
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleStartServer = async () => {
		try {
			const response: MinecraftServerResponse = await StartServer();
			if (response.status === ServerStatus.STARTED) {
				toast.success('Server starting', 'Give it a minute before you join.');
			} else if (response.status === ServerStatus.ALREADY_RUNNING) {
				toast.info('Server is already running');
			} else {
				toast.error('Could not start the server', response.message);
			}
		} catch (err) {
			toast.error('Could not start the server', errorText(err));
			console.error(err);
		}
	};

	const handleStopServer = async () => {
		try {
			const response: MinecraftServerResponse = await StopServer();
			if (response.status === ServerStatus.STOPPED) {
				toast.success('Server stopped');
			} else if (response.status === ServerStatus.ALREADY_STOPPED) {
				toast.info('Server is already stopped');
			} else {
				toast.error('Could not stop the server', response.message);
			}
		} catch (err) {
			toast.error('Could not stop the server', errorText(err));
			console.error(err);
		}
	};

	const handleRestartServer = async () => {
		setIsRestarting(true);
		try {
			const response: MinecraftServerResponse = await RestartServer();
			if (response.status === ServerStatus.ERROR) {
				toast.error('Could not restart the server', response.message);
			} else {
				toast.success('Server restarting', 'Give it a minute before you join.');
				setRestartRequiredKeys([]);
			}
		} catch (err) {
			toast.error('Could not restart the server', errorText(err));
			console.error(err);
		} finally {
			setIsRestarting(false);
		}
	};

	const handleSettingChange = (key: string, value: string) => {
		setSettingsEdits((prev) => ({ ...prev, [key]: value }));
	};

	const handleDiscardSettingsEdits = () => setSettingsEdits({});

	const handleSaveSettings = async () => {
		if (Object.keys(settingsEdits).length === 0) return;
		setSettingsSaving(true);
		try {
			const response: ServerSettingsResponse = await UpdateServerSettings(settingsEdits);
			setSettings(response.settings);
			setSettingsFileExists(response.fileExists);
			setSettingsEdits({});
			setRestartRequiredKeys(response.restartRequired ?? []);
			if (response.restartRequired && response.restartRequired.length > 0) {
				toast.info('Settings saved', 'Restart the server for some of these to take effect.');
			} else {
				toast.success('Settings saved');
			}
		} catch (err) {
			toast.error('Could not save settings', errorText(err));
			console.error(err);
		} finally {
			setSettingsSaving(false);
		}
	};

	const handleUpdateDns = async () => {
		try {
			await UpdateDns();
			toast.success('DNS updated', 'mc.calebwash.com now points at this host.');
		} catch (err) {
			toast.error('Could not update DNS', errorText(err));
			console.error(err);
		}
	};

	const handleUploadModpackZip = async () => {
		setIsUploading(true);
		try {
			const response = await SelectAndUploadModpackZip();
			if (response) {
				toast.success('Modpack uploaded', `${response.filesProcessed} files processed.`);
			} else {
				toast.info('No file selected');
			}
		} catch (err) {
			toast.error('Upload failed', errorText(err));
			console.error(err);
		} finally {
			setIsUploading(false);
		}
	};

	const handleDeleteAllFiles = async () => {
		setDialog(null);
		setLoading(true);
		try {
			await DeleteAllFiles();
			toast.success('All files deleted', 'A revision was created — clients will clear on next sync.');
		} catch (err) {
			toast.error('Could not delete the files', errorText(err));
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	/* ------------------------------------------------------- first-run setup */

	if (!adminKeyIsSet) {
		return (
			<div className="page">
				<TopBar backTo="/" title="Admin" />
				<div className="page__body page__body--narrow">
					<div className="card auth-card">
						<div className="auth-card__head">
							<h1>Admin access</h1>
							<p className="meta">Enter the admin secret to manage the server.</p>
						</div>
						<div className="field">
							<label className="field__label" htmlFor="admin-secret">Admin secret</label>
							<input
								id="admin-secret"
								type="password"
								className="input"
								placeholder="••••••••••••"
								autoFocus
								value={adminKeyInput}
								onChange={(e) => setAdminKeyInput(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSetAdminKey()}
							/>
						</div>
						{error && <div className="notice notice--danger"><ShieldIcon className="" />{error}</div>}
						<button className="btn btn--primary btn--block" onClick={handleSetAdminKey} disabled={loading}>
							{loading ? <span className="spinner" /> : <KeyIcon />}
							{loading ? 'Saving…' : 'Save secret'}
						</button>
					</div>
				</div>
			</div>
		);
	}

	/* ------------------------------------------------------------------ login */

	if (!isLoggedIn) {
		return (
			<div className="page">
				<TopBar backTo="/" title="Admin" />
				<div className="page__body page__body--narrow">
					<div className="card auth-card">
						<div className="auth-card__head">
							<h1>Sign in</h1>
							<p className="meta">Your secret is saved. Authenticate with the server to continue.</p>
						</div>
						{error && <div className="notice notice--danger"><ShieldIcon className="" />{error}</div>}
						<button className="btn btn--primary btn--block" onClick={handleLogin} disabled={loading}>
							{loading ? <span className="spinner" /> : <ShieldIcon />}
							{loading ? 'Signing in…' : 'Sign in to server'}
						</button>
						<button className="btn btn--ghost btn--block" onClick={() => setDialog('clear-key')} disabled={loading}>
							Use a different secret
						</button>
					</div>
				</div>

				<ConfirmModal
					isOpen={dialog === 'clear-key'}
					title="Clear the saved secret?"
					message="You will need to enter the admin secret again the next time you open this panel."
					confirmLabel="Clear secret"
					tone="neutral"
					onConfirm={handleClearAdminKey}
					onCancel={() => setDialog(null)}
				/>
			</div>
		);
	}

	/* ------------------------------------------------------------------ panel */

	return (
		<div className="page">
			<TopBar
				backTo="/"
				title="Admin"
				actions={
					<button className="btn btn--ghost btn--sm" onClick={() => setDialog('clear-key')} disabled={loading}>
						<KeyIcon />
						Change secret
					</button>
				}
			/>

			<div className="page__body">
				<div className="page-head">
					<h1>Server control</h1>
					<p className="lede">Manage the Minecraft server and the files every client syncs.</p>
				</div>

				<section className="tiles tiles--spaced" aria-label="Server status">
					<div className="tile">
						<div className="tile__label"><ServerIcon /> Container</div>
						<div className={`tile__value ${serverIsRunning === null ? '' : serverIsRunning ? 't-ok' : 't-off'}`}>
							<span className={`dot ${serverIsRunning === null ? '' : serverIsRunning ? 'dot--ok dot--live' : 'dot--off'}`} />
							{serverIsRunning === null ? 'Checking…' : serverIsRunning ? 'Running' : 'Stopped'}
						</div>
						<div className="tile__hint">{serverState || ' '}</div>
					</div>

					<div className="tile">
						<div className="tile__label"><UsersIcon /> Players</div>
						<div className="tile__value">
							{numberOfPlayers === null ? '—' : `${numberOfPlayers}${maxPlayers !== null ? ` / ${maxPlayers}` : ''}`}
						</div>
						<div className="tile__hint">{serverIsRunning ? 'Live from RCON' : 'Server is not running'}</div>
					</div>

					<div className="tile">
						<div className="tile__label"><GlobeIcon /> Address</div>
						<div className="tile__value tile__value--sm">mc.calebwash.com</div>
						<div className="tile__hint">Update DNS after an IP change</div>
					</div>
				</section>

				<div className="admin-grid">
					<section className="card">
						<div className="card__head"><PowerIcon /><h2>Server</h2></div>
						<div className="card__body">
							<button className="btn" onClick={handleStartServer} disabled={serverIsRunning === true}>
								<PowerIcon />
								Start server
							</button>
							<button className="btn" onClick={handleStopServer} disabled={serverIsRunning === false}>
								<StopIcon />
								Stop server
							</button>
							<button className="btn" onClick={handleRestartServer} disabled={serverIsRunning !== true || isRestarting}>
								{isRestarting ? <span className="spinner" /> : <SyncIcon />}
								{isRestarting ? 'Restarting…' : 'Restart server'}
							</button>
							<button className="btn" onClick={handleUpdateDns}>
								<GlobeIcon />
								Update DNS
							</button>
						</div>
					</section>

					<section className="card">
						<div className="card__head"><PackageIcon /><h2>Modpack files</h2></div>
						<div className="card__body">
							<button className="btn" onClick={handleUploadModpackZip} disabled={isUploading}>
								{isUploading ? <span className="spinner" /> : <UploadIcon />}
								{isUploading ? 'Uploading…' : 'Upload modpack zip'}
							</button>
							<button className="btn" onClick={() => navigate('/all-mods')}>
								<ListIcon />
								Browse all files
							</button>
							<button className="btn btn--ghost-danger" onClick={() => setDialog('delete-all')} disabled={loading}>
								<TrashIcon />
								Delete all files
							</button>
						</div>
					</section>
				</div>

				<section className="card">
					<div className="card__head">
						<SettingsIcon /><h2>Server settings</h2>
						<span className="spacer" />
						<button className="btn btn--ghost btn--sm" onClick={loadSettings} disabled={settingsLoading}>
							{settingsLoading ? <span className="spinner" /> : <SyncIcon />}
							Refresh
						</button>
					</div>
					<div className="card__body">
						{!settings ? (
							<p className="meta">{settingsLoading ? 'Loading…' : 'Could not load settings.'}</p>
						) : (
							<>
								{!settingsFileExists && (
									<div className="notice notice--info">
										<InfoIcon />
										The server hasn't been started yet, so these are defaults, not the live config. Saving will write them to server.properties for the first boot to use.
									</div>
								)}
								{restartRequiredKeys.length > 0 && (
									<div className="notice notice--warn" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
										<AlertIcon />
										<span>
											Saved, but the server needs a restart to apply: {restartRequiredKeys
												.map((key) => settings.find((s) => s.key === key)?.label ?? key)
												.join(', ')}
											.
										</span>
										<button className="btn btn--sm" onClick={handleRestartServer} disabled={isRestarting}>
											{isRestarting ? <span className="spinner" /> : <SyncIcon />}
											Restart now
										</button>
									</div>
								)}

								<div className="settings-grid">
									{settings.map((setting) => {
										const value = settingsEdits[setting.key] ?? setting.value;
										const inputId = `setting-${setting.key}`;
										return (
											<div className="field" key={setting.key}>
												<div className="settings-field__head">
													<label className="field__label" htmlFor={inputId}>{setting.label}</label>
													<span className={`badge ${setting.appliesLive ? 'badge--ok' : 'badge--warn'}`}>
														{setting.appliesLive ? 'Live' : 'Restart required'}
													</span>
												</div>

												{setting.type === 'enum' && (
													<select
														id={inputId}
														className="input"
														value={value}
														onChange={(e) => handleSettingChange(setting.key, e.target.value)}
													>
														{setting.options?.map((option) => (
															<option key={option} value={option}>{option}</option>
														))}
													</select>
												)}

												{setting.type === 'boolean' && (
													<select
														id={inputId}
														className="input"
														value={value}
														onChange={(e) => handleSettingChange(setting.key, e.target.value)}
													>
														<option value="true">On</option>
														<option value="false">Off</option>
													</select>
												)}

												{setting.type === 'number' && (
													<input
														id={inputId}
														type="number"
														className="input"
														min={setting.min}
														max={setting.max}
														value={value}
														onChange={(e) => handleSettingChange(setting.key, e.target.value)}
													/>
												)}

												{setting.type === 'string' && (
													<input
														id={inputId}
														type="text"
														className="input"
														value={value}
														onChange={(e) => handleSettingChange(setting.key, e.target.value)}
													/>
												)}

												<p className="meta settings-field__desc">{setting.description}</p>
											</div>
										);
									})}
								</div>

								<div className="settings-actions">
									<button
										className="btn btn--primary"
										onClick={handleSaveSettings}
										disabled={settingsSaving || Object.keys(settingsEdits).length === 0}
									>
										{settingsSaving ? <span className="spinner" /> : <CheckIcon />}
										{settingsSaving ? 'Saving…' : 'Save settings'}
									</button>
									{Object.keys(settingsEdits).length > 0 && (
										<button className="btn btn--ghost" onClick={handleDiscardSettingsEdits} disabled={settingsSaving}>
											Discard changes
										</button>
									)}
								</div>
							</>
						)}
					</div>
				</section>
			</div>

			<ConfirmModal
				isOpen={dialog === 'clear-key'}
				title="Clear the saved secret?"
				message="You will need to enter the admin secret again the next time you open this panel."
				confirmLabel="Clear secret"
				tone="neutral"
				onConfirm={handleClearAdminKey}
				onCancel={() => setDialog(null)}
			/>

			<ConfirmModal
				isOpen={dialog === 'delete-all'}
				title="Delete every file?"
				message="This marks all mods, configs and resource packs for deletion. Every client will remove them on the next sync. This cannot be undone."
				confirmLabel="Delete everything"
				onConfirm={handleDeleteAllFiles}
				onCancel={() => setDialog(null)}
			/>
		</div>
	);
}

export default Admin;
