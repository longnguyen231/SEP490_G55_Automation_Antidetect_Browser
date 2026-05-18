/**
 * FingerprintInspector.jsx
 *
 * Modal hiển thị fingerprint THỰC TẾ đọc từ browser đang chạy.
 * Dùng để verify rằng fingerprintInit.js đã inject đúng.
 *
 * Cách dùng:
 *   <FingerprintInspector profileId={profile.id} profileName={profile.name}
 *     configuredFp={profile.fingerprint} onClose={() => setInspecting(null)} />
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: '10px', border: '1px solid var(--border2)', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '8px 12px',
          background: 'var(--glass)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
          color: 'var(--fg)', fontSize: '0.78rem', fontWeight: 700,
        }}
      >
        <span style={{ fontSize: '0.95rem' }}>{icon}</span>
        {title}
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '8px 12px 10px', background: 'var(--card)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, configValue, match }) {
  const isEmpty = value === null || value === undefined || value === '';
  const showMatch = configValue !== undefined && configValue !== null && configValue !== '';
  const isMatch = showMatch ? match : null;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr auto',
      alignItems: 'start', gap: '6px', padding: '3px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontSize: '0.72rem',
    }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: isEmpty ? 'var(--muted)' : 'var(--fg)',
        fontFamily: 'monospace', fontSize: '0.7rem',
        wordBreak: 'break-all', lineHeight: '1.4',
        fontStyle: isEmpty ? 'italic' : 'normal',
      }}>
        {isEmpty ? 'null' : (Array.isArray(value) ? value.join(', ') || '(empty)' : String(value))}
      </span>
      {showMatch && (
        <span style={{ fontSize: '0.75rem', flexShrink: 0, marginTop: '1px' }}>
          {isMatch ? '✅' : '⚠️'}
        </span>
      )}
    </div>
  );
}


export default function FingerprintInspector({ profileId, profileName, configuredFp = {}, onClose }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [fp, setFp] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const res = await window.electronAPI.inspectFingerprint(profileId);
      if (res?.success) {
        setFp(res.fingerprint);
        setState('done');
      } else {
        setError(res?.error || 'Unknown error');
        setState('error');
      }
    } catch (e) {
      setError(e?.message || String(e));
      setState('error');
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Match helpers — so sánh giá trị thực tế vs configured ─────────────────
  const matchUA = fp?.identity?.userAgent && configuredFp?.userAgent ? fp.identity.userAgent.includes(configuredFp.userAgent.split(' ')[0]) : undefined;
  const matchLang = fp?.identity?.language && configuredFp?.language ? fp.identity.language === configuredFp.language : undefined;
  const matchTZ = fp?.timezone && configuredFp?.timezone ? fp.timezone === configuredFp.timezone : undefined;
  const matchW = fp?.screen?.width && configuredFp?.screenResolution ? fp.screen.width === Number((configuredFp.screenResolution || '').split('x')[0]) : undefined;
  const matchH = fp?.screen?.height && configuredFp?.screenResolution ? fp.screen.height === Number((configuredFp.screenResolution || '').split('x')[1]) : undefined;
  const matchCores = fp?.identity?.hardwareConcurrency && configuredFp?.hardwareConcurrency ? fp.identity.hardwareConcurrency === Number(configuredFp.hardwareConcurrency) : undefined;
  const matchMem = fp?.identity?.deviceMemory && configuredFp?.deviceMemory ? fp.identity.deviceMemory === Number(configuredFp.deviceMemory) : undefined;

  return (
    <div
      id="fp-inspector-backdrop"
      onClick={(e) => { if (e.target.id === 'fp-inspector-backdrop') onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', width: '700px', maxWidth: '96vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔍 Fingerprint Inspector
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
              Profile: <strong style={{ color: 'var(--fg)' }}>{profileName || profileId}</strong>
              {fp?.capturedAt && (
                <span style={{ marginLeft: '10px' }}>
                  · Captured {new Date(fp.capturedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              id="btn-fp-inspector-refresh"
              onClick={load}
              disabled={state === 'loading'}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '0.72rem',
                border: '1px solid var(--border2)', background: 'var(--glass)',
                color: 'var(--fg)', cursor: state === 'loading' ? 'wait' : 'pointer',
                opacity: state === 'loading' ? 0.6 : 1,
              }}
            >
              {state === 'loading' ? '⏳ Reading...' : '↻ Refresh'}
            </button>
            <button
              id="btn-fp-inspector-close"
              onClick={onClose}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '0.72rem',
                border: '1px solid var(--border2)', background: 'var(--glass)',
                color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Legend */}
        {state === 'done' && (
          <div style={{
            padding: '6px 18px', background: 'var(--card2)', borderBottom: '1px solid var(--border)',
            display: 'flex', gap: '16px', fontSize: '0.67rem', color: 'var(--muted)', flexShrink: 0,
          }}>
            <span>✅ Matches configured value</span>
            <span>⚠️ Mismatch with configured value</span>
            <span style={{ marginLeft: 'auto' }}>Values read directly from browser via page.evaluate()</span>
          </div>
        )}

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px' }}>

          {state === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ fontSize: '0.82rem' }}>Reading fingerprint from browser...</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Connecting to live browser context</div>
            </div>
          )}

          {state === 'error' && (
            <div style={{
              padding: '20px', borderRadius: '8px', textAlign: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>❌</div>
              <div style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 600, marginBottom: '6px' }}>Failed to read fingerprint</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{error}</div>
              {error.includes('not running') && (
                <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#f59e0b' }}>
                  ⚠️ Please launch the profile first, then click Refresh.
                </div>
              )}
            </div>
          )}

          {state === 'done' && fp && (
            <>
              {/* Identity */}
              <Section title="Identity" icon="🪪">
                <Row label="User Agent" value={fp.identity?.userAgent} configValue={configuredFp?.userAgent} match={matchUA} />
                <Row label="Platform" value={fp.identity?.platform} configValue={configuredFp?.platform} />
                <Row label="Language" value={fp.identity?.language} configValue={configuredFp?.language} match={matchLang} />
                <Row label="Languages" value={fp.identity?.languages} />
                <Row label="Vendor" value={fp.identity?.vendor} />
                <Row label="Webdriver detected" value={String(fp.identity?.webdriver)} configValue="false" match={fp.identity?.webdriver === false || fp.identity?.webdriver === null} />
                <Row label="Plugins count" value={fp.identity?.plugins?.length} />
              </Section>

              {/* Hardware */}
              <Section title="Hardware" icon="🖥️">
                <Row label="CPU Cores" value={fp.identity?.hardwareConcurrency} configValue={configuredFp?.hardwareConcurrency} match={matchCores} />
                <Row label="Device Memory (GB)" value={fp.identity?.deviceMemory} configValue={configuredFp?.deviceMemory} match={matchMem} />
                <Row label="Timezone" value={fp.timezone} configValue={configuredFp?.timezone} match={matchTZ} />
                <Row label="Locale" value={fp.locale} />
              </Section>

              {/* Screen */}
              <Section title="Screen" icon="🖥">
                <Row label="Resolution" value={fp.screen ? `${fp.screen.width}×${fp.screen.height}` : null} configValue={configuredFp?.screenResolution} match={matchW && matchH} />
                <Row label="Avail size" value={fp.screen ? `${fp.screen.availWidth}×${fp.screen.availHeight}` : null} />
                <Row label="Color depth" value={fp.screen?.colorDepth} configValue={configuredFp?.colorDepth} />
                <Row label="Pixel depth" value={fp.screen?.pixelDepth} />
                <Row label="Device pixel ratio" value={fp.screen?.devicePixelRatio} configValue={configuredFp?.pixelRatio} />
                <Row label="Inner size" value={fp.screen ? `${fp.screen.innerWidth}×${fp.screen.innerHeight}` : null} />
              </Section>

              {/* Canvas */}
              <Section title="Canvas Fingerprint" icon="🎨">
                <Row label="Canvas hash" value={fp.canvas?.hash} />
                <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '6px', padding: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                  💡 Hash thay đổi mỗi lần reload = injection đang hoạt động. Hash giống nhau = không có noise.
                </div>
              </Section>

              {/* WebGL */}
              <Section title="WebGL" icon="🔷">
                <Row label="Renderer" value={fp.webgl?.renderer} configValue={configuredFp?.webglRenderer} />
                <Row label="Vendor" value={fp.webgl?.vendor} configValue={configuredFp?.webglVendor} />
                <Row label="GL Version" value={fp.webgl?.version} />
                <Row label="GLSL Version" value={fp.webgl?.shadingVersion} />
                <Row label="Extensions (first 10)" value={fp.webgl?.extensions} />
              </Section>

              {/* Audio */}
              <Section title="Audio" icon="🔊">
                <Row label="Sample Rate" value={fp.audio?.sampleRate} configValue={configuredFp?.audioSampleRate} />
                <Row label="Max Channels" value={fp.audio?.maxChannelCount} configValue={configuredFp?.audioChannels} />
                <Row label="Context state" value={fp.audio?.state} />
              </Section>

              {/* Battery */}
              <Section title="Battery" icon="🔋">
                {fp.battery ? (
                  <>
                    <Row label="Charging" value={String(fp.battery.charging)} configValue={configuredFp?.batteryCharging} match={String(fp.battery.charging) === (configuredFp?.batteryCharging === 'Yes' ? 'true' : 'false')} />
                    <Row label="Level" value={`${Math.round((fp.battery.level || 0) * 100)}%`} configValue={configuredFp?.batteryLevel ? `${Math.round(configuredFp.batteryLevel * 100)}%` : null} />
                    <Row label="Charging time" value={fp.battery.chargingTime === Infinity ? '∞' : fp.battery.chargingTime} />
                    <Row label="Discharging time" value={fp.battery.dischargingTime === Infinity ? '∞' : fp.battery.dischargingTime} />
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>Battery API not available in this browser</div>
                )}
              </Section>

              {/* Network */}
              <Section title="Network" icon="🌐">
                {fp.network ? (
                  <>
                    <Row label="Effective type" value={fp.network.effectiveType} configValue={configuredFp?.connectionType} />
                    <Row label="Downlink (Mbps)" value={fp.network.downlink} />
                    <Row label="RTT (ms)" value={fp.network.rtt} />
                    <Row label="Save data" value={String(fp.network.saveData)} />
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>Network Information API not available</div>
                )}
              </Section>

              {/* Fonts */}
              <Section title="Detected Fonts (sample)" icon="🔤">
                <div style={{ fontSize: '0.7rem', color: 'var(--fg)', fontFamily: 'monospace', lineHeight: 1.8 }}>
                  {fp.fonts?.length ? fp.fonts.join(', ') : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>None detected</span>}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
