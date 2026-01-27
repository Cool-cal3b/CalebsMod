import { InstallLauncher as InstallLauncherService, CheckLauncherInstalled, StartMinecraftClient } from '../wailsjs/go/main/MinecraftService';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SelectModImage from './assets/images/PrismLauncherSelectMod.png';
import MinecraftIconImage from './assets/images/PrismLauncherMinecraftIcon.png';

export default function InstallLauncherPage() {
    const [launcherDownloaded, setLauncherDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const checkLauncher = async () => {
            try {
                const installed = await CheckLauncherInstalled();
                setLauncherDownloaded(installed);
            } catch (error) {
                console.error("Failed to check launcher:", error);
            }
        }
        checkLauncher();
    }, []);

    const downloadLauncher = async () => {
        setIsDownloading(true);
        try {
            await InstallLauncherService();
            setLauncherDownloaded(true);
        } catch (error) {
            console.error("Failed to install launcher:", error);
            alert("Failed to install launcher: " + error);
        } finally {
            setIsDownloading(false);
        }
    }

    const openLauncher = async () => {
        await StartMinecraftClient();
    }

	return (
		<div className="install-launcher">
			<button className="back-button" onClick={() => navigate('/')}>← Back</button>
			
			<h1>Install Launcher</h1>
			<p className="subtitle">Follow these steps to set up PrismLauncher for Caleb's Mod</p>
            
            <div className="steps-container">
                <div className="step-bubble">
                    <h2>Step 1: Download PrismLauncher</h2>
                    <p>Download the latest version of PrismLauncher (portable)</p>
                    {launcherDownloaded && !isDownloading && (
                        <div className="success">✓ Launcher downloaded!</div>
                    )}
                    {!launcherDownloaded && !isDownloading && (
                        <button className="mc-button large green" onClick={downloadLauncher}>
                            Download PrismLauncher
                        </button>
                    )}
                    {isDownloading && (
                        <div className="downloading">Downloading... Please wait</div>
                    )}
                </div>

                <div>
                    <h2>Step 2: Open PrismLauncher</h2>
                    <button className="mc-button large green" onClick={openLauncher}>Open PrismLauncher</button>
                </div>

                <div className="step-bubble">
                    <h2>Step 2: Log into Microsoft Account</h2>
                    <p>Open PrismLauncher and log into your Microsoft account to access Minecraft</p>
                </div>

                <div className="step-bubble">   
                    <h2>Step 3: Import CalebsMod Modpack</h2>
                    <p>In PrismLauncher, you'll see the "CalebsMod" modpack path. Click "OK" without changing anything else.</p>
                    <img src={SelectModImage} alt="Select CalebsMod modpack" className="instruction-image" />
                </div>

                <div className="step-bubble">
                    <h2>Step 4: Launch CalebsMod</h2>
                    <p>You will see a Minecraft icon with "CalebsMod" underneath it. Double click it to finish the the modpack creation.</p>
                    <img src={MinecraftIconImage} alt="CalebsMod instance icon" className="instruction-image" />
                </div>

                <div className="step-bubble">
                    <h2>Step 5: You're Ready!</h2>
                    <p>Minecraft will launch with all the mods installed. You can close Minecraft and return to the CalebsMod app.</p>
                    <p>Click "Launch Minecraft" on the home screen to connect to the server.</p>
                    <p className="server-info">Server address: <code>mc.calebwash.com</code></p>
                </div>

                <button className="mc-button large" onClick={() => navigate('/')}>
                    Done - Return to Home
                </button>
            </div>
		</div>
	)
}