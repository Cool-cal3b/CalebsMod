import { Link } from 'react-router-dom';
import mark from '../assets/images/CalebsModFavIcon.png';
import { ArrowLeftIcon } from './Icons';
import type { ReactNode } from 'react';

interface TopBarProps {
	/** Where the back button goes. Omitted on screens with no parent. */
	backTo?: string;
	title: string;
	actions?: ReactNode;
}

export default function TopBar({ backTo, title, actions }: TopBarProps) {
	return (
		<header className="topbar">
			{backTo && (
				<Link className="btn btn--ghost btn--sm" to={backTo}>
					<ArrowLeftIcon />
					Back
				</Link>
			)}
			{/* The square "CM" mark reads at this size where the full wordmark
			    turns to mush; the wordmark itself owns the home screen. */}
			<span className="topbar__brand">
				<img className="topbar__mark" src={mark} alt="" />
				CalebsMod
			</span>
			<span className="topbar__rule" />
			<span className="topbar__title">{title}</span>
			<span className="spacer" />
			{actions}
		</header>
	);
}
