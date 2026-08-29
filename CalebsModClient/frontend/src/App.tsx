import './App.css';
import logo from './assets/images/CalebsModLogo.png';
import { Link } from 'react-router-dom';
import { StartMinecraftClient, CheckLauncherInstalled, DeleteLauncher, SyncMods, ResetClient } from '../wailsjs/go/main/MinecraftService';
import { useState, useEffect } from 'react';
import ConfirmModal from './components/ConfirmModal';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

function App() {
	const [launcherInstalled, setLauncherInstalled] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(null);

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

	const resetClient = async () => {
		setShowResetConfirm(false);
		setIsResetting(true);
		try {
			const success = await ResetClient();
			if (success) {
				alert("Client reset complete! Everything was re-downloaded from scratch.");
			} else {
				alert("Reset failed. Please make sure PrismLauncher and Minecraft are closed.");
			}
		} catch (error) {
			console.error("Failed to reset client:", error);
			alert("Failed to reset client: " + error);
		} finally {
			setIsResetting(false);
			setProgress(null);
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
		EventsOn('sync:progress', (p: { phase: string; done: number; total: number }) => {
			setProgress(p);
		});
		return () => EventsOff('sync:progress');
	}, []);

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

	const pct = progress && progress.total > 0
		? Math.floor((progress.done / progress.total) * 100)
		: 0;
	const resetLabel = progress
		? (progress.phase === 'verifying'
			? `Checking files... ${pct}%`
			: `Downloading... ${pct}% (${progress.done}/${progress.total})`)
		: "Resetting...";

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
				{launcherInstalled && (
					<button className="mc-button large red" onClick={() => setShowResetConfirm(true)} disabled={isResetting}>
						{isResetting ? resetLabel : "Reset Client"}
					</button>
				)}
				<Link className="mc-button admin-link" to="/admin">Admin Panel</Link>	
		   </div>

		   <ConfirmModal
			   isOpen={showResetConfirm}
			   title="Reset Client?"
			   message="This deletes your CalebsMod instance and all local mod data, then re-downloads everything from scratch. Use this if the server rejects your client or mods seem out of sync. Your Microsoft login is kept. Close Minecraft first."
			   onConfirm={resetClient}
			   onCancel={() => setShowResetConfirm(false)}
		   />
        </div>
    )
}

export default App
