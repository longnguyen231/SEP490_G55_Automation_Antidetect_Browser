import React, { useEffect, useState } from 'react';
import { X, Copy, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/index';
import './LogViewer.css';

function LogViewer({ profile, onClose }) {
  const { t } = useI18n();
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
    try { await navigator.clipboard.writeText(log || ''); } catch { }
  };

  return (
    <div className="log-modal-backdrop">
      <div className="log-modal">
        <div className="log-modal-header">
          <h3>{t('logs.title')} {profile.name}</h3>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button className="btn" onClick={copy} title={t('logs.copy')}>
              <Copy size={14} /> {t('logs.copy')}
            </button>
            <button className="btn" onClick={load} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className="btn btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ padding: '0.5rem 1.25rem' }}>{error}</div>}
        <div className="log-modal-body">
          {log ? (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: "'Consolas','Monaco',monospace", fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--fg)' }}>{log}</pre>
          ) : (
            <div className="log-empty">{t('logs.empty')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LogViewer;
