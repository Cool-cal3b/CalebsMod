import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AdminKeyIsSet, IsLoggedIn, Login, SetAdminKey, ClearAdminKey, StartServer, StopServer, UpdateDns, GetServerStatus } from '../wailsjs/go/main/Admin';
import { ServerStatus, MinecraftServerResponse, ServerStatusResponse } from './types/admin-types';
import ConfirmModal from './components/ConfirmModal';

function Admin() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [adminKeyIsSet, setAdminKeyIsSet] = useState(false);
	const [adminKeyInput, setAdminKeyInput] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [showClearModal, setShowClearModal] = useState(false);

	const [serverIsRunning, setServerIsRunning] = useState<boolean | null>(null);
	const [serverStatus, setServerStatus] = useState<string | null>(null);
	const [numberOfPlayers, setNumberOfPlayers] = useState<number | null>(null);
	const [maxPlayers, setMaxPlayers] = useState<number | null>(null);

	useEffect(() => {
		checkAuthStatus();
	}, []);

	useEffect(() => {
		if (!isLoggedIn) {
			return;
		}

		let timeoutId: number;

		const getServerStatus = async () => {
			try {
				const response: ServerStatusResponse = await GetServerStatus();
				setServerIsRunning(response.dockerStatus.running);
				setServerStatus(response.dockerStatus.status);
				setNumberOfPlayers(response.players.online);
				setMaxPlayers(response.players.max);
			} catch (err) {
				console.error('Failed to fetch server status:', err);
			}

			timeoutId = setTimeout(getServerStatus, 2000);
		};

		getServerStatus();

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [isLoggedIn]);

	const checkAuthStatus = async () => {
		try {
			const keySet = await AdminKeyIsSet();
			setAdminKeyIsSet(keySet);
			
			if (keySet) {
				const loggedIn = await IsLoggedIn();
				setIsLoggedIn(loggedIn);
			}
		} catch (err) {
			setError('Failed to check auth status');
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
			const errorMsg = (err as Error).message;
			if (errorMsg && errorMsg.includes('invalid admin secret')) {
				setError('Invalid admin secret. The key has been cleared. Please enter it again.');
				setAdminKeyIsSet(false);
				setAdminKeyInput('');
			} else {
				setError('Login failed. Check your connection to the server. Error: ' + err);
			}
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleSetAdminKey = async () => {
		if (!adminKeyInput.trim()) {
			setError('Please enter an admin secret');
			return;
		}

		setLoading(true);
		setError('');

		try {
			await SetAdminKey(adminKeyInput);
			setAdminKeyIsSet(true);
			setAdminKeyInput('');
		} catch (err) {
			setError('Failed to save admin key');
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleClearAdminKey = async () => {
		setShowClearModal(false);
		setLoading(true);
		setError('');

		try {
			await ClearAdminKey();
			setAdminKeyIsSet(false);
			setIsLoggedIn(false);
			setAdminKeyInput('');
		} catch (err) {
			setError('Failed to clear admin key');
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleStartServer = async () => {
		try {
			const response: MinecraftServerResponse = await StartServer();
			console.log(response);
			if (response.status === ServerStatus.STARTED) {
				setError("Successfully started server");
			} else {
				setError("Failed to start server: " + response.message);
			}
		} catch (err) {
			setError('Failed to start server: ' + (err as Error).message);
			console.error(err);
		}
	};

	const handleStopServer = async () => {
		try {
			const response: MinecraftServerResponse = await StopServer();
			if (response.status === ServerStatus.STOPPED) {
				setError("Successfully stopped server");
			} else {
				setError("Failed to stop server: " + response.message);
			}
		} catch (err) {
			setError('Failed to stop server: ' + (err as Error).message);
			console.error(err);
		}
	};

	const handleUpdateDns = async () => {
		try {
			await UpdateDns();
			setError("Successfully updated DNS to mc.calebwash.com");
		} catch (err) {
			setError('Failed to update DNS: ' + (err as Error).message);
			console.error(err);
		}
	};

	if (!adminKeyIsSet) {
		return (
			<div id="Admin">
				<h1>Admin Setup</h1>
				<p className="subtitle">Enter your admin secret to get started</p>

				<div className="auth-form glass-card">
					<input 
						type="password"
						className="mc-input"
						placeholder="Admin Secret"
						value={adminKeyInput}
						onChange={(e) => setAdminKeyInput(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && handleSetAdminKey()}
					/>
					
					{error && <p className="error-message">{error}</p>}
					
					<button 
						className="mc-button large green" 
						onClick={handleSetAdminKey}
						disabled={loading}
					>
						{loading ? 'Saving...' : 'Save Admin Secret'}
					</button>
				</div>

				<Link to="/" className="mc-button back-button">Back to Home</Link>
			</div>
		);
	}

	if (!isLoggedIn) {
		return (
			<>
				<div id="Admin">
					<h1>Admin Login</h1>
					<p className="subtitle">Authenticate with the server</p>

					<div className="auth-form glass-card">
						{error && <p className="error-message">{error}</p>}
						
						<button 
							className="mc-button large green" 
							onClick={handleLogin}
							disabled={loading}
						>
							{loading ? 'Logging in...' : 'Login to Server'}
						</button>

						<button 
							className="mc-button" 
							onClick={() => setShowClearModal(true)}
							disabled={loading}
						>
							Update Admin Secret
						</button>
					</div>

					<Link to="/" className="mc-button back-button">Back to Home</Link>
				</div>

				<ConfirmModal
					isOpen={showClearModal}
					title="Clear Admin Secret?"
					message="Are you sure you want to clear the admin secret? You will need to enter it again."
					onConfirm={handleClearAdminKey}
					onCancel={() => setShowClearModal(false)}
				/>
			</>
		);
	}

	return (
		<>
			<div id="Admin">
				<h1>Admin Panel</h1>

				<div className="server-stats">
					<div className="stat-card">
						<div className="stat-label">Server Status</div>
						<div className="stat-value">
							{serverIsRunning === null ? (
								<span className="status-loading">Loading...</span>
							) : serverIsRunning ? (
								<span className="status-online">Running</span>
							) : (
								<span className="status-offline">Stopped</span>
							)}
						</div>
						{serverStatus && <div className="stat-detail">{serverStatus}</div>}
					</div>

					<div className="stat-card">
						<div className="stat-label">Players Online</div>
						<div className="stat-value">
							{numberOfPlayers === null ? (
								<span className="status-loading">Loading...</span>
							) : (
								<>
									<span className={numberOfPlayers > 0 ? 'player-count active' : 'player-count'}>
										{numberOfPlayers}
									</span>
									{maxPlayers !== null && (
										<span className="player-max"> / {maxPlayers}</span>
									)}
								</>
							)}
						</div>
					</div>
				</div>
				
				<div className="admin-sections">
					<section className="admin-section">
						<h2>Manage Mods</h2>
						<button className="mc-button">Add Mod by URL</button>
						<button className="mc-button">Upload Mod File</button>
						<button className="mc-button">View All Mods</button>
					</section>

					<section className="admin-section">
						<h2>Access Requests</h2>
						<button className="mc-button">View Pending</button>
						<button className="mc-button">View All</button>
					</section>

					<section className="admin-section">
						<h2>Server Control</h2>
						<button className="mc-button green" onClick={handleStartServer}>Start Server</button>
						<button className="mc-button red" onClick={handleStopServer}>Stop Server</button>
						<button className="mc-button yellow" onClick={handleUpdateDns}>Update DNS</button>
						<button className="mc-button">View Logs</button>
					</section>
				</div>

				<div className="admin-footer">
					<button 
						className="mc-button" 
						onClick={() => setShowClearModal(true)}
						disabled={loading}
					>
						Update Admin Secret
					</button>
				</div>

				<Link to="/" className="mc-button back-button">Back to Home</Link>
			</div>

			<ConfirmModal
				isOpen={showClearModal}
				title="Clear Admin Secret?"
				message="Are you sure you want to clear the admin secret? You will need to enter it again."
				onConfirm={handleClearAdminKey}
				onCancel={() => setShowClearModal(false)}
			/>
		</>
	);
}

export default Admin
