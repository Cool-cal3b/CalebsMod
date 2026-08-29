import './App.css';
import {
	InstallLauncher as InstallLauncherService,
	CheckLauncherInstalled,
	StartMinecraftClient,
} from '../wailsjs/go/main/MinecraftService';
import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import SelectModImage from './assets/images/PrismLauncherSelectMod.png';
import MinecraftIconImage from './assets/images/PrismLauncherMinecraftIcon.png';
import TopBar from './components/TopBar';
import { useToast, errorText } from './components/Toast';
import { CheckIcon, DownloadIcon, GlobeIcon, PlayIcon } from './components/Icons';

const SERVER_ADDRESS = 'mc.calebwash.com';

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
	return (
		<section className={done ? 'step step--done' : 'step'}>
			<div className="step__num">{done ? <CheckIcon className="" /> : n}</div>
			<div className="step__body">
				<h2>{title}</h2>
				{children}
			</div>
		</section>
	);
}

export default function InstallLauncherPage() {
	const [launcherDownloaded, setLauncherDownloaded] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const navigate = useNavigate();
	const toast = useToast();

	useEffect(() => {
		CheckLauncherInstalled()
			.then(setLauncherDownloaded)
			.catch((error) => console.error('Failed to check launcher:', error));
	}, []);

	const downloadLauncher = async () => {
		setIsDownloading(true);
		try {
			await InstallLauncherService();
			setLauncherDownloaded(true);
			toast.success('PrismLauncher installed', 'Continue with step 2 below.');
		} catch (error) {
			console.error('Failed to install launcher:', error);
			toast.error('Install failed', errorText(error));
		} finally {
			setIsDownloading(false);
		}
	};

	const openLauncher = async () => {
		try {
			await StartMinecraftClient();
			toast.info('Opening PrismLauncher', 'This can take a moment the first time.');
		} catch (error) {
			console.error('Failed to open PrismLauncher:', error);
			toast.error('Could not open PrismLauncher', errorText(error));
		}
	};

	return (
		<div className="page">
			<TopBar backTo="/" title="Setup" />

			<div className="page__body page__body--narrow">
				<div className="page-head">
					<h1>Set up your launcher</h1>
					<p className="lede">Five steps, once. After this you launch straight from the home screen.</p>
				</div>

				<div className="steps">
					<Step n={1} title="Install PrismLauncher" done={launcherDownloaded}>
						<p>A portable copy is installed just for CalebsMod — your existing Minecraft setup is left alone.</p>
						{launcherDownloaded ? (
							<span className="badge badge--ok"><CheckIcon className="" /> Installed</span>
						) : (
							<button className="btn btn--primary" onClick={downloadLauncher} disabled={isDownloading}>
								{isDownloading ? <span className="spinner" /> : <DownloadIcon />}
								{isDownloading ? 'Downloading…' : 'Install PrismLauncher'}
							</button>
						)}
					</Step>

					<Step n={2} title="Open PrismLauncher and sign in">
						<p>Launch it and sign in with the Microsoft account that owns Minecraft. You only do this once.</p>
						<button className="btn" onClick={openLauncher} disabled={!launcherDownloaded}>
							<PlayIcon />
							Open PrismLauncher
						</button>
					</Step>

					<Step n={3} title="Import the CalebsMod modpack">
						<p>PrismLauncher will show the CalebsMod modpack path already filled in. Click <strong>OK</strong> without changing anything.</p>
						<img src={SelectModImage} alt="The PrismLauncher import dialog with the CalebsMod pack selected" className="step__shot" />
					</Step>

					<Step n={4} title="Run it once">
						<p>Double-click the <strong>CalebsMod</strong> instance to finish creating the modpack.</p>
						<img src={MinecraftIconImage} alt="The CalebsMod instance tile in PrismLauncher" className="step__shot" />
					</Step>

					<Step n={5} title="You're ready">
						<p>Close Minecraft and come back here. <strong>Launch Minecraft</strong> on the home screen connects you straight to the server.</p>
						<span className="address-chip">
							<GlobeIcon className="" />
							Server address <code>{SERVER_ADDRESS}</code>
						</span>
					</Step>
				</div>

				<div className="page-actions">
					<button className="btn btn--primary" onClick={() => navigate('/')}>
						Done — back to home
					</button>
				</div>
			</div>
		</div>
	);
}
