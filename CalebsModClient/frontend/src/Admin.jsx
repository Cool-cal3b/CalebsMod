import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { admin } from '../wailsjs/api/admin';

function Admin() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [adminKeyIsSet, setAdminKeyIsSet] = useState(false);

	useEffect(async () => {
		const adminKeyIsSet = await admin.AdminKeyIsSet();
		setAdminKeyIsSet(adminKeyIsSet);
		if (adminKeyIsSet) {
			const isLoggedIn = await admin.IsLoggedIn();
			setIsLoggedIn(isLoggedIn);
		}
	}, []);

	return (
		<div id="Admin">
			{(adminKeyIsSet && isLoggedIn ? (
			<div>
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
			</div>
			) : (
				(adminKeyIsSet ? (
					<div>
						<h1>Admin Panel</h1>
						<button className="mc-button" onClick={() => admin.Login()}>Login</button>
					</div>
				) : (
					<div>
						<h1>Admin Panel</h1>
						<input type="file" onChange={(e) => admin.SetAdminKey(e.target.files[0])} />
						<button className="mc-button" onClick={() => admin.SetAdminKey(e.target.files[0])}>Set Admin Key</button>
					</div>
				)))}

			<Link to="/" className="mc-button back-button">Back to Home</Link>
		</div>
	)
}

export default Admin