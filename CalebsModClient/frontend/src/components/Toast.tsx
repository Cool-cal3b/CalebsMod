import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertIcon, CheckCircleIcon, InfoIcon, XIcon } from './Icons';

type ToastKind = 'ok' | 'error' | 'info';

interface Toast {
	id: number;
	kind: ToastKind;
	title: string;
	text?: string;
}

interface ToastApi {
	success: (title: string, text?: string) => void;
	error: (title: string, text?: string) => void;
	info: (title: string, text?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Errors linger: they usually carry a message the player needs to read or
// repeat back. Confirmations clear themselves.
const LIFETIME_MS: Record<ToastKind, number> = { ok: 4500, error: 10000, info: 6000 };

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const nextId = useRef(1);

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((t) => t.id !== id));
	}, []);

	const push = useCallback((kind: ToastKind, title: string, text?: string) => {
		const id = nextId.current++;
		setToasts((current) => [...current.slice(-3), { id, kind, title, text }]);
		window.setTimeout(() => dismiss(id), LIFETIME_MS[kind]);
	}, [dismiss]);

	const api = useMemo<ToastApi>(() => ({
		success: (title, text) => push('ok', title, text),
		error: (title, text) => push('error', title, text),
		info: (title, text) => push('info', title, text),
	}), [push]);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div className="toasts" role="status" aria-live="polite">
				{toasts.map((toast) => (
					<div key={toast.id} className={`toast toast--${toast.kind}`}>
						{toast.kind === 'ok' && <CheckCircleIcon className="toast__icon" />}
						{toast.kind === 'error' && <AlertIcon className="toast__icon" />}
						{toast.kind === 'info' && <InfoIcon className="toast__icon" />}
						<div className="toast__body">
							<div className="toast__title">{toast.title}</div>
							{toast.text && <div className="toast__text">{toast.text}</div>}
						</div>
						<button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
							<XIcon />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const api = useContext(ToastContext);
	if (!api) throw new Error('useToast must be used inside <ToastProvider>');
	return api;
}

// Turns whatever Wails threw (Error, string, object) into one readable line.
export function errorText(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	return String(err);
}
