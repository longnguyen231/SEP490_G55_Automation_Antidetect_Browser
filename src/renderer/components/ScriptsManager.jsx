import React, { useEffect, useState } from 'react';
import './ScriptsManager.css';

export default function ScriptsManager({ open, onClose, profiles, onRunScript }) {
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
  const filtered = scripts.filter(s => !filter || (s.name||'').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="modal-root">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Automation Scripts</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="toolbar">
          <input placeholder="Filter by name" value={filter} onChange={(e)=> setFilter(e.target.value)} />
          <select value={selectedProfileId} onChange={(e)=> setSelectedProfileId(e.target.value)}>
            <option value="">Select profile to run</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={startCreate}>New Script</button>
        </div>
        <div className="scripts-grid">
          {filtered.map(s => (
            <div className="script-card" key={s.id}>
              <div className="script-title">{s.name || '(untitled)'}</div>
              <div className="script-desc">{s.description}</div>
              <div className="script-actions">
                <button className="btn" onClick={() => startEdit(s)}>Edit</button>
                <button className="btn btn-danger" onClick={() => del(s.id)}>Delete</button>
                <button className="btn btn-success" onClick={() => run(s.id)}>Run</button>
              </div>
            </div>
          ))}
          {!filtered.length && <div style={{ opacity:0.7 }}>No scripts</div>}
        </div>
        {editing && (
          <div className="editor">
            <div className="row">
              <label>Name</label>
              <input value={editing.name} onChange={(e)=> setEditing(prev=>({...prev, name:e.target.value}))} />
            </div>
            <div className="row">
              <label>Description</label>
              <input value={editing.description} onChange={(e)=> setEditing(prev=>({...prev, description:e.target.value}))} />
            </div>
            <div className="row">
              <label>Code (async JS)</label>
              <textarea value={editing.code} onChange={(e)=> setEditing(prev=>({...prev, code:e.target.value}))} spellCheck={false} />
            </div>
            <div className="row actions">
              <button className="btn" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-success" onClick={save}>Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
