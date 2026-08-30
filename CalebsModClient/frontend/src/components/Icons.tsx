// Inline stroke icons (Lucide-style geometry, 24px grid) so the UI has no
// emoji glyphs and no icon-font dependency to ship.
type IconProps = { className?: string };

const base = {
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.9,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
	'aria-hidden': true,
};

export const PlayIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}><path d="M7 4.5 19.5 12 7 19.5Z" /></svg>
);

export const SyncIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M20.5 11.5a8.5 8.5 0 0 0-14.6-5.4L3 9" />
		<path d="M3.5 12.5a8.5 8.5 0 0 0 14.6 5.4L21 15" />
		<path d="M3 4v5h5M21 20v-5h-5" />
	</svg>
);

export const RestoreIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 8.7" />
		<path d="M3 4v5h5" /><path d="M12 7.8V12l3 1.8" />
	</svg>
);

export const DownloadIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" />
	</svg>
);

export const UpdateIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 21v-12" /><path d="m7 14 5-5 5 5" />
		<path d="M4.5 5.5h15" />
	</svg>
);

export const TrashIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M4 6h16" /><path d="M9 6V4h6v2" />
		<path d="M6.5 6 7.4 20h9.2L17.5 6" /><path d="M10 10v6M14 10v6" />
	</svg>
);

export const ShieldIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6Z" />
	</svg>
);

export const CheckIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}><path d="m4.5 12.5 5 5 10-11" /></svg>
);

export const CheckCircleIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16 9.5" />
	</svg>
);

export const AlertIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 4.5 2.8 20h18.4Z" /><path d="M12 10v4.2" /><path d="M12 17.4h.01" />
	</svg>
);

export const InfoIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" />
	</svg>
);

export const XIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const ArrowLeftIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
);

export const ServerIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<rect x="3" y="4" width="18" height="7" rx="2" />
		<rect x="3" y="13" width="18" height="7" rx="2" />
		<path d="M7 7.5h.01M7 16.5h.01" />
	</svg>
);

export const UsersIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="9" cy="8" r="3.4" />
		<path d="M2.8 20a6.4 6.4 0 0 1 12.4 0" />
		<path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.4" /><path d="M17.6 14.6A6.4 6.4 0 0 1 21.4 20" />
	</svg>
);

export const PackageIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3Z" />
		<path d="m4 7.3 8 4.3 8-4.3M12 11.6V21" />
	</svg>
);

export const UploadIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" />
	</svg>
);

export const PowerIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M12 3v9" /><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0" />
	</svg>
);

export const StopIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}><rect x="5.5" y="5.5" width="13" height="13" rx="2.5" /></svg>
);

export const GlobeIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="12" cy="12" r="9" /><path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
		<path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z" />
	</svg>
);

export const ListIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
	</svg>
);

export const CopyIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M15 6.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1.5" />
	</svg>
);

export const KeyIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="8" cy="14" r="4.2" /><path d="m11 11 8.5-8.5" /><path d="m16.5 5.5 2.5 2.5M14.5 7.5 17 10" />
	</svg>
);

export const SettingsIcon = ({ className = 'btn__icon' }: IconProps) => (
	<svg {...base} className={className}>
		<circle cx="12" cy="12" r="3.2" />
		<path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
	</svg>
);
