import './App.css';
import { useState, useEffect, useMemo } from 'react';
import { GetAllFiles, UpdateFileFlags, CreateFullResync, DeleteFile } from '../wailsjs/go/main/Admin';
import { go_services } from '../wailsjs/go/models';
import ConfirmModal from './components/ConfirmModal';
import TopBar from './components/TopBar';
import { useToast, errorText } from './components/Toast';
import { CopyIcon, PackageIcon, TrashIcon } from './components/Icons';

function formatSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function AllMods() {
	const toast = useToast();

	const [files, setFiles] = useState<go_services.PackFileDto[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<go_services.PackFileDto | null>(null);

	useEffect(() => {
		// Debounced so typing does not fire a request per keystroke.
		const timer = setTimeout(fetchFiles, 200);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const fetchFiles = async () => {
		try {
			setFiles(await GetAllFiles(searchQuery));
		} catch (err) {
			toast.error('Could not load the file list', errorText(err));
		}
	};

	const counts = useMemo(() => ({
		server: files.filter((f) => !f.clientOnly).length,
		client: files.filter((f) => !f.serverOnly).length,
	}), [files]);

	const toggleServerOnly = (sha256: string) => {
		setFiles(files.map((f) =>
			f.sha256 === sha256
				? { ...f, serverOnly: !f.serverOnly, clientOnly: f.serverOnly ? f.clientOnly : false }
				: f
		));
		setHasChanges(true);
	};

	const toggleClientOnly = (sha256: string) => {
		setFiles(files.map((f) =>
			f.sha256 === sha256
				? { ...f, clientOnly: !f.clientOnly, serverOnly: f.clientOnly ? f.serverOnly : false }
				: f
		));
		setHasChanges(true);
	};

	const saveChanges = async () => {
		setLoading(true);
		try {
			for (const file of files) {
				await UpdateFileFlags(file.sha256, file.serverOnly, file.clientOnly);
			}
			await CreateFullResync();
			toast.success('Changes saved', 'A full resync revision was created for all clients.');
			setHasChanges(false);
			await fetchFiles();
		} catch (err) {
			toast.error('Could not save the changes', errorText(err));
		} finally {
			setLoading(false);
		}
	};

	const confirmDelete = async () => {
		const file = pendingDelete;
		setPendingDelete(null);
		if (!file) return;

		setLoading(true);
		try {
			await DeleteFile(file.sha256);
			toast.success(`Deleted ${file.fileName}`, 'Clients will remove it on the next sync.');
			await fetchFiles();
		} catch (err) {
			toast.error('Could not delete the file', errorText(err));
		} finally {
			setLoading(false);
		}
	};

	const copyList = async (which: 'server' | 'client') => {
		const list = files.filter((f) => (which === 'server' ? !f.clientOnly : !f.serverOnly));
		try {
			await navigator.clipboard.writeText(list.map((f) => f.fileName).join('\n'));
			toast.success(`Copied ${list.length} ${which} file${list.length === 1 ? '' : 's'}`);
		} catch (err) {
			toast.error('Could not copy to the clipboard', errorText(err));
		}
	};

	const rowClass = (file: go_services.PackFileDto) =>
		file.serverOnly ? 'file-row file-row--server'
			: file.clientOnly ? 'file-row file-row--client'
				: 'file-row file-row--both';

	return (
		<div className="page">
			<TopBar
				backTo="/admin"
				title="Modpack files"
				actions={
					hasChanges ? (
						<button className="btn btn--primary btn--sm" onClick={saveChanges} disabled={loading}>
							{loading && <span className="spinner" />}
							{loading ? 'Saving…' : 'Save & create resync'}
						</button>
					) : (
						<span className="meta">{files.length} file{files.length === 1 ? '' : 's'}</span>
					)
				}
			/>

			<div className="page__body">
				<div className="files-toolbar">
					<div className="files-toolbar__row">
						<input
							type="text"
							className="input input--search files-toolbar__search"
							placeholder="Search files…"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
						<button className="btn btn--sm" onClick={() => copyList('server')}>
							<CopyIcon />
							Server list ({counts.server})
						</button>
						<button className="btn btn--sm" onClick={() => copyList('client')}>
							<CopyIcon />
							Client list ({counts.client})
						</button>
					</div>

					<div className="legend">
						<span className="legend__item">
							<span className="legend__swatch" style={{ background: 'var(--accent)' }} /> Both sides
						</span>
						<span className="legend__item">
							<span className="legend__swatch" style={{ background: 'var(--danger)' }} /> Server only
						</span>
						<span className="legend__item">
							<span className="legend__swatch" style={{ background: 'var(--info)' }} /> Client only
						</span>
					</div>

					{hasChanges && (
						<div className="notice notice--info">
							<PackageIcon className="" />
							Unsaved flag changes. Saving creates a full resync revision for every client.
						</div>
					)}
				</div>

				{files.length === 0 ? (
					<div className="empty-state">
						<PackageIcon className="" />
						<p>{searchQuery ? `No files match “${searchQuery}”.` : 'No files have been uploaded yet.'}</p>
					</div>
				) : (
					<div className="files-list">
						{files.map((file) => (
							<div key={file.sha256} className={rowClass(file)}>
								<div className="file-row__info">
									<div className="file-row__name" title={file.fileName}>{file.fileName}</div>
									<div className="file-row__meta">
										<span>{file.fileType}</span>
										<span>{formatSize(file.fileSize)}</span>
										<span className="file-row__path" title={file.relativePath}>{file.relativePath}</span>
									</div>
								</div>
								<div className="file-row__actions">
									<button
										className="btn btn--sm btn--toggle is-danger"
										aria-pressed={file.serverOnly}
										onClick={() => toggleServerOnly(file.sha256)}
									>
										Server only
									</button>
									<button
										className="btn btn--sm btn--toggle is-info"
										aria-pressed={file.clientOnly}
										onClick={() => toggleClientOnly(file.sha256)}
									>
										Client only
									</button>
									<button
										className="btn btn--sm btn--ghost-danger"
										onClick={() => setPendingDelete(file)}
										disabled={loading}
										aria-label={`Delete ${file.fileName}`}
									>
										<TrashIcon />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<ConfirmModal
				isOpen={pendingDelete !== null}
				title="Delete this file?"
				message={`“${pendingDelete?.fileName ?? ''}” will be removed from disk and marked for deletion on every client.`}
				confirmLabel="Delete file"
				onConfirm={confirmDelete}
				onCancel={() => setPendingDelete(null)}
			/>
		</div>
	);
}
