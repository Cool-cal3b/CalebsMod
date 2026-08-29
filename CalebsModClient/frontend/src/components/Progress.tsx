interface ProgressProps {
	label: string;
	/** Omit for work whose total is not known yet. */
	percent?: number | null;
}

export default function Progress({ label, percent }: ProgressProps) {
	const known = typeof percent === 'number' && Number.isFinite(percent);
	const value = known ? Math.max(0, Math.min(100, Math.round(percent))) : 0;

	return (
		<div className="progress">
			<div className="progress__meta">
				<span className="progress__label">{label}</span>
				{known && <span className="progress__pct">{value}%</span>}
			</div>
			<div
				className="progress__track"
				role="progressbar"
				aria-label={label}
				aria-valuenow={known ? value : undefined}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className={known ? 'progress__fill' : 'progress__fill progress__fill--indeterminate'}
					style={{ width: `${value}%` }}
				/>
			</div>
		</div>
	);
}
