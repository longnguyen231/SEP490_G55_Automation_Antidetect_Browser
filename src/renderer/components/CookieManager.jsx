import React, { useEffect, useState } from 'react';
import './CookieManager.css';

function CookieManager({ profile, onClose }) {
  const [cookies, setCookies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [error, setError] = useState('');

  const loadCookies = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI.getCookies(profile.id);
      if (res.success) {
        setCookies(res.cookies || []);
        setExportText(JSON.stringify(res.cookies || [], null, 2));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const handleImport = async () => {
    setError('');
    try {
      const parsed = JSON.parse(importText);
      const res = await window.electronAPI.importCookies(profile.id, parsed);
      if (!res.success) throw new Error(res.error || 'Import failed');
      await loadCookies();
      alert('Cookies imported successfully');
    } catch (e) {
      setError('Import error: ' + e.message);
    }
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      alert('Copied to clipboard');
    } catch {}
  };

  return (
    <div className="cookie-modal-backdrop">
      <div className="cookie-modal">
        <div className="cookie-modal-header">
          <h3>Cookies for: {profile.name}</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div className="loading">Loading cookies...</div>
        ) : (
          <div className="cookie-modal-body">
            <div className="cookie-sections">
              <section>
                <h4>Saved Cookies ({cookies.length})</h4>
                <div className="cookie-table">
                  <div className="cookie-table-header">
                    <div>Name</div>
                    <div>Domain</div>
                    <div>Path</div>
                    <div>Expires</div>
                  </div>
                  <div className="cookie-table-body">
                    {cookies.map((c, idx) => (
                      <div className="cookie-row" key={idx}>
                        <div title={c.name}>{c.name}</div>
                        <div title={c.domain}>{c.domain}</div>
                        <div>{c.path}</div>
                        <div>{c.expires ? new Date(c.expires * 1000).toLocaleString() : '-'}</div>
                      </div>
                    ))}
                    {cookies.length === 0 && <div className="empty">No cookies saved</div>}
                  </div>
                </div>
              </section>

              <section>
                <h4>Export</h4>
                <textarea className="cookie-textarea" value={exportText} readOnly />
                <div className="actions">
                  <button className="btn" onClick={copyExport}>Copy JSON</button>
                </div>
              </section>

              <section>
                <h4>Import</h4>
                <textarea className="cookie-textarea" placeholder="Paste cookies JSON array here" value={importText} onChange={(e)=>setImportText(e.target.value)} />
                <div className="actions">
                  <button className="btn btn-primary" onClick={handleImport}>Import Cookies</button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CookieManager;
