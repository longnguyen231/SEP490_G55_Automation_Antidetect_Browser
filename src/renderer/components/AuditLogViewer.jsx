import React, { useState, useCallback } from 'react';

const ACTION_COLORS = {
  VIOLATION_BLOCKED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'VIOLATION' },
  RATE_LIMIT_EXCEEDED: { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', label: 'RATE LIMIT' },
  SCRIPT_RUN: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', label: 'SCRIPT RUN' },
};

function parseAuditLine(line) {
  // Format: [ISO] [PROFILE:xxx] [ACTION:xxx] detail [HASH:xxx]
  const m = line.match(
    /^\[(.+?)\]\s+\[PROFILE:(.+?)\]\s+\[ACTION:(.+?)\]\s+(.*?)\s+\[HASH:([a-f0-9]+)\]$/
  );
  if (!m) return null;
  return {
    time: m[1],
    profileId: m[2],
    action: m[3],
    detail: m[4],
    hash: m[5],
    raw: line,
  };
}

export default function AuditLogViewer() {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI.exportAuditLog();
      if (!res?.success) { setError(res?.error || 'Failed to load audit log'); setEntries([]); return; }
      const lines = (res.content || '').split('\n').filter(l => l.trim());
      const parsed = lines.map(parseAuditLine).filter(Boolean);
      setEntries(parsed.reverse()); // newest first
    } catch (e) {
      setError(e?.message || 'Unknown error');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = entries
    ? entries.filter(e => {
        if (filter !== 'ALL' && e.action !== filter) return false;
        if (search && !e.profileId.toLowerCase().includes(search.toLowerCase()) &&
            !e.detail.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
    : [];

  const download = () => {
    if (!entries || entries.length === 0 || error) return;
    
    // Legal warning modal logic from UC_11.03
    const confirmMessage = "This action will export the history of all hidden profiles and executed scripts to serve as compliance evidence\n\nConfirm Export?";
    if (!window.confirm(confirmMessage)) return;

    const text = entries.map(e => e.raw).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--fg)', margin: 0 }}>
            🛡️ Audit Log
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>
            Records script violations, rate limit breaches, and security events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {entries && entries.length > 0 && !error && (
            <button
              onClick={download}
              style={{
                fontSize: '0.72rem', padding: '0.3rem 0.75rem',
                background: 'var(--glass)', border: '1px solid var(--border)',
                borderRadius: '6px', color: 'var(--fg)', cursor: 'pointer',
              }}
            >
              ⬇ Export
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              fontSize: '0.72rem', padding: '0.3rem 0.75rem',
              background: 'var(--primary)', border: 'none',
              borderRadius: '6px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading…' : entries === null ? 'Load Log' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: '0.5rem' }}>{error}</p>
      )}

      {entries !== null && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            {['ALL', 'VIOLATION_BLOCKED', 'RATE_LIMIT_EXCEEDED', 'SCRIPT_RUN'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: '0.68rem', padding: '0.2rem 0.6rem',
                  borderRadius: '999px', cursor: 'pointer',
                  border: filter === f ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: filter === f ? 'var(--primary)' : 'var(--glass)',
                  color: filter === f ? '#fff' : 'var(--muted)',
                  fontWeight: filter === f ? '700' : '400',
                  transition: 'all 0.15s',
                }}
              >
                {f === 'ALL' ? 'All' : ACTION_COLORS[f]?.label || f}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search profile / detail…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto', fontSize: '0.72rem', padding: '0.2rem 0.6rem',
                borderRadius: '6px', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--fg)', width: '180px',
              }}
            />
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: entries.length === 0 ? '#ef4444' : 'var(--muted)', fontSize: '0.78rem' }}>
              {entries.length === 0 ? 'No system logs found.' : 'No entries match current filter.'}
            </div>
          ) : (
            <div style={{
              borderRadius: '8px', border: '1px solid var(--border)',
              overflow: 'hidden', maxHeight: '340px', overflowY: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.71rem' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-strong)', borderBottom: '1px solid var(--border)' }}>
                    {['Time', 'Profile', 'Event', 'Detail', 'HMAC'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '0.45rem 0.65rem',
                        color: 'var(--muted)', fontWeight: '700', fontSize: '0.67rem',
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => {
                    const style = ACTION_COLORS[e.action] || { bg: 'transparent', text: 'var(--muted)', label: e.action };
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--glass)',
                      }}>
                        <td style={{ padding: '0.4rem 0.65rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {new Date(e.time).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', fontFamily: 'monospace', color: 'var(--fg)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.profileId}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            background: style.bg, color: style.text,
                            padding: '0.15rem 0.5rem', borderRadius: '999px',
                            fontWeight: '700', fontSize: '0.63rem', letterSpacing: '0.03em',
                          }}>
                            {style.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', color: 'var(--fg)', maxWidth: '240px', wordBreak: 'break-word' }}>
                          {e.detail}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', fontFamily: 'monospace', color: 'var(--muted)', fontSize: '0.63rem', whiteSpace: 'nowrap' }}>
                          {e.hash}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.4rem', textAlign: 'right' }}>
            {filtered.length} of {entries.length} entries
          </p>
        </>
      )}
    </div>
  );
}
