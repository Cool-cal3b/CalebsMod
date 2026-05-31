import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GetAllFiles, UpdateFileFlags, CreateFullResync, DeleteFile } from '../wailsjs/go/main/Admin';
import { go_services } from '../wailsjs/go/models';
import './App.css';

export default function AllMods() {
    const [files, setFiles] = useState<go_services.PackFileDto[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, [searchQuery]);

    const fetchFiles = async () => {
        try {
            const result = await GetAllFiles(searchQuery);
            setFiles(result);
        } catch (err) {
            setMessage('Failed to load files: ' + (err as Error).message);
        }
    };

    const toggleServerOnly = (sha256: string) => {
        setFiles(files.map(f => 
            f.sha256 === sha256 
                ? { ...f, serverOnly: !f.serverOnly, clientOnly: f.serverOnly ? f.clientOnly : false }
                : f
        ));
        setHasChanges(true);
    };

    const toggleClientOnly = (sha256: string) => {
        setFiles(files.map(f => 
            f.sha256 === sha256 
                ? { ...f, clientOnly: !f.clientOnly, serverOnly: f.clientOnly ? f.serverOnly : false }
                : f
        ));
        setHasChanges(true);
    };

    const saveChanges = async () => {
        setLoading(true);
        setMessage('');

        try {
            for (const file of files) {
                await UpdateFileFlags(file.sha256, file.serverOnly, file.clientOnly);
            }

            await CreateFullResync();

            setMessage('Changes saved! Full resync revision created.');
            setHasChanges(false);
            await fetchFiles();
        } catch (err) {
            setMessage('Failed to save changes: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const getFileTypeColor = (serverOnly: boolean, clientOnly: boolean) => {
        if (serverOnly) return 'server-only';
        if (clientOnly) return 'client-only';
        return 'both';
    };

    const handleDeleteFile = async (sha256: string, fileName: string) => {
        if (!confirm(`Delete "${fileName}"? This removes it from disk and marks it for deletion on all clients.`)) return;
        setLoading(true);
        setMessage('');
        try {
            await DeleteFile(sha256);
            setMessage(`Deleted ${fileName}. Clients will remove it on next sync.`);
            await fetchFiles();
        } catch (err) {
            setMessage('Failed to delete: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const copyServerMods = async () => {
        const list = files.filter(f => !f.clientOnly).map(f => f.fileName).join('\n');
        await navigator.clipboard.writeText(list);
        setMessage(`Copied ${files.filter(f => !f.clientOnly).length} server mods to clipboard`);
        setTimeout(() => setMessage(''), 2000);
    };

    const copyClientMods = async () => {
        const list = files.filter(f => !f.serverOnly).map(f => f.fileName).join('\n');
        await navigator.clipboard.writeText(list);
        setMessage(`Copied ${files.filter(f => !f.serverOnly).length} client mods to clipboard`);
        setTimeout(() => setMessage(''), 2000);
    };

	return (
		<div id="Admin">
			<h1>All Files</h1>
            
            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <input 
                    type="text" 
                    className="mc-input"
                    placeholder="Search files..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    style={{ width: '100%', marginBottom: '10px' }}
                />
                
                {message && (
                    <div className={message.includes('Failed') ? 'error-message' : 'success-message'}>
                        {message}
                    </div>
                )}

                {hasChanges && (
                    <button 
                        className="mc-button green large" 
                        onClick={saveChanges}
                        disabled={loading}
                        style={{ marginBottom: '20px' }}
                    >
                        {loading ? 'Saving & Creating Resync...' : 'Save Changes & Create Full Resync'}
                    </button>
                )}

                <div style={{ fontSize: '12px', marginBottom: '10px', color: '#888' }}>
                    <strong>Legend:</strong> 
                    <span style={{ color: '#ff6b6b', marginLeft: '10px' }}>🔴 Server Only</span>
                    <span style={{ color: '#4dabf7', marginLeft: '10px' }}>🔵 Client Only</span>
                    <span style={{ color: '#51cf66', marginLeft: '10px' }}>🟢 Both</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <button className="mc-button small" onClick={copyServerMods}>
                        Copy Server Mods
                    </button>
                    <button className="mc-button small" onClick={copyClientMods}>
                        Copy Client Mods
                    </button>
                </div>
            </div>

            <div className="files-list">
                {files.length === 0 ? (
                    <div className="glass-card">No files found</div>
                ) : (
                    files.map((file) => (
                        <div key={file.sha256} className={`file-item glass-card ${getFileTypeColor(file.serverOnly, file.clientOnly)}`}>
                            <div className="file-info">
                                <div className="file-name">{file.fileName}</div>
                                <div className="file-details">
                                    <span>{file.fileType}</span>
                                    <span>{(file.fileSize / 1024).toFixed(2)} KB</span>
                                    <span>{file.relativePath}</span>
                                </div>
                            </div>
                            <div className="file-controls">
                                <button 
                                    className={`mc-button small ${file.serverOnly ? 'red' : ''}`}
                                    onClick={() => toggleServerOnly(file.sha256)}
                                >
                                    Server Only: {file.serverOnly ? '✓' : '✗'}
                                </button>
                                <button 
                                    className={`mc-button small ${file.clientOnly ? 'blue' : ''}`}
                                    onClick={() => toggleClientOnly(file.sha256)}
                                >
                                    Client Only: {file.clientOnly ? '✓' : '✗'}
                                </button>
                                <button 
                                    className="mc-button small red"
                                    onClick={() => handleDeleteFile(file.sha256, file.fileName)}
                                    disabled={loading}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Link to="/admin" className="mc-button back-button">Back to Admin</Link>
		</div>
	);
}