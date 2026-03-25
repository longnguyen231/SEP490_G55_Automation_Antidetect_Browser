import React, { useEffect, useState, useMemo } from 'react';
import { X, Trash2, Pencil, Plus, Search, Copy, Download, Upload, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/index';
import './CookieManager.css';

function parseNetscapeCookies(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const parts = line.split('\t');
    if (parts.length < 7) return null;
    const [domain, , path, secure, expires, name, value] = parts;
    return {
      name: name?.trim(),
      value: value?.trim() || '',
      domain: domain?.trim(),
      path: path?.trim() || '/',
      secure: secure?.trim().toUpperCase() === 'TRUE',
      httpOnly: false,
      expires: expires && Number(expires) > 0 ? Number(expires) : -1,
      sameSite: 'Lax',
    };
  }).filter(Boolean);
}

function detectFormat(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  if (trimmed.includes('\t')) return 'netscape';
  return 'unknown';
}

const EMPTY_COOKIE = { name: '', value: '', domain: '', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' };

function CookieManager({ profile, onClose }) {
  const { t } = useI18n();
  const [cookies, setCookies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [editingCookie, setEditingCookie] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [tab, setTab] = useState('list'); // list | import | export

  const loadCookies = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI.getCookies(profile.id);
      if (res.success) {
        setCookies(res.cookies || []);
      } else {
        setError(res.error || 'Failed to load cookies');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCookies();
  }, [profile?.id]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cookies;
    const q = search.toLowerCase();
    return cookies.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.domain || '').toLowerCase().includes(q) ||
      (c.value || '').toLowerCase().includes(q)
    );
  }, [cookies, search]);

  const handleImport = async () => {
    setError('');
    try {
      const fmt = detectFormat(importText);
      let parsed;
      if (fmt === 'json') {
        parsed = JSON.parse(importText);
        if (!Array.isArray(parsed)) parsed = [parsed];
      } else if (fmt === 'netscape') {
        parsed = parseNetscapeCookies(importText);
      } else {
        throw new Error('Unrecognized format. Use JSON array or Netscape/txt format.');
      }
      if (!parsed.length) throw new Error('No cookies found in input');
      const res = await window.electronAPI.importCookies(profile.id, parsed);
      if (!res.success) throw new Error(res.error || 'Import failed');
      setImportText('');
      setSuccess(t('cookies.imported').replace('{count}', res.count || parsed.length));
      setTab('list');
      await loadCookies();
    } catch (e) {
      setError('Import error: ' + e.message);
    }
  };

  const handleDelete = async (cookie) => {
    setError('');
    try {
      const res = await window.electronAPI.deleteCookie(profile.id, {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path || '/',
      });
      if (!res.success) throw new Error(res.error);
      setSuccess(t('cookies.deleted'));
      await loadCookies();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(t('cookies.clearConfirm'))) return;
    setError('');
    try {
      const res = await window.electronAPI.clearCookies(profile.id);
      if (!res.success) throw new Error(res.error);
      setSuccess(t('cookies.cleared'));
      await loadCookies();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditSave = async () => {
    if (!editingCookie) return;
    setError('');
    try {
      const res = await window.electronAPI.editCookie(profile.id, editingCookie);
      if (!res.success) throw new Error(res.error);
      setEditingCookie(null);
      await loadCookies();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddNew = () => {
    setEditingCookie({ ...EMPTY_COOKIE });
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cookies, null, 2));
      setSuccess(t('cookies.copyJson'));
    } catch { }
  };

  const exportNetscape = () => {
    const lines = ['# Netscape HTTP Cookie File', '# Exported from OBT Antidetect Browser', ''];
    cookies.forEach(c => {
      const httpOnly = c.httpOnly ? '#HttpOnly_' : '';
      lines.push(`${httpOnly}${c.domain}\tTRUE\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expires > 0 ? c.expires : 0}\t${c.name}\t${c.value}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookies_${profile.name || profile.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cookie-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cookie-modal">
        {/* Header */}
        <div className="cookie-modal-header">
          <h3>{t('cookies.title')} {profile.name}</h3>
          <div className="header-actions">
            <span className="cookie-count">{cookies.length} cookies</span>
            <button className="btn btn-icon" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && <div className="cookie-msg error"><AlertTriangle size={14} /> {error}</div>}
        {success && <div className="cookie-msg success">{success}</div>}

        {loading ? (
          <div className="loading">{t('cookies.loading')}</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="cookie-tabs">
              <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
                {t('cookies.saved')} ({cookies.length})
              </button>
              <button className={`tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
                <Upload size={14} /> {t('cookies.import')}
              </button>
              <button className={`tab ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
                <Download size={14} /> {t('cookies.export')}
              </button>
            </div>

            <div className="cookie-modal-body">
              {/* ═══ LIST TAB ═══ */}
              {tab === 'list' && (
                <div className="cookie-list-tab">
                  {/* Toolbar */}
                  <div className="cookie-toolbar">
                    <div className="search-box">
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder={t('cookies.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="toolbar-actions">
                      <button className="btn btn-sm btn-primary" onClick={handleAddNew}>
                        <Plus size={14} /> {t('cookies.addNew')}
                      </button>
                      {cookies.length > 0 && (
                        <button className="btn btn-sm btn-danger" onClick={handleClearAll}>
                          <Trash2 size={14} /> {t('cookies.clearAll')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="cookie-table">
                    <div className="cookie-table-header">
                      <div>{t('cookies.name')}</div>
                      <div>{t('cookies.value')}</div>
                      <div>{t('cookies.domain')}</div>
                      <div>{t('cookies.expires')}</div>
                      <div className="cookie-flags">Flags</div>
                      <div></div>
                    </div>
                    <div className="cookie-table-body">
                      {filtered.map((c, idx) => (
                        <div className="cookie-row" key={`${c.name}-${c.domain}-${idx}`}>
                          <div title={c.name}>{c.name}</div>
                          <div className="cookie-value" title={c.value}>{c.value}</div>
                          <div title={c.domain}>{c.domain}</div>
                          <div>{c.expires > 0 ? new Date(c.expires * 1000).toLocaleDateString() : 'Session'}</div>
                          <div className="cookie-flags">
                            {c.secure && <span className="flag flag-secure">S</span>}
                            {c.httpOnly && <span className="flag flag-http">H</span>}
                            {c.sameSite && c.sameSite !== 'None' && <span className="flag flag-same">{c.sameSite[0]}</span>}
                          </div>
                          <div className="cookie-actions">
                            <button className="btn-icon-sm" onClick={() => setEditingCookie({ ...c })} title={t('cookies.edit')}>
                              <Pencil size={13} />
                            </button>
                            <button className="btn-icon-sm btn-danger-icon" onClick={() => handleDelete(c)} title={t('cookies.delete')}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="empty">{search ? 'No matches' : t('cookies.empty')}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ IMPORT TAB ═══ */}
              {tab === 'import' && (
                <div className="cookie-import-tab">
                  <p className="hint">{t('cookies.netscapeHint')}</p>
                  <textarea
                    className="cookie-textarea"
                    placeholder={t('cookies.placeholder')}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={12}
                  />
                  <div className="actions">
                    <button className="btn btn-primary" onClick={handleImport} disabled={!importText.trim()}>
                      <Upload size={14} /> {t('cookies.importBtn')}
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ EXPORT TAB ═══ */}
              {tab === 'export' && (
                <div className="cookie-export-tab">
                  <textarea
                    className="cookie-textarea"
                    value={JSON.stringify(cookies, null, 2)}
                    readOnly
                    rows={12}
                  />
                  <div className="actions">
                    <button className="btn" onClick={copyExport}>
                      <Copy size={14} /> {t('cookies.copyJson')}
                    </button>
                    <button className="btn" onClick={exportNetscape}>
                      <Download size={14} /> Export Netscape
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ EDIT MODAL ═══ */}
        {editingCookie && (
          <div className="cookie-edit-overlay" onClick={(e) => e.target === e.currentTarget && setEditingCookie(null)}>
            <div className="cookie-edit-modal">
              <h4>{editingCookie.name ? t('cookies.editTitle') : t('cookies.addNew')}</h4>
              <div className="edit-fields">
                <label>
                  {t('cookies.name')}
                  <input type="text" value={editingCookie.name} onChange={(e) => setEditingCookie({ ...editingCookie, name: e.target.value })} />
                </label>
                <label>
                  {t('cookies.value')}
                  <input type="text" value={editingCookie.value} onChange={(e) => setEditingCookie({ ...editingCookie, value: e.target.value })} />
                </label>
                <label>
                  {t('cookies.domain')}
                  <input type="text" value={editingCookie.domain} onChange={(e) => setEditingCookie({ ...editingCookie, domain: e.target.value })} placeholder=".example.com" />
                </label>
                <label>
                  {t('cookies.path')}
                  <input type="text" value={editingCookie.path} onChange={(e) => setEditingCookie({ ...editingCookie, path: e.target.value })} />
                </label>
                <label>
                  {t('cookies.expires')} (Unix timestamp)
                  <input type="number" value={editingCookie.expires || ''} onChange={(e) => setEditingCookie({ ...editingCookie, expires: Number(e.target.value) || -1 })} placeholder="-1 for session" />
                </label>
                <label>
                  {t('cookies.sameSite')}
                  <select value={editingCookie.sameSite || 'Lax'} onChange={(e) => setEditingCookie({ ...editingCookie, sameSite: e.target.value })}>
                    <option value="Strict">Strict</option>
                    <option value="Lax">Lax</option>
                    <option value="None">None</option>
                  </select>
                </label>
                <div className="edit-checkboxes">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={!!editingCookie.secure} onChange={(e) => setEditingCookie({ ...editingCookie, secure: e.target.checked })} />
                    {t('cookies.secure')}
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={!!editingCookie.httpOnly} onChange={(e) => setEditingCookie({ ...editingCookie, httpOnly: e.target.checked })} />
                    {t('cookies.httpOnly')}
                  </label>
                </div>
              </div>
              <div className="edit-actions">
                <button className="btn" onClick={() => setEditingCookie(null)}>{t('cookies.cancel')}</button>
                <button className="btn btn-primary" onClick={handleEditSave} disabled={!editingCookie.name || !editingCookie.domain}>
                  {t('cookies.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CookieManager;
