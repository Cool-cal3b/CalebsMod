import './App.css';
import logo from './assets/images/CalebsModLogo.png';
import { Link } from 'react-router-dom';

function App() {
	const syncMods = () => {
		console.log("Syncing mods");
	}

	const connectToServer = () => {
		console.log("Connecting to server");
	}

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
				<button className="mc-button large green" onClick={connectToServer}>Launch Minecraft</button>
				<Link className="mc-button admin-link" to="/admin">Admin Panel</Link>	
		   </div>
        </div>
    )
}

export default App
