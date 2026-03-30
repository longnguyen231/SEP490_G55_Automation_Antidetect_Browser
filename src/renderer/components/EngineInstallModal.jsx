import React, { useState, useEffect } from 'react';
import './EngineInstallModal.css';

/**
 * EngineInstallModal
 * Props:
 *   engine      – 'chromium' | 'firefox'
 *   onInstall   – () => void  (user clicked Install)
 *   onSkip      – () => void  (user clicked Skip)
 */
export default function EngineInstallModal({ engine = 'chromium', onInstall, onSkip }) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null); // { percent, status }
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const isFirefox = engine === 'firefox';
  const engineLabel = isFirefox ? 'Playwright Firefox' : 'Playwright Chromium';
  const engineIcon = isFirefox ? '🦊' : '🌐';
  const downloadNote = isFirefox
    ? 'Firefox will be downloaded automatically.'
    : 'Chromium will be downloaded automatically.';

  // Subscribe to install progress events
  useEffect(() => {
    if (!installing) return;
    let unsub;
    try {
      unsub = window.electronAPI?.onBrowserInstallProgress?.((data) => {
        if (data?.browser !== engine) return;
        if (data.status === 'done') {
          setProgress({ percent: 100, status: 'Installed!' });
          setDone(true);
          setInstalling(false);
          setTimeout(() => onInstall?.(), 800);
        } else if (data.status === 'error') {
          setError(data.message || 'Installation failed.');
          setInstalling(false);
        } else {
          setProgress({ percent: data.percent ?? null, status: data.message || 'Installing…' });
        }
      });
    } catch { /* ignore */ }
    return () => { try { unsub?.(); } catch { } };
  }, [installing, engine, onInstall]);

  const handleInstall = async () => {
    setError(null);
    setInstalling(true);
    setProgress({ percent: 0, status: 'Starting…' });
    try {
      const res = await window.electronAPI?.installBrowser?.(engine);
      // If the IPC call returns synchronously (no progress events), handle it here
      if (res?.success) {
        setProgress({ percent: 100, status: 'Installed!' });
        setDone(true);
        setInstalling(false);
        setTimeout(() => onInstall?.(), 800);
      } else if (res && !res.success) {
        setError(res.error || 'Installation failed.');
        setInstalling(false);
      }
      // Otherwise progress events will drive the UI
    } catch (e) {
      setError(e?.message || String(e));
      setInstalling(false);
    }
  };

  return (
    <div className="eim-backdrop">
      <div className="eim-card">
        {/* Header */}
        <div className="eim-header">
          <span className="eim-icon">{engineIcon}</span>
          <h2 className="eim-title">{engineLabel} Not Installed</h2>
        </div>

        {/* Body */}
        {!installing && !done && !error && (
          <>
            <p className="eim-desc">
              <strong>{engineLabel}</strong> is required to run this profile. Would you like to
              install it now?
            </p>
            <p className="eim-note">{downloadNote}</p>
          </>
        )}

        {/* Progress */}
        {installing && (
          <div className="eim-progress-wrap">
            <p className="eim-progress-status">{progress?.status || 'Installing…'}</p>
            <div className="eim-progress-bar-bg">
              <div
                className="eim-progress-bar-fill"
                style={{ width: progress?.percent != null ? `${progress.percent}%` : '100%' }}
              />
            </div>
          </div>
        )}

        {/* Done */}
        {done && (
          <p className="eim-success">✅ {engineLabel} installed successfully!</p>
        )}

        {/* Error */}
        {error && (
          <div className="eim-error">
            <p>❌ {error}</p>
            <button className="eim-btn-retry" onClick={handleInstall}>Retry</button>
          </div>
        )}

        {/* Actions */}
        {!installing && !done && !error && (
          <div className="eim-actions">
            <button className="eim-btn-skip" onClick={onSkip}>
              Skip
            </button>
            <button className="eim-btn-install" onClick={handleInstall}>
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
