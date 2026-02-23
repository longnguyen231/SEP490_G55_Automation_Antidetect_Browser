import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Play, Search, X } from 'lucide-react';
import { useI18n } from '../i18n/index';
import './ScriptsManager.css';

export default function ScriptsManager({ open, onClose, profiles, onRunScript, fullPage = false }) {
  const { t } = useI18n();
  const [scripts, setScripts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [filter, setFilter] = useState('');

  const load = async () => {
    try { const list = await window.electronAPI.listScripts(); setScripts(Array.isArray(list) ? list : []); }
    catch { setScripts([]); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const startCreate = () => setEditing({ id: null, name: '', description: '', code: `// Example script\n// Available: log(...), sleep(ms), actions['nav.goto']({url}), actions['click.element']({selector})\nlog('Hello from script');\nawait actions['nav.goto']({ url: 'https://example.com' });\nawait sleep(1000);\nlog('Title will be fetched via action js.eval');\nconst r = await actions['js.eval']({ expression: 'document.title' });\nlog('Title =', r.success ? r.value : r.error);\n` });
  const startEdit = (s) => setEditing({ ...s });
  const cancelEdit = () => setEditing(null);
  const save = async () => {
    try {
      const payload = { id: editing.id, name: editing.name, description: editing.description, code: editing.code };
      const res = await window.electronAPI.saveScript(payload);
      if (!res?.success) { alert(res?.error || 'Save failed'); return; }
      setEditing(null);
      await load();
    } catch (e) { alert(e?.message || String(e)); }
  };
  const del = async (id) => {
    if (!window.confirm('Delete this script?')) return;
    try { const r = await window.electronAPI.deleteScript(id); if (!r?.success) alert(r?.error || 'Delete failed'); await load(); }
    catch (e) { alert(e?.message || String(e)); }
  };
  const run = async (sid) => {
    const pid = selectedProfileId || (profiles[0]?.id || '');
    if (!pid) { alert('No profile selected'); return; }
    try {
      onRunScript && onRunScript(pid, sid);
      const r = await window.electronAPI.executeScript(pid, sid, { timeoutMs: 120000 });
      if (!r?.success) alert('Run error: ' + (r?.error || ''));
      else alert('Run done');
    } catch (e) { alert(e?.message || String(e)); }
  };

  if (!open) return null;
  const filtered = scripts.filter(s => !filter || (s.name || '').toLowerCase().includes(filter.toLowerCase()));

  // Full page mode
  if (fullPage) {
    return (
      <div className="scripts-page">
        <div className="page-header">
          <h1>{t('scripts.title')}</h1>
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={startCreate}>
              <Plus size={15} /> {t('scripts.new')}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input placeholder={t('scripts.filter')} value={filter} onChange={(e) => setFilter(e.target.value)}
              style={{ paddingLeft: 32, width: '100%' }} />
          </div>
          <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
            <option value="">{t('scripts.selectProfile')}</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="scripts-grid">
          {filtered.map(s => (
            <div className="script-card" key={s.id}>
              <div className="script-title">{s.name || '(untitled)'}</div>
              <div className="script-desc">{s.description}</div>
              <div className="script-actions">
                <button className="btn" onClick={() => startEdit(s)}>
                  <Edit2 size={14} /> {t('scripts.edit')}
                </button>
                <button className="btn btn-danger" onClick={() => del(s.id)}>
                  <Trash2 size={14} />
                </button>
                <button className="btn btn-success" onClick={() => run(s.id)}>
                  <Play size={14} /> {t('scripts.run')}
                </button>
              </div>
            </div>
          ))}
          {!filtered.length && <div style={{ opacity: 0.6, padding: '2rem', textAlign: 'center' }}>{t('scripts.noScripts')}</div>}
        </div>

        {editing && (
          <div className="editor">
            <div className="row">
              <label>{t('scripts.name')}</label>
              <input value={editing.name} onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="row">
              <label>{t('scripts.description')}</label>
              <input value={editing.description} onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="row">
              <label>{t('scripts.code')}</label>
              <textarea value={editing.code} onChange={(e) => setEditing(prev => ({ ...prev, code: e.target.value }))} spellCheck={false} />
            </div>
            <div className="row actions">
              <button className="btn" onClick={cancelEdit}>{t('scripts.cancel')}</button>
              <button className="btn btn-success" onClick={save}>{t('scripts.save')}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Modal mode (fallback)
  return (
    <div className="modal-root">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{t('scripts.title')}</h3>
          <button className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="toolbar">
          <input placeholder={t('scripts.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
            <option value="">{t('scripts.selectProfile')}</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={startCreate}><Plus size={15} /> {t('scripts.new')}</button>
        </div>
        <div className="scripts-grid">
          {filtered.map(s => (
            <div className="script-card" key={s.id}>
              <div className="script-title">{s.name || '(untitled)'}</div>
              <div className="script-desc">{s.description}</div>
              <div className="script-actions">
                <button className="btn" onClick={() => startEdit(s)}><Edit2 size={14} /> {t('scripts.edit')}</button>
                <button className="btn btn-danger" onClick={() => del(s.id)}><Trash2 size={14} /></button>
                <button className="btn btn-success" onClick={() => run(s.id)}><Play size={14} /> {t('scripts.run')}</button>
              </div>
            </div>
          ))}
          {!filtered.length && <div style={{ opacity: 0.7 }}>{t('scripts.noScripts')}</div>}
        </div>
        {editing && (
          <div className="editor">
            <div className="row">
              <label>{t('scripts.name')}</label>
              <input value={editing.name} onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="row">
              <label>{t('scripts.description')}</label>
              <input value={editing.description} onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="row">
              <label>{t('scripts.code')}</label>
              <textarea value={editing.code} onChange={(e) => setEditing(prev => ({ ...prev, code: e.target.value }))} spellCheck={false} />
            </div>
            <div className="row actions">
              <button className="btn" onClick={cancelEdit}>{t('scripts.cancel')}</button>
              <button className="btn btn-success" onClick={save}>{t('scripts.save')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
