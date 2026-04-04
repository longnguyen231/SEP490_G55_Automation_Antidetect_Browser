import React, { useState, useEffect, useCallback } from 'react';
import { Play, Plus, Trash2, Search, FileCode, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';

const DEFAULT_CODE = `// Automation Script\n// Available: page, cdp, context, profileId, log(), sleep()\n\nawait page.goto("https://example.com");\nconst title = await page.title();\nlog("Page title:", title);\n`;

export default function ScriptsManager({ profiles = [] }) {
    const [activeTab, setActiveTab] = useState('scripts');

    return (
        <div className="w-full h-full flex flex-col p-4" style={{ background: 'var(--bg)' }}>
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <h1 className="text-[1.2rem] font-bold" style={{ color: 'var(--fg)' }}>Scripts &amp; Tasks</h1>
                <div className="flex p-1 rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'scripts' ? 'btn btn-primary' : 'btn btn-secondary'}`}
                        onClick={() => setActiveTab('scripts')}
                    >
                        Scripts
                    </button>
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'logs' ? 'btn btn-primary' : 'btn btn-secondary'}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Task Logs
                    </button>
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'modules' ? 'btn btn-primary' : 'btn btn-secondary'}`}
                        onClick={() => setActiveTab('modules')}
                    >
                        Script Modules
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'scripts' && <ScriptsTab profiles={profiles} />}
            {activeTab === 'logs' && <TaskLogsTab />}
            {activeTab === 'modules' && <ScriptModulesTab />}
        </div>
    );
}

function ScriptsTab({ profiles }) {
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

    const handleDelete = async (id, e) => {
        e && e.stopPropagation();
        if (!window.confirm('Delete this script?')) return;
        try {
            await window.electronAPI.deleteScript(id);
            await load();
            if (selectedId === id) { setEditing(null); setSelectedId(null); }
        } catch (e) { alert(e?.message || String(e)); }
    };

    const handleRun = async (scriptId) => {
        const pid = runProfileId || (profiles[0]?.id || '');
        if (!pid) { alert('Select a profile to run this script first.'); return; }
        const sid = scriptId || editing?.id;
        if (!sid) { alert('Save script first.'); return; }
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
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {/* Left Sidebar */}
            <div className="w-[300px] flex flex-col justify-between" style={{ background: 'var(--card)' }}>
                <div>
                    {!filtered.length && scripts.length === 0 ? (
                        <div className="p-6 text-center text-[0.75rem] mt-2" style={{ color: 'var(--muted)' }}>
                            No scripts yet. Create one to get started.
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <div className="px-3 py-2 relative" style={{ borderBottom: '1px solid var(--border)' }}>
                                <Search size={13} className="absolute left-6 top-[0.85rem]" style={{ color: 'var(--muted)' }} />
                                <input
                                    placeholder="Search scripts..."
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                    className="w-full rounded text-[0.75rem] px-7 py-1"
                                    style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                />
                            </div>
                            <div className="py-2">
                                {filtered.map(s => (
                                    <div
                                        key={s.id}
                                        className="px-3 py-1.5 cursor-pointer border-l-4 transition flex justify-between items-center group"
                                        style={{
                                            borderColor: selectedId === s.id ? 'var(--primary)' : 'transparent',
                                            background: selectedId === s.id ? 'var(--glass-strong)' : 'transparent',
                                            color: selectedId === s.id ? 'var(--primary)' : 'var(--muted)',
                                        }}
                                        onMouseEnter={e => { if (selectedId !== s.id) e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                        onMouseLeave={e => { if (selectedId !== s.id) e.currentTarget.style.background = 'transparent'; }}
                                        onClick={() => handleSelect(s)}
                                    >
                                        <div className="font-medium text-[0.75rem] truncate pr-2" style={{ color: selectedId === s.id ? 'var(--primary)' : 'var(--fg)' }}>{s.name || '(untitled)'}</div>
                                        <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                                            <button className="p-1 rounded" style={{ color: 'var(--primary)' }} title={'Run'} onClick={e => { e.stopPropagation(); handleSelect(s); handleRun(s.id); }}>
                                                <Play size={13} />
                                            </button>
                                            <button className="p-1 rounded" style={{ color: 'var(--danger)' }} title={'Delete'} onClick={e => handleDelete(s.id, e)}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 z-10" style={{ background: 'var(--card2)', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-success w-full mb-2 text-[0.75rem]" onClick={handleNew}>
                        + New Script
                    </button>
                    <div className="flex gap-2">
                        <button className="btn btn-secondary flex-1 text-[0.7rem]">Export JSON</button>
                        <button className="btn btn-secondary flex-1 text-[0.7rem]">Import JSON</button>
                    </div>
                </div>
            </div>

            {/* Right Editor Area (Split into Middle and Right panels) */}
            <div className="flex-1 flex flex-row overflow-hidden" style={{ background: 'var(--bg)' }}>
                {editing ? (
                    <>
                        {/* Middle Panel: Editor Settings & Code */}
                        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: 'var(--card)' }}>
                            {/* Header Row */}
                            <div className="p-3 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="font-semibold text-[0.85rem]" style={{ color: 'var(--fg)' }}>
                                    {editing.id ? 'Edit Script' : 'New Script'}
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary px-3 py-1 text-[0.75rem]" onClick={() => { setEditing(null); setSelectedId(null); }}>Cancel</button>
                                    <button className="btn btn-secondary px-3 py-1 text-[0.75rem]">Export JSON</button>
                                    <button className="btn btn-primary px-3 py-1 text-[0.75rem]" style={{ background: '#3b82f6', color: '#fff', border: 'none' }} onClick={handleSave}>Save</button>
                                </div>
                            </div>
                            
                            {/* Config Row 1 */}
                            <div className="p-3 flex gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="flex-1">
                                    <label className="block text-[0.7rem] mb-1" style={{ color: 'var(--muted)' }}>Name</label>
                                    <input
                                        className="w-full rounded px-2 py-1.5 text-[0.75rem]"
                                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                        value={editing.name}
                                        onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                        placeholder="e.g. Login to site"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[0.7rem] mb-1" style={{ color: 'var(--muted)' }}>Description (optional)</label>
                                    <input
                                        className="w-full rounded px-2 py-1.5 text-[0.75rem]"
                                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                        value={editing.description || ''}
                                        onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                                        placeholder="What does this script do"
                                    />
                                </div>
                            </div>

                            {/* Config Row 2 (Auto-run) */}
                            <div className="flex flex-col">
                                <div className="p-3 flex items-center justify-between" style={{ borderBottom: editing.autoRun ? 'none' : '1px solid var(--border)' }}>
                                    <span className="text-[0.75rem] font-medium" style={{ color: 'var(--fg)' }}>Auto-run schedule</span>
                                    <label className="flex flex-col items-center cursor-pointer">
                                        <input type="checkbox" className="hidden" checked={!!editing.autoRun} onChange={e => setEditing(p => ({ ...p, autoRun: e.target.checked }))} />
                                        <div className="w-9 h-5 rounded-full relative transition-colors" style={{ background: editing.autoRun ? '#3b82f6' : 'var(--border2)' }}>
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow absolute top-[3px] transition-transform ${editing.autoRun ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}></div>
                                        </div>
                                    </label>
                                </div>
                                
                                {/* Expanded Auto-run Config */}
                                {editing.autoRun && (
                                    <div className="px-3 pb-2 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[0.7rem]" style={{ color: 'var(--fg)' }}>Profile:</span>
                                            <select className="flex-1 rounded px-2 py-1 text-[0.75rem]" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}>
                                                <option value="">Select profile...</option>
                                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-1 flex-wrap mb-2">
                                            {['Every 5m', 'Every 15m', 'Every 30m', 'Hourly', 'Daily 9am', 'Midnight', 'Mon 9am'].map(label => (
                                                <button key={label} className="px-1.5 py-0.5 rounded hover:bg-slate-200 transition text-[0.65rem] border" style={{ background: 'var(--glass-strong)', borderColor: 'var(--border2)', color: 'var(--fg)' }}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5 mb-2">
                                            {[
                                                { label: 'Minute', bg: 'var(--glass-input)' },
                                                { label: 'Hour', bg: 'var(--glass-strong)' },
                                                { label: 'Day', bg: 'var(--glass-input)' },
                                                { label: 'Month', bg: 'var(--glass-input)' },
                                                { label: 'Weekday', bg: 'var(--glass-strong)' }
                                            ].map(col => (
                                                <div key={col.label} className="flex-1">
                                                    <div className="text-[0.65rem] mb-0.5" style={{ color: 'var(--muted)' }}>{col.label}</div>
                                                    <select className="w-full rounded px-1 py-0.5 text-[0.7rem] border" style={{ background: col.bg, borderColor: 'var(--border2)', color: 'var(--fg)' }}>
                                                        <option>* (eve...</option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                className="w-[100px] rounded px-2 py-1 text-[0.75rem] font-mono tracking-widest border text-center" 
                                                readOnly 
                                                value="* * * * *" 
                                                style={{ background: 'var(--glass-input)', borderColor: 'var(--border2)', color: 'var(--fg)' }} 
                                            />
                                            <span className="text-[0.7rem]" style={{ color: 'var(--muted)' }}>Every minute</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Config Row 3 */}
                            <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <div className="text-[0.75rem] font-medium" style={{ color: 'var(--fg)' }}>Browser mode</div>
                                    <div className="text-[0.65rem] mt-0.5" style={{ color: 'var(--muted)' }}>Background (no window)</div>
                                </div>
                                <div className="flex rounded p-1" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)' }}>
                                    <button className="px-3 py-1 text-[0.7rem] rounded font-medium shadow-sm transition" style={{ background: '#3b82f6', color: '#fff' }}>Headless</button>
                                    <button className="px-3 py-1 text-[0.7rem] rounded font-medium transition" style={{ color: 'var(--muted)' }}>Visible</button>
                                </div>
                            </div>

                            {/* Editor */}
                            <div className="flex-1 relative min-h-0">
                                <Editor
                                    height="100%"
                                    language="javascript"
                                    theme="vs"
                                    value={editing.code}
                                    onChange={v => setEditing(p => ({ ...p, code: v || '' }))}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 12,
                                        lineNumbers: 'on',
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                        tabSize: 4,
                                        wordWrap: 'on'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Right Panel: API Reference Sidebar */}
                        <div className="w-[280px] flex flex-col min-h-0" style={{ background: '#f8fafc', borderLeft: '1px solid var(--border)' }}>
                            <div className="p-3 font-semibold text-[0.75rem]" style={{ color: '#334155' }}>
                                API Reference
                            </div>
                            <div className="px-3 pb-3 relative">
                                <Search size={12} className="absolute left-[18px] top-[9px]" style={{ color: '#94a3b8' }} />
                                <input
                                    placeholder="Search methods..."
                                    className="w-full rounded px-7 py-1.5 text-[0.75rem]"
                                    style={{ background: '#e2e8f0', border: '1px solid #cbd5e1', color: '#334155' }}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto border-t bg-white" style={{ borderColor: '#e2e8f0' }}>
                                {/* Mock API List Expandable Item */}
                                <div>
                                    <div className="flex items-center gap-1.5 px-3 py-2 text-[0.75rem] cursor-pointer" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <span className="text-[0.55rem]" style={{ color: '#94a3b8' }}>▼</span>
                                        <span className="font-medium" style={{ color: '#3b82f6' }}>page</span>
                                        <span className="text-[0.7rem]" style={{ color: '#64748b' }}>102 methods</span>
                                    </div>
                                    <div className="flex flex-col text-[0.75rem]">
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.goto(url, options?)</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Navigate to URL</div>
                                        </div>
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.reload(options?)</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Reload the current page</div>
                                        </div>
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.goBack() / goForward()</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Navigate browser history</div>
                                        </div>
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.title()</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Get the page &lt;title&gt;</div>
                                        </div>
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.url()</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Get the current URL (sync)</div>
                                        </div>
                                        <div className="px-4 py-2 border-b cursor-pointer hover:bg-slate-50 transition" style={{ borderColor: '#f1f5f9' }}>
                                            <div className="font-mono text-[0.65rem]" style={{ color: '#475569' }}><span style={{ color: '#cbd5e1' }}>▶</span> page.content()</div>
                                            <div className="text-[0.65rem] pl-3 mt-1" style={{ color: '#64748b' }}>Get the full page HTML</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[0.75rem]" style={{ color: 'var(--muted)', background: 'var(--card)' }}>
                        No scripts yet. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}

function TaskLogsTab() {
    const [tasks, setTasks] = useState([]);
    
    // We mock empty state as seen in screenshot
    return (
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {/* Left Sidebar */}
            <div className="w-[300px] flex flex-col" style={{ background: 'var(--card)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                    <span className="text-[0.75rem] font-medium" style={{ color: 'var(--muted)' }}>Tasks ({tasks.length})</span>
                </div>
                <div className="flex-1 p-4 text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                    No tasks yet. Run a script to create one.
                </div>
            </div>

            {/* Right Output Area */}
            <div className="flex-1 flex flex-col" style={{ background: 'var(--card)' }}>
                <div className="px-4 py-2 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
                    <span className="text-[0.75rem] font-medium" style={{ color: 'var(--muted)' }}>Select a task</span>
                    <label className="flex items-center gap-2 text-[0.75rem] cursor-pointer" style={{ color: 'var(--muted)' }}>
                        <input type="checkbox" defaultChecked className="rounded w-4 h-4" style={{ accentColor: 'var(--primary)' }} />
                        Auto-scroll
                    </label>
                </div>
                <div className="flex-1 p-4 font-mono text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                    Select a task to view its output.
                </div>
            </div>
        </div>
    );
}

function ScriptModulesTab() {
    return (
        <div className="w-full flex-1">
            <div className="rounded-xl p-4 w-full" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <p className="text-[0.8rem] mb-4" style={{ color: 'var(--muted)' }}>
                    Install npm packages for use in automation scripts via <code className="font-mono text-[0.75rem]" style={{ color: 'var(--fg)' }}>require('package-name')</code>.
                </p>
                <div className="flex gap-3 mb-4">
                    <input 
                        type="text" 
                        placeholder="e.g. axios or lodash@4" 
                        className="flex-1 rounded-md px-3 py-1.5 text-[0.75rem] transition"
                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                    />
                    <button className="btn btn-success text-[0.75rem]">
                        Install
                    </button>
                </div>
                <p className="text-[0.75rem] italic" style={{ color: 'var(--muted)' }}>
                    No modules installed.
                </p>
            </div>
        </div>
    );
}
