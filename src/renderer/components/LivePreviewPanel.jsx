import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LivePreviewPanel.css';

/**
 * LivePreviewPanel — Modal overlay showing real-time screenshots
 * from a headless browser profile via WebSocket streaming.
 *
 * Props:
 *   profile   — { id, name } of the profile to view
 *   apiPort   — REST/WS server port (default 4000)
 *   onClose   — callback when the modal is closed
 */
export default function LivePreviewPanel({ profile, apiPort = 4000, onClose }) {
  const imgRef = useRef(null);
  const wsRef = useRef(null);
  const [connState, setConnState] = useState('CONNECTING'); // CONNECTING | LIVE | STOPPED | ERROR
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(null);
  const frameCountRef = useRef(0);

  const profileId = profile?.id;
  const profileName = profile?.name || 'Profile';

  // Ensure screencast is running for this profile
  useEffect(() => {
    if (!profileId) return;
    window.electronAPI?.startPreview?.(profileId).catch(() => {});
  }, [profileId]);

  // WebSocket connection lifecycle
  useEffect(() => {
    if (!profileId) return;

    setConnState('CONNECTING');
    frameCountRef.current = 0;
    setFrameCount(0);

    const wsUrl = `ws://127.0.0.1:${apiPort}/preview`;
    let ws;
    let reconnectTimer;
    let closed = false;

    function connect() {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setConnState('ERROR');
        return;
      }

      ws.onopen = () => {
        // Subscribe to this profile's stream
        ws.send(JSON.stringify({ action: 'subscribe', profileId }));
        setConnState('LIVE');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.frame && imgRef.current) {
            imgRef.current.src = `data:image/jpeg;base64,${data.frame}`;
            frameCountRef.current += 1;
            setFrameCount(frameCountRef.current);
            setLastFrameTime(Date.now());
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        if (!closed) {
          setConnState('STOPPED');
          // Try to reconnect after 2 seconds
          reconnectTimer = setTimeout(() => {
            if (!closed) {
              setConnState('CONNECTING');
              connect();
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        setConnState('ERROR');
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [profileId, apiPort]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Overlay click (outside modal) closes
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.();
  }, [onClose]);

  // Connection state badge
  const renderStateBadge = () => {
    switch (connState) {
      case 'CONNECTING':
        return <span className="lp-badge-connecting">⟳ Connecting</span>;
      case 'LIVE':
        return (
          <span className="lp-badge-live">
            <span className="lp-live-dot" />
            LIVE
          </span>
        );
      case 'STOPPED':
        return <span className="lp-badge-stopped">■ Disconnected</span>;
      case 'ERROR':
        return <span className="lp-badge-error">✕ Error</span>;
      default:
        return null;
    }
  };

  // Time since last frame
  const timeSinceFrame = lastFrameTime
    ? `${((Date.now() - lastFrameTime) / 1000).toFixed(1)}s ago`
    : '—';

  return (
    <div className="lp-overlay" onClick={handleOverlayClick}>
      <div className="lp-modal">
        {/* Header */}
        <div className="lp-header">
          <div className="lp-header-left">
            <span className="lp-badge-headless">👁 HEADLESS</span>
            <span className="lp-profile-name">{profileName}</span>
            <span className="lp-profile-id">{(profileId || '').substring(0, 8)}</span>
            {renderStateBadge()}
          </div>
          <button className="lp-close-btn" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Viewport */}
        <div className="lp-viewport">
          {connState === 'CONNECTING' && frameCount === 0 && (
            <div className="lp-empty-state">
              <div className="lp-spinner" />
              <div className="lp-empty-text">Connecting to headless browser...</div>
            </div>
          )}

          {connState === 'ERROR' && frameCount === 0 && (
            <div className="lp-empty-state">
              <div className="lp-empty-icon">⚠</div>
              <div className="lp-empty-text">
                Could not connect to preview stream.<br />
                Make sure the profile is running in headless mode.
              </div>
            </div>
          )}

          {connState === 'STOPPED' && frameCount === 0 && (
            <div className="lp-empty-state">
              <div className="lp-empty-icon">📺</div>
              <div className="lp-empty-text">
                Stream ended. The headless browser may have stopped.
              </div>
            </div>
          )}

          {/* The img tag — always present for frame updates */}
          <img
            ref={imgRef}
            alt="Live headless browser preview"
            style={{
              display: frameCount > 0 ? 'block' : 'none',
            }}
          />
        </div>

        {/* Footer */}
        <div className="lp-footer">
          <div className="lp-footer-left">
            <span className="lp-frame-info">Frames: {frameCount}</span>
            {frameCount > 0 && (
              <span className="lp-frame-info">Last update: {timeSinceFrame}</span>
            )}
          </div>
          <span className="lp-footer-hint">View only — ESC to close</span>
        </div>
      </div>
    </div>
  );
}
