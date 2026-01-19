interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) {
	if (!isOpen) return null;

	return (
		<div className="modal-overlay" onClick={onCancel}>
			<div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
				<h2 className="modal-title">{title}</h2>
				<p className="modal-message">{message}</p>
				<div className="modal-buttons">
					<button className="mc-button red" onClick={onConfirm}>
						Confirm
					</button>
					<button className="mc-button" onClick={onCancel}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

export default ConfirmModal;
