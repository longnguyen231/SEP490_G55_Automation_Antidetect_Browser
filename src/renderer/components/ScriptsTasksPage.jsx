import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Plus, Edit2, Trash2, Search, FileCode, Clock, ChevronRight, Terminal, Book, X, Trash, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useI18n } from '../i18n/index';
import './ScriptsTasksPage.css';

/* ━━━ API Reference Data (keys use i18n for category names) ━━━ */
const API_REF_RAW = [
  { catKey: 'stp.api.navigation', methods: [
    { name: 'page.goto(url)', desc: 'Navigate to a URL' },
    { name: 'page.reload()', desc: 'Reload the current page' },
    { name: 'page.goBack()', desc: 'Navigate back in history' },
    { name: 'page.goForward()', desc: 'Navigate forward in history' },
  ]},
  { catKey: 'stp.api.pageInfo', methods: [
    { name: 'page.title()', desc: 'Get the page title' },
    { name: 'page.url()', desc: 'Get the current URL' },
    { name: 'page.content()', desc: 'Get full HTML content' },
  ]},
  { catKey: 'stp.api.click', methods: [
    { name: 'page.click(selector)', desc: 'Click an element' },
    { name: 'page.dblclick(selector)', desc: 'Double-click an element' },
    { name: 'page.hover(selector)', desc: 'Hover over an element' },
    { name: 'page.focus(selector)', desc: 'Focus an element' },
  ]},
  { catKey: 'stp.api.input', methods: [
    { name: 'page.fill(selector, value)', desc: 'Fill an input field' },
    { name: 'page.type(selector, text)', desc: 'Type text into an element' },
    { name: 'page.press(selector, key)', desc: 'Press a keyboard key' },
    { name: 'page.check(selector)', desc: 'Check a checkbox' },
    { name: 'page.uncheck(selector)', desc: 'Uncheck a checkbox' },
    { name: 'page.selectOption(selector, value)', desc: 'Select a dropdown option' },
  ]},
  { catKey: 'stp.api.wait', methods: [
    { name: 'page.waitForSelector(sel)', desc: 'Wait for element to appear' },
    { name: 'page.waitForTimeout(ms)', desc: 'Wait for specified milliseconds' },
    { name: 'page.waitForLoadState()', desc: 'Wait for page load state' },
  ]},
  { catKey: 'stp.api.evaluate', methods: [
    { name: 'page.evaluate(fn)', desc: 'Run JS in the browser context' },
    { name: 'page.$(selector)', desc: 'Query a single element' },
    { name: 'page.$$(selector)', desc: 'Query all matching elements' },
  ]},
  { catKey: 'stp.api.screenshot', methods: [
    { name: 'page.screenshot()', desc: 'Take a screenshot' },
    { name: 'page.pdf()', desc: 'Export page as PDF' },
  ]},
  { catKey: 'stp.api.globals', methods: [
    { name: 'log(...args)', desc: 'Log a message to task output' },
    { name: 'sleep(ms)', desc: 'Pause execution for ms' },
    { name: 'profileId', desc: 'Current profile ID string' },
    { name: 'cdp', desc: 'CDP session for low-level access' },
    { name: 'context', desc: 'Browser context object' },
  ]},
];

const DEFAULT_CODE = `// Automation Script
// Available: page, cdp, context, profileId, log(), sleep()

await page.goto("https://example.com");
const title = await page.title();
log("Page title:", title);

// Click example
// await page.click("#some-button");

// Fill form example
// await page.fill("#email", "test@example.com");
`;

/* ━━━ Main Component ━━━ */
export default function ScriptsTasksPage({ profiles = [] }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('scripts');

  return (
    <div className="stp-container">
      <div className="stp-header">
        <div className="stp-tabs">
          <button className={`stp-tab ${activeTab === 'scripts' ? 'active' : ''}`} onClick={() => setActiveTab('scripts')}>
            <FileCode size={16} /> {t('stp.tab.scripts')}
          </button>
          <button className={`stp-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <Clock size={16} /> {t('stp.tab.logs')}
          </button>
        </div>
      </div>

      {activeTab === 'scripts' && <ScriptsTab profiles={profiles} />}
      {activeTab === 'logs' && <TaskLogsTab />}
    </div>
  );
}

/* ━━━ Scripts Tab ━━━ */
function ScriptsTab({ profiles }) {
  const { t } = useI18n();
  const [scripts, setScripts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [runProfileId, setRunProfileId] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await window.electronAPI.listScripts();
      setScripts(Array.isArray(list) ? list : []);
    } catch { setScripts([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleNew = () => {
    setEditing({ id: null, name: '', description: '', code: DEFAULT_CODE });
    setSelectedId(null);
    setRunResult(null);
  };

  const handleSelect = (s) => {
    setEditing({ ...s });
    setSelectedId(s.id);
    setRunResult(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const res = await window.electronAPI.saveScript({
        id: editing.id,
        name: editing.name,
        description: editing.description,
        code: editing.code,
      });
      if (!res?.success) { alert(res?.error || 'Save failed'); return; }
      await load();
      if (!editing.id && res.script?.id) {
        setEditing(prev => ({ ...prev, id: res.script.id }));
        setSelectedId(res.script.id);
      }
    } catch (e) { alert(e?.message || String(e)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('stp.deleteConfirm'))) return;
    try {
      await window.electronAPI.deleteScript(id);
      await load();
      if (selectedId === id) { setEditing(null); setSelectedId(null); }
    } catch (e) { alert(e?.message || String(e)); }
  };

  const handleRun = async (scriptId) => {
    const pid = runProfileId || (profiles[0]?.id || '');
    if (!pid) { alert(t('stp.selectProfileFirst')); return; }
    const sid = scriptId || editing?.id;
    if (!sid) { alert(t('stp.saveFirst')); return; }
    setRunning(true);
    setRunResult(null);
    try {
      const res = await window.electronAPI.executeScript(pid, sid, { timeoutMs: 120000 });
      setRunResult(res);
    } catch (e) {
      setRunResult({ success: false, error: e?.message || String(e), logs: [] });
    } finally { setRunning(false); }
  };

  const filtered = scripts.filter(s => !filter || (s.name || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="stp-scripts-layout">
      {/* Left Sidebar */}
      <div className="stp-sidebar">
        <div className="stp-sidebar-search">
          <Search size={14} />
          <input placeholder={t('stp.search')} value={filter} onChange={e => setFilter(e.target.value)} />
        </div>

        <div className="stp-script-list">
          {filtered.map(s => (
            <div
              key={s.id}
              className={`stp-script-item ${selectedId === s.id ? 'active' : ''}`}
              onClick={() => handleSelect(s)}
            >
              <div className="stp-script-item-name">{s.name || '(untitled)'}</div>
              <div className="stp-script-item-actions">
                <button title={t('stp.run')} onClick={e => { e.stopPropagation(); handleSelect(s); handleRun(s.id); }}>
                  <Play size={13} />
                </button>
                <button title={t('scripts.cancel')} onClick={e => { e.stopPropagation(); handleDelete(s.id); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {!filtered.length && <div className="stp-empty">{t('stp.noScripts')}</div>}
        </div>

        <button className="stp-new-btn" onClick={handleNew}>
          <Plus size={16} /> {t('stp.newScript')}
        </button>
      </div>

      {/* Center: Editor */}
      <div className="stp-editor-area">
        {editing ? (
          <>
            <div className="stp-editor-info">
              <div className="stp-field">
                <label>{t('stp.name')}</label>
                <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder={t('stp.namePh')} />
              </div>
              <div className="stp-field">
                <label>{t('stp.desc')}</label>
                <input value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} placeholder={t('stp.descPh')} />
              </div>
              <div className="stp-field stp-field-profile">
                <label>{t('stp.profile')}</label>
                <select value={runProfileId} onChange={e => setRunProfileId(e.target.value)}>
                  <option value="">{t('stp.selectProfile')}</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                </select>
              </div>
            </div>

            <div className="stp-monaco-wrap">
              <Editor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={editing.code}
                onChange={v => setEditing(p => ({ ...p, code: v || '' }))}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  padding: { top: 12 },
                }}
              />
            </div>

            <div className="stp-editor-actions">
              <button className="stp-btn stp-btn-save" onClick={handleSave}>{t('stp.save')}</button>
              <button className="stp-btn stp-btn-run" onClick={() => handleRun()} disabled={running}>
                {running ? <><RefreshCw size={14} className="stp-spin" /> {t('stp.running')}</> : <><Play size={14} /> {t('stp.run')}</>}
              </button>
            </div>

            {runResult && (
              <div className={`stp-run-result ${runResult.success ? 'success' : 'error'}`}>
                <div className="stp-run-result-header">
                  {runResult.success ? `✅ ${t('stp.completed')}` : `❌ ${t('stp.error')}`}
                  {runResult.error && <span className="stp-run-error-msg">{runResult.error}</span>}
                </div>
                {runResult.logs?.length > 0 && (
                  <div className="stp-run-logs">
                    {runResult.logs.map((l, i) => (
                      <div key={i} className="stp-log-line">
                        <span className="stp-log-time">{new Date(l.time).toLocaleTimeString()}</span>
                        <span className="stp-log-msg">{l.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="stp-editor-empty">
            <FileCode size={48} strokeWidth={1} />
            <p>{t('stp.selectScript')}</p>
          </div>
        )}
      </div>

      {/* Right: API Reference */}
      <div className="stp-api-ref">
        <div className="stp-api-ref-title"><Book size={14} /> {t('stp.apiRef')}</div>
        <div className="stp-api-ref-list">
          {API_REF_RAW.map(cat => (
            <ApiCategory key={cat.catKey} cat={cat} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━ API Category (collapsible) ━━━ */
function ApiCategory({ cat }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  return (
    <div className="stp-api-cat">
      <button className="stp-api-cat-header" onClick={() => setOpen(!open)}>
        <ChevronRight size={14} className={open ? 'stp-chevron-open' : ''} />
        {t(cat.catKey)}
      </button>
      {open && (
        <div className="stp-api-cat-methods">
          {cat.methods.map(m => (
            <div key={m.name} className="stp-api-method">
              <code>{m.name}</code>
              <span>{m.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ━━━ Task Logs Tab ━━━ */
function TaskLogsTab() {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);

  const loadLogs = useCallback(async () => {
    try {
      const list = await window.electronAPI.getTaskLogs();
      setLogs(Array.isArray(list) ? list : []);
    } catch { setLogs([]); }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleSelect = async (log) => {
    setSelectedLog(log);
    try {
      const res = await window.electronAPI.getTaskLog(log.id);
      if (res?.success) setDetailLogs(res.taskLog.logs || []);
      else setDetailLogs([]);
    } catch { setDetailLogs([]); }
  };

  const handleClear = async () => {
    if (!window.confirm(t('stp.clearConfirm'))) return;
    try {
      await window.electronAPI.clearTaskLogs();
      setLogs([]);
      setSelectedLog(null);
      setDetailLogs([]);
    } catch {}
  };

  return (
    <div className="stp-logs-layout">
      <div className="stp-logs-list">
        <div className="stp-logs-list-header">
          <span>{t('stp.taskHistory')}</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button title="Refresh" onClick={loadLogs}><RefreshCw size={14} /></button>
            <button title={t('actions.clear')} onClick={handleClear}><Trash size={14} /></button>
          </div>
        </div>
        <div className="stp-logs-items">
          {logs.map(l => (
            <div
              key={l.id}
              className={`stp-log-item ${selectedLog?.id === l.id ? 'active' : ''} ${l.status}`}
              onClick={() => handleSelect(l)}
            >
              <div className="stp-log-item-top">
                <span className="stp-log-item-name">{l.scriptName}</span>
                <span className={`stp-log-item-status ${l.status}`}>
                  {l.status === 'completed' ? '✅' : l.status === 'error' ? '❌' : '⏳'} {l.status === 'completed' ? t('stp.completed') : l.status === 'error' ? t('stp.error') : l.status}
                </span>
              </div>
              <div className="stp-log-item-bottom">
                <span>Profile: {l.profileId?.slice(0, 8)}</span>
                <span>{new Date(l.finishedAt || l.startedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
          {!logs.length && <div className="stp-empty">{t('stp.noLogs')}</div>}
        </div>
      </div>

      <div className="stp-logs-output">
        {selectedLog ? (
          <>
            <div className="stp-logs-output-header">
              <Terminal size={14} />
              <strong>{selectedLog.scriptName}</strong>
              <span className={`stp-log-item-status ${selectedLog.status}`}>{selectedLog.status === 'completed' ? t('stp.completed') : t('stp.error')}</span>
              <span className="stp-logs-output-time">
                {new Date(selectedLog.startedAt).toLocaleString()} → {new Date(selectedLog.finishedAt).toLocaleString()}
              </span>
            </div>
            {selectedLog.error && (
              <div className="stp-logs-output-error">{t('stp.error')}: {selectedLog.error}</div>
            )}
            <div className="stp-logs-output-body">
              {detailLogs.map((l, i) => (
                <div key={i} className="stp-log-line">
                  <span className="stp-log-time">{new Date(l.time).toLocaleTimeString()}</span>
                  <span className="stp-log-msg">{l.message}</span>
                </div>
              ))}
              {!detailLogs.length && <div className="stp-empty">{t('stp.noLogEntries')}</div>}
            </div>
          </>
        ) : (
          <div className="stp-editor-empty">
            <Terminal size={48} strokeWidth={1} />
            <p>{t('stp.selectTask')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
