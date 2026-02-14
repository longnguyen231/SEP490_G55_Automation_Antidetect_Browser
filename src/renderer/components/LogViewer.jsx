import React, { useEffect, useState } from 'react';
import './LogViewer.css';

function LogViewer({ profile, onClose }) {
  const [log, setLog] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await window.electronAPI.getProfileLog(profile.id);
      if (!res.success) throw new Error(res.error || 'Failed to load log');
      setLog(res.log || '');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.id]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(log || ''); alert('Copied log'); } catch {}
  };

  return (
    <div className="log-modal-backdrop">
      <div className="log-modal card">
        <div className="log-modal-header">
          <h3>Logs: {profile.name}</h3>
          <div className="header-actions">
            <button className="btn" onClick={copy}>Copy</button>
            <button className="btn" onClick={load}>Refresh</button>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <pre className="log-content">{log || 'No logs yet'}</pre>
      </div>
    </div>
  );
}

export default LogViewer;
