import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AdminKeyIsSet, IsLoggedIn, Login, SetAdminKey } from '../wailsjs/go/main/Admin';

function Admin() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [adminKeyIsSet, setAdminKeyIsSet] = useState(false);
	const [adminKeyInput, setAdminKeyInput] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		checkAuthStatus();
	}, []);

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
			setError('Login failed. Check your connection to the server.');
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
				</div>

				<Link to="/" className="mc-button back-button">Back to Home</Link>
			</div>
		);
	}

	return (
		<div id="Admin">
			<h1>Admin Panel</h1>
			
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
					<button className="mc-button green">Start Server</button>
					<button className="mc-button red">Stop Server</button>
					<button className="mc-button">View Logs</button>
				</section>
			</div>

			<Link to="/" className="mc-button back-button">Back to Home</Link>
		</div>
	);
}

export default Admin