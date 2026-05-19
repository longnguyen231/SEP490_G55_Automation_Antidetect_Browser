
import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState('');
  const timerRef = useRef(null);

  // Clear pending timer on unmount to avoid setState on unmounted component
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = useCallback((text, key) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      timerRef.current = setTimeout(() => setCopied(''), 1500);
    }).catch(() => {
      // Fallback for sandboxed contexts that deny clipboard access
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(key);
        timerRef.current = setTimeout(() => setCopied(''), 1500);
      } catch { /* nothing we can do */ }
    });
  }, []);
  return { copied, copy };
}

// ── Selector row with copy button ─────────────────────────────────────────────
function SelectorRow({ label, value, copyKey, copied, onCopy, onActivate }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px',
      }}>
        {label}
      </div>
      <div style={{
        display: 'flex', gap: '6px', alignItems: 'flex-start',
      }}>
        <div
          onClick={() => onActivate && onActivate(value)}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: '6px',
            background: 'var(--glass)', border: '1px solid var(--border)',
            fontFamily: 'monospace', fontSize: '0.69rem',
            color: '#4ade80', wordBreak: 'break-all', lineHeight: 1.6,
            cursor: onActivate ? 'pointer' : 'default',
          }}
          title={onActivate ? 'Click to set as active selector' : undefined}
        >
          {value}
        </div>
        <button
          onClick={() => onCopy(value, copyKey)}
          style={{
            flexShrink: 0, padding: '5px 10px', fontSize: '0.68rem', fontWeight: 600,
            borderRadius: '6px', border: '1px solid var(--border)',
            background: copied === copyKey ? 'rgba(16,185,129,0.2)' : 'var(--glass)',
            color: copied === copyKey ? '#10b981' : 'var(--fg)',
            cursor: 'pointer', transition: 'all 120ms', whiteSpace: 'nowrap',
          }}
        >
          {copied === copyKey ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── Element info row with optional copy ───────────────────────────────────────
function InfoRow({ label, value, copyKey, copied, onCopy, mono = true }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, padding: '6px 10px', borderRadius: '6px',
          background: 'var(--glass)', border: '1px solid var(--border)',
          fontFamily: mono ? 'monospace' : 'inherit', fontSize: '0.69rem',
          color: '#4ade80', wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {String(value)}
        </div>
        {copyKey && (
          <button
            onClick={() => onCopy(String(value), copyKey)}
            style={{
              flexShrink: 0, padding: '5px 10px', fontSize: '0.68rem', fontWeight: 600,
              borderRadius: '6px', border: '1px solid var(--border)',
              background: copied === copyKey ? 'rgba(16,185,129,0.2)' : 'var(--glass)',
              color: copied === copyKey ? '#10b981' : 'var(--fg)',
              cursor: 'pointer', transition: 'all 120ms', whiteSpace: 'nowrap',
            }}
          >
            {copied === copyKey ? '✓' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, children, title, bgColor, textColor, borderColor, style: ex = {} }) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        flex: 1, padding: '7px 10px', fontSize: '0.72rem', fontWeight: 600,
        borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'filter 120ms, transform 80ms',
        background: bgColor || 'var(--glass)',
        color: textColor || 'var(--fg)',
        border: `1px solid ${borderColor || 'var(--border)'}`,
        ...ex,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = ''; }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ElementPicker({ profileId, profileName, onClose }) {
  const [inputUrl, setInputUrl] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [pickedData, setPickedData] = useState(null);   // latest Ctrl+hover result
  const [activeSelector, setActiveSelector] = useState('');
  const [pickedPoint, setPickedPoint] = useState(null); // {x, y}
  const [fillValue, setFillValue] = useState('');
  const [pressKey, setPressKey] = useState('Enter');
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(true);
  const { copied, copy } = useCopy();

  const statusTimerRef = useRef(null);
  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); }, []);
  const showStatus = useCallback((msg, ok = true) => {
    setStatus(msg);
    setStatusOk(ok);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatus(''), 3000);
  }, []);

  // Fetch current browser URL and auto-start picking on mount
  useEffect(() => {
    window.electronAPI.elementPickerGetUrl(profileId)
      .then(res => { if (res?.success && res.url) setInputUrl(res.url); })
      .catch(() => {});
    // Auto-start picking immediately so user doesn't need to click Re-activate manually
    window.electronAPI.elementPickerStartPicking(profileId)
      .then(res => { if (res?.success) setIsPicking(true); })
      .catch(() => {});
  }, [profileId]);

  // Subscribe to Ctrl+hover selector events pushed from the browser page
  useEffect(() => {
    const unsub = window.electronAPI.onSelectorPicked((data) => {
      setPickedData(data);
      setActiveSelector(data.cssSelector || data.selector || '');
      if (data.position) setPickedPoint(data.position);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Stop picking on unmount
  useEffect(() => {
    return () => { window.electronAPI.elementPickerStopPicking(profileId).catch(() => {}); };
  }, [profileId]);

  // Escape key closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Shared: re-inject picking listener + refresh URL after any navigation
  const afterNavRefresh = async () => {
    const [pickRes, urlRes] = await Promise.all([
      window.electronAPI.elementPickerStartPicking(profileId).catch(() => null),
      window.electronAPI.elementPickerGetUrl(profileId).catch(() => null),
    ]);
    if (pickRes?.success) setIsPicking(true);
    if (urlRes?.success && urlRes.url) setInputUrl(urlRes.url);
  };

  const navigate = async () => {
    if (!inputUrl.trim()) return;
    const res = await window.electronAPI.elementPickerNavigate(profileId, inputUrl.trim());
    if (res?.success) {
      showStatus('Navigated');
      // afterNavRefresh also fetches the final URL (handles redirects correctly)
      await afterNavRefresh();
    } else showStatus(res?.error || 'Navigation failed', false);
  };

  // Nav toolbar buttons: back / forward / reload — each re-injects listener + syncs URL
  const handleNavAction = async (action) => {
    await window.electronAPI.elementPickerAction(profileId, action).catch(() => {});
    // Give the browser a moment to finish navigation before re-injecting
    await new Promise(r => setTimeout(r, 600));
    await afterNavRefresh();
  };

  // "Re-activate" always re-injects the picker script — never stops it.
  // Stopping only happens automatically on component unmount.
  const reactivatePicking = async () => {
    const res = await window.electronAPI.elementPickerStartPicking(profileId);
    if (res?.success) {
      setIsPicking(true);
      showStatus('Picking active — hover an element in the browser then press Ctrl');
    } else {
      setIsPicking(false);
      showStatus(res?.error || 'Failed to activate picking', false);
    }
  };

  const doAction = async (action) => {
    if (!activeSelector.trim() &&
        action !== 'click-point' && action !== 'scroll-up' &&
        action !== 'scroll-down' && action !== 'press-key') {
      showStatus('Please enter or pick a CSS selector first', false);
      return;
    }
    let res;
    switch (action) {
      case 'click-element':  res = await window.electronAPI.elementPickerAction(profileId, 'click-element', activeSelector); break;
      case 'hover-element':  res = await window.electronAPI.elementPickerAction(profileId, 'hover-element', activeSelector); break;
      case 'double-click':   res = await window.electronAPI.elementPickerAction(profileId, 'double-click', activeSelector); break;
      case 'click-point':
        if (!pickedPoint) { showStatus('No point selected', false); return; }
        res = await window.electronAPI.elementPickerAction(profileId, 'click-point', pickedPoint.x, pickedPoint.y);
        break;
      case 'fill':           res = await window.electronAPI.elementPickerAction(profileId, 'fill', activeSelector, fillValue); break;
      case 'press-key':      res = await window.electronAPI.elementPickerAction(profileId, 'press-key', pressKey); break;
      case 'scroll-up':      res = await window.electronAPI.elementPickerAction(profileId, 'scroll', 'up'); break;
      case 'scroll-down':    res = await window.electronAPI.elementPickerAction(profileId, 'scroll', 'down'); break;
      default: return;
    }
    if (res?.success) showStatus(`${action} executed`);
    else showStatus(res?.error || `${action} failed`, false);
  };

  // Derived: playwright locator from CSS selector
  const playwrightLocator = pickedData?.cssSelector
    ? `page.locator("${(pickedData.cssSelector).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
    : null;

  return (
    <div
      id="element-picker-backdrop"
      onClick={(e) => { if (e.target.id === 'element-picker-backdrop') onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border2)',
        borderRadius: '12px',
        width: '1060px', maxWidth: '98vw',
        height: '86vh', maxHeight: '740px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--glass)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--fg)' }}>Element Picker</span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
              borderRadius: '999px', background: 'rgba(16,185,129,0.15)',
              color: '#10b981', border: '1px solid rgba(16,185,129,0.4)',
            }}>Active</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profileName || profileId} — Anti-Detect Browser
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <Btn onClick={() => window.electronAPI.elementPickerBringToFront(profileId)}>Bring to Front</Btn>
            <Btn
              onClick={reactivatePicking}
              bgColor={isPicking ? 'rgba(0,210,211,0.15)' : 'rgba(245,158,11,0.12)'}
              textColor={isPicking ? '#00d2d3' : '#f59e0b'}
              borderColor={isPicking ? 'rgba(0,210,211,0.5)' : 'rgba(245,158,11,0.4)'}
              title="Re-inject Ctrl+hover listener into the browser page"
            >
              {isPicking ? 'Re-activate' : '⚡ Activate'}
            </Btn>
            <Btn onClick={onClose}>Close</Btn>
          </div>
        </div>

        {/* ── URL Toolbar ── */}
        <div style={{
          padding: '6px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--card2)',
          display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
        }}>
          <button onClick={() => handleNavAction('nav-back')}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--fg)', fontWeight: 600 }} title="Back">−</button>
          <button onClick={() => handleNavAction('nav-forward')}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--fg)', fontWeight: 600 }} title="Forward">→</button>
          <button onClick={() => handleNavAction('nav-reload')}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--fg)' }} title="Reload">↻</button>

          <input
            type="text" value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') navigate(); }}
            placeholder="https://..."
            style={{
              flex: 1, padding: '5px 10px', fontSize: '0.75rem',
              borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--input)', color: 'var(--fg)', fontFamily: 'monospace',
            }}
          />

          <button onClick={navigate} style={{
            padding: '5px 16px', fontSize: '0.75rem', fontWeight: 700,
            borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: 'var(--primary)', color: '#fff',
          }}>Go</button>

          <span style={{
            fontSize: '0.67rem', color: isPicking ? '#00d2d3' : '#f59e0b',
            padding: '4px 8px', background: 'var(--glass)', borderRadius: '5px',
            border: `1px solid ${isPicking ? 'rgba(0,210,211,0.4)' : 'rgba(245,158,11,0.35)'}`,
            whiteSpace: 'nowrap', fontWeight: 600,
          }}>
            {isPicking ? '🟢 Hover → Ctrl to pick' : '⚠ Picking inactive — click Activate'}
          </span>
        </div>

        {/* ── Status bar ── */}
        {status && (
          <div style={{
            padding: '4px 14px', fontSize: '0.7rem', flexShrink: 0,
            background: statusOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: statusOk ? '#10b981' : '#ef4444',
            borderBottom: '1px solid var(--border)',
          }}>
            {statusOk ? '✓' : '✕'} {status}
          </div>
        )}

        {/* ── 3-column body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left: LIVE CONTROLS ── */}
          <div style={{
            width: '250px', flexShrink: 0,
            borderRight: '1px solid var(--border)',
            padding: '12px', overflowY: 'auto',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '8px' }}>LIVE CONTROLS</div>
            <p style={{ fontSize: '0.67rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 12px' }}>
              Use the picked selector or clicked coordinates to drive the launched profile.
            </p>

            {/* Active Selector */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                Active Selector
              </div>
              <input
                type="text" value={activeSelector}
                onChange={e => setActiveSelector(e.target.value)}
                placeholder="CSS selector"
                style={{
                  width: '100%', padding: '6px 8px', fontSize: '0.7rem',
                  borderRadius: '6px', border: '1px solid var(--border)',
                  background: 'var(--input)', color: 'var(--fg)',
                  fontFamily: 'monospace', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <Btn onClick={() => doAction('click-element')}
                bgColor="rgba(16,185,129,0.15)" textColor="#10b981" borderColor="rgba(16,185,129,0.4)">
                Click Element
              </Btn>
              <Btn onClick={() => doAction('hover-element')}>Hover Element</Btn>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <Btn onClick={() => doAction('click-point')}
                bgColor="rgba(220,100,20,0.15)" textColor="#e07020" borderColor="rgba(220,100,20,0.4)">
                Click Point
              </Btn>
              <Btn onClick={() => doAction('double-click')}>Double Click</Btn>
            </div>

            <div style={{ fontSize: '0.67rem', color: pickedPoint ? 'var(--primary)' : 'var(--muted)', fontStyle: 'italic', marginBottom: '14px' }}>
              Picked point: {pickedPoint ? `${pickedPoint.x}, ${pickedPoint.y}` : 'No point selected'}
            </div>

            {/* Fill Value */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                Fill Value
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" value={fillValue} onChange={e => setFillValue(e.target.value)}
                  placeholder="Text to fill"
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--fg)' }} />
                <Btn onClick={() => doAction('fill')}
                  bgColor="rgba(99,102,241,0.15)" textColor="#818cf8" borderColor="rgba(99,102,241,0.4)"
                  style={{ flex: 'none', padding: '5px 14px' }}>Fill</Btn>
              </div>
            </div>

            {/* Key Press */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                Key
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="text" value={pressKey} onChange={e => setPressKey(e.target.value)}
                  placeholder="Enter, Tab, Escape..."
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--fg)', fontFamily: 'monospace' }} />
                <Btn onClick={() => doAction('press-key')} style={{ flex: 'none', padding: '5px 14px' }}>Press</Btn>
              </div>
            </div>

            {/* Scroll */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <Btn onClick={() => doAction('scroll-up')}>Scroll Up</Btn>
              <Btn onClick={() => doAction('scroll-down')}>Scroll Down</Btn>
            </div>
          </div>

          {/* ── Middle: SELECTORS ── */}
          <div style={{
            flex: 1, padding: '14px 16px', overflowY: 'auto',
            borderRight: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '14px' }}>SELECTORS</div>

            {!pickedData ? (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.72rem', lineHeight: 1.8 }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.4 }}>🎯</div>
                Hover over an element in the browser and press{' '}
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Ctrl</span>{' '}
                (or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Cmd</span>) to select it.
                <div style={{ marginTop: '10px', opacity: 0.7, fontSize: '0.67rem' }}>
                  Click <strong>Re-activate</strong> to enable picking mode first.
                </div>
              </div>
            ) : (
              <>
                <SelectorRow
                  label="CSS Selector"
                  value={pickedData.cssSelector}
                  copyKey="css"
                  copied={copied} onCopy={copy}
                  onActivate={v => setActiveSelector(v)}
                />
                <SelectorRow
                  label="XPath"
                  value={pickedData.xpath}
                  copyKey="xpath"
                  copied={copied} onCopy={copy}
                  onActivate={v => setActiveSelector(v)}
                />
                {pickedData.textSelector && (
                  <SelectorRow
                    label="Text Selector"
                    value={pickedData.textSelector}
                    copyKey="text"
                    copied={copied} onCopy={copy}
                    onActivate={v => setActiveSelector(v)}
                  />
                )}
                <SelectorRow
                  label="Playwright"
                  value={playwrightLocator}
                  copyKey="pw"
                  copied={copied} onCopy={copy}
                />
              </>
            )}
          </div>

          {/* ── Right: ELEMENT INFO ── */}
          <div style={{
            width: '290px', flexShrink: 0,
            padding: '14px 16px', overflowY: 'auto',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '14px' }}>ELEMENT INFO</div>

            {!pickedData ? (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.72rem', lineHeight: 1.8 }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.4 }}>📋</div>
                Element details will appear here after picking.
              </div>
            ) : (
              <>
                <InfoRow
                  label="Tag"
                  value={`<${pickedData.tagName}>`}
                  copied={copied} onCopy={copy}
                />
                {pickedData.position && (
                  <InfoRow
                    label="Position (X, Y)"
                    value={`${pickedData.position.x}, ${pickedData.position.y}`}
                    copyKey="pos"
                    copied={copied} onCopy={copy}
                  />
                )}
                {pickedData.boundingBox && (
                  <InfoRow
                    label="Bounding Box"
                    value={`${pickedData.boundingBox.x},${pickedData.boundingBox.y}  ${pickedData.boundingBox.width}×${pickedData.boundingBox.height}`}
                    copyKey="bb"
                    copied={copied} onCopy={copy}
                  />
                )}
                {pickedData.classes && (
                  <InfoRow
                    label="Classes"
                    value={pickedData.classes}
                    copyKey="cls"
                    copied={copied} onCopy={copy}
                  />
                )}
                {pickedData.id && (
                  <InfoRow label="ID" value={pickedData.id} copyKey="id" copied={copied} onCopy={copy} />
                )}
                {pickedData.href && (
                  <InfoRow label="Href" value={pickedData.href} copyKey="href" copied={copied} onCopy={copy} />
                )}
                {pickedData.src && (
                  <InfoRow label="Src" value={pickedData.src} copyKey="src" copied={copied} onCopy={copy} />
                )}
                {pickedData.type && (
                  <InfoRow label="Type" value={pickedData.type} />
                )}
                {pickedData.name && (
                  <InfoRow label="Name" value={pickedData.name} />
                )}
                {pickedData.placeholder && (
                  <InfoRow label="Placeholder" value={pickedData.placeholder} />
                )}
                {pickedData.value != null && pickedData.value !== '' && (
                  <InfoRow label="Value" value={pickedData.value} />
                )}
                {pickedData.text && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                      Text
                    </div>
                    <div style={{
                      padding: '7px 10px', borderRadius: '6px',
                      background: 'var(--glass)', border: '1px solid var(--border)',
                      fontSize: '0.69rem', color: 'var(--fg)', lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}>
                      {pickedData.text.slice(0, 300)}
                      {pickedData.text.length > 300 ? '…' : ''}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
