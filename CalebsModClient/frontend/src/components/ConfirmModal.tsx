import { useEffect, useRef } from 'react';
import { AlertIcon, InfoIcon } from './Icons';

interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: 'danger' | 'neutral';
	onConfirm: () => void;
	onCancel: () => void;
}

function ConfirmModal({
	isOpen,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	tone = 'danger',
	onConfirm,
	onCancel,
}: ConfirmModalProps) {
	const cancelRef = useRef<HTMLButtonElement>(null);

	// Escape closes, and focus starts on the safe choice rather than the
	// destructive one.
	useEffect(() => {
		if (!isOpen) return;
		cancelRef.current?.focus();
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCancel();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onCancel]);

	if (!isOpen) return null;

	return (
		<div className="modal__scrim" onClick={onCancel}>
			<div
				className="modal"
				role="alertdialog"
				aria-modal="true"
				aria-label={title}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={tone === 'danger' ? 'modal__icon' : 'modal__icon modal__icon--neutral'}>
					{tone === 'danger' ? <AlertIcon /> : <InfoIcon />}
				</div>
				<h2 className="modal__title">{title}</h2>
				<p className="modal__message">{message}</p>
				<div className="modal__actions">
					<button ref={cancelRef} className="btn" onClick={onCancel}>
						{cancelLabel}
					</button>
					<button
						className={tone === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

export default ConfirmModal;
