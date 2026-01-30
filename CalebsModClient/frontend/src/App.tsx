import './App.css';
import logo from './assets/images/CalebsModLogo.png';
import { Link } from 'react-router-dom';
import { StartMinecraftClient, CheckLauncherInstalled, DeleteLauncher, SyncMods } from '../wailsjs/go/main/MinecraftService';
import { useState, useEffect } from 'react';

function App() {
	const [launcherInstalled, setLauncherInstalled] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);

	const syncMods = async () => {
		if (isSyncing) return;

		setIsSyncing(true);
		try {
			const success = await SyncMods();
			if (success) {
				alert("Server added to Minecraft successfully!");
			} else {
				alert("Failed to add server. Please check the launcher is installed.");
			}
		} catch (error) {
			console.error("Failed to sync mods:", error);
			alert("Failed to sync: " + error);
		} finally {
			setIsSyncing(false);
		}
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

	const deleteLauncher = async () => {
		setIsInstalling(true);
		try {
			const success = await DeleteLauncher();
			if (success) {
				setLauncherInstalled(false);
				alert("PrismLauncher deleted successfully!");
			} else {
				alert("Failed to delete PrismLauncher. Please delete manually.");
			}
		} catch (error) {
			console.error("Failed to delete PrismLauncher:", error);
			alert("Failed to delete PrismLauncher: " + error);
		} finally {
			setIsInstalling(false);
		}
	}

	useEffect(() => {
		const checkLauncher = async () => {
			try {
				const installed = await CheckLauncherInstalled();
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
			   <span className="status-item">Mods: <span className="status-synced">Synced</span> (Its a lie!)</span>
		   </div>

		   <div className="options">

				{launcherInstalled && (
					<button className="mc-button large" onClick={syncMods} disabled={isSyncing}>
						{isSyncing ? "Adding Server..." : "Add Server to Minecraft (Sync mods coming soon)"}
					</button>
				)}
				<button className="mc-button large green" onClick={connectToServer} disabled={!launcherInstalled}>Launch Minecraft</button>
				{launcherInstalled
					? <button className="mc-button large" onClick={deleteLauncher} disabled={isInstalling}>Delete Launcher</button>
					: <Link className="mc-button large" to="/install-launcher">Install Launcher</Link>
				}
				<Link className="mc-button admin-link" to="/admin">Admin Panel</Link>	
		   </div>
        </div>
    )
}

export default App
