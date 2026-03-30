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

            {/* Right Editor Area */}
            <div className="flex-1 flex flex-col" style={{ background: 'var(--card)' }}>
                {editing ? (
                    <div className="flex flex-col h-full">
                        <div className="p-3 flex gap-3 items-center" style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
                            <input
                                className="flex-1 rounded px-2 py-1 text-[0.75rem]"
                                style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                value={editing.name}
                                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                placeholder="Script Name"
                            />
                            <select
                                className="w-[180px] rounded px-2 py-1 text-[0.75rem]"
                                style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                                value={runProfileId}
                                onChange={e => setRunProfileId(e.target.value)}
                            >
                                <option value="">Select profile to run...</option>
                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                            </select>
                            <button className="btn btn-secondary text-[0.75rem]" onClick={handleSave}>
                                Save
                            </button>
                            <button className="btn btn-success text-[0.75rem] flex items-center gap-1" onClick={() => handleRun()} disabled={running}>
                                {running ? <><RefreshCw size={14} className="animate-spin" /> Running...</> : <><Play size={14} /> Run Log</>}
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            <Editor
                                height="100%"
                                language="javascript"
                                theme="vs-dark"
                                value={editing.code}
                                onChange={v => setEditing(p => ({ ...p, code: v || '' }))}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 12,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 4,
                                }}
                            />
                        </div>
                        {runResult && (
                            <div className="h-[150px] font-mono text-[0.75rem] overflow-y-auto p-3 shadow-inner" style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)', color: 'var(--fg)' }}>
                                <div className={`mb-3 flex items-center gap-2 font-bold ${runResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    <span className="w-2 h-2 rounded-full border border-current bg-current"></span>
                                    {runResult.success ? 'Task Completed' : 'Task Failed'} {runResult.error && `- ${runResult.error}`}
                                </div>
                                {runResult.logs && runResult.logs.map((l, i) => (
                                    <div key={i} className="mb-1">
                                        <span className="mr-3" style={{ color: 'var(--muted)' }}>[{new Date(l.time).toLocaleTimeString()}]</span>
                                        <span style={{ color: 'var(--fg)' }}>{l.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                        Select a script to edit, or create a new one
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
