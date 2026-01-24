import './App.css';
import logo from './assets/images/CalebsModLogo.png';
import { Link } from 'react-router-dom';
import { StartMinecraftClient, CheckForgeInstalled, InstallForge } from '../wailsjs/go/main/MinecraftService';
import { useState, useEffect } from 'react';

function App() {
	const [launcherInstalled, setLauncherInstalled] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);

	const syncMods = () => {
		console.log("Syncing mods");
	}

	const connectToServer = async () => {
		try {
			await StartMinecraftClient();
			console.log("Minecraft launched successfully");
		} catch (error) {
			console.error("Failed to launch Minecraft:", error);
			alert("Failed to launch Minecraft: " + error);
		}
	}

	const installForge = async () => {
		setIsInstalling(true);
		try {
			const success = await InstallForge();
			if (success) {
				setLauncherInstalled(true);
				alert("PrismLauncher installed successfully!");
			} else {
				alert("Failed to install PrismLauncher. Please install manually.");
			}
		} catch (error) {
			console.error("Failed to install PrismLauncher:", error);
			alert("Failed to install PrismLauncher: " + error);
		} finally {
			setIsInstalling(false);
		}
	}

	useEffect(() => {
		const checkLauncher = async () => {
			try {
				const installed = await CheckForgeInstalled();
				setLauncherInstalled(installed);
			} catch (error) {
				console.error("Failed to check launcher installation:", error);
			}
		}
		checkLauncher();
	}, []);

	return (
        <div id="App">
			<div className="logo-container">
				<img src={logo} alt="CalebsMod Logo" className="app-logo" />
				<p className="subtitle">Private Modpack for Friends</p>
			</div>
		   
		   <div className="status-bar">
			   <span className="status-item">Server: <span className="status-online">Online</span></span>
			   <span className="status-item">Mods: <span className="status-synced">Synced</span></span>
		   </div>

		   <div className="options">
				<button className="mc-button large" onClick={syncMods}>Sync Mods</button>
				<button className="mc-button large green" onClick={connectToServer} disabled={!launcherInstalled}>Launch Minecraft</button>
				<button className="mc-button large" onClick={installForge} disabled={isInstalling}>
					{isInstalling ? "Installing..." : (launcherInstalled ? "Reinstall Launcher" : "Install Launcher")}
				</button>
				<Link className="mc-button admin-link" to="/admin">Admin Panel</Link>	
		   </div>
        </div>
    )
}

export default App
