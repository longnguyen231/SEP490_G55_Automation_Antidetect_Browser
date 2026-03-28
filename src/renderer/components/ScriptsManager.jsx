import React, { useState, useEffect, useCallback } from 'react';
import { Play, Plus, Trash2, Search, FileCode, RefreshCw } from 'lucide-react';
import Editor from '@monaco-editor/react';

const DEFAULT_CODE = `// Automation Script\n// Available: page, cdp, context, profileId, log(), sleep()\n\nawait page.goto("https://example.com");\nconst title = await page.title();\nlog("Page title:", title);\n`;

export default function ScriptsManager({ profiles = [] }) {
    const [activeTab, setActiveTab] = useState('scripts');

    return (
        <div className="w-full h-full flex flex-col p-4 bg-[#f1f5f9] dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <h1 className="text-[1.2rem] font-bold text-slate-800 dark:text-slate-100">Scripts & Tasks</h1>
                <div className="flex bg-[#e2e8f0] dark:bg-slate-800 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'scripts' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        onClick={() => setActiveTab('scripts')}
                    >
                        Scripts
                    </button>
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Task Logs
                    </button>
                    <button
                        className={`px-3 py-1 text-[0.75rem] font-medium rounded transition ${activeTab === 'modules' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
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
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {/* Left Sidebar */}
            <div className="w-[300px] bg-[#f8fafc] dark:bg-slate-800/80 flex flex-col justify-between">
                <div>
                    {!filtered.length && scripts.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-[0.75rem] mt-2">
                            No scripts yet. Create one to get started.
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            <div className="px-3 py-2 relative border-b border-slate-100 dark:border-slate-700">
                                <Search size={13} className="absolute left-6 top-[0.85rem] text-slate-400" />
                                <input
                                    placeholder="Search scripts..."
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-[0.75rem] text-slate-800 dark:text-slate-200 px-7 py-1 focus:outline-none focus:border-blue-400"
                                />
                            </div>
                            <div className="py-2">
                                {filtered.map(s => (
                                    <div
                                        key={s.id}
                                        className={`px-3 py-1.5 cursor-pointer border-l-4 transition flex justify-between items-center group
                                            ${selectedId === s.id ? 'bg-white dark:bg-slate-700 border-[#2563eb] text-[#2563eb] dark:text-blue-400 shadow-sm' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                                        onClick={() => handleSelect(s)}
                                    >
                                        <div className="font-medium text-[0.75rem] truncate pr-2 dark:text-slate-200">{s.name || '(untitled)'}</div>
                                        <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                                            <button className="p-1 hover:bg-blue-100 text-blue-600 rounded" title={'Run'} onClick={e => { e.stopPropagation(); handleSelect(s); handleRun(s.id); }}>
                                                <Play size={13} />
                                            </button>
                                            <button className="p-1 hover:bg-red-100 text-red-500 rounded" title={'Delete'} onClick={e => handleDelete(s.id, e)}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-10">
                    <button className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-medium py-1.5 rounded text-[0.75rem] mb-2" onClick={handleNew}>
                        + New Script
                    </button>
                    <div className="flex gap-2">
                        <button className="flex-1 bg-[#e2e8f0] dark:bg-slate-700 hover:bg-[#cbd5e1] dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-medium py-1 rounded text-[0.7rem] transition">Export JSON</button>
                        <button className="flex-1 bg-[#e2e8f0] dark:bg-slate-700 hover:bg-[#cbd5e1] dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-medium py-1 rounded text-[0.7rem] transition">Import JSON</button>
                    </div>
                </div>
            </div>

            {/* Right Editor Area */}
            <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col">
                {editing ? (
                    <div className="flex flex-col h-full">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 flex gap-3 items-center">
                            <input
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-[0.75rem] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-400"
                                value={editing.name}
                                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                placeholder="Script Name"
                            />
                            <select
                                className="w-[180px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-[0.75rem] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-400"
                                value={runProfileId}
                                onChange={e => setRunProfileId(e.target.value)}
                            >
                                <option value="">Select profile to run...</option>
                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                            </select>
                            <button className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1 rounded text-[0.75rem] font-medium transition" onClick={handleSave}>
                                Save
                            </button>
                            <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-[0.75rem] font-medium transition flex items-center gap-1" onClick={() => handleRun()} disabled={running}>
                                {running ? <><RefreshCw size={14} className="animate-spin" /> Running...</> : <><Play size={14} /> Run Log</>}
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            <Editor
                                height="100%"
                                language="javascript"
                                theme="vs-light"
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
                            <div className="h-[150px] border-t border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[0.75rem] overflow-y-auto p-3 shadow-inner">
                                <div className={`mb-3 flex items-center gap-2 font-bold ${runResult.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    <span className="w-2 h-2 rounded-full border border-current bg-current"></span>
                                    {runResult.success ? 'Task Completed' : 'Task Failed'} {runResult.error && `- ${runResult.error}`}
                                </div>
                                {runResult.logs && runResult.logs.map((l, i) => (
                                    <div key={i} className="mb-1">
                                        <span className="text-slate-400 dark:text-slate-500 mr-3">[{new Date(l.time).toLocaleTimeString()}]</span>
                                        <span className="text-slate-700 dark:text-slate-300">{l.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-[0.75rem]">
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
        <div className="flex-1 flex flex-row rounded-lg gap-[1px] bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {/* Left Sidebar */}
            <div className="w-[300px] bg-[#f8fafc] dark:bg-slate-800 flex flex-col">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800">
                    <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">Tasks ({tasks.length})</span>
                </div>
                <div className="flex-1 p-4 text-slate-400 dark:text-slate-500 text-[0.75rem]">
                    No tasks yet. Run a script to create one.
                </div>
            </div>

            {/* Right Output Area */}
            <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                    <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">Select a task</span>
                    <label className="flex items-center gap-2 text-[0.75rem] text-slate-500 dark:text-slate-400 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-700 text-blue-500 focus:ring-blue-500" />
                        Auto-scroll
                    </label>
                </div>
                <div className="flex-1 p-4 font-mono text-[0.75rem] text-slate-400 dark:text-slate-500">
                    Select a task to view its output.
                </div>
            </div>
        </div>
    );
}

function ScriptModulesTab() {
    return (
        <div className="w-full flex-1">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm w-full">
                <p className="text-[0.8rem] text-slate-600 dark:text-slate-300 mb-4">
                    Install npm packages for use in automation scripts via <code className="text-slate-800 dark:text-slate-200 font-mono text-[0.75rem]">require('package-name')</code>.
                </p>
                <div className="flex gap-3 mb-4">
                    <input 
                        type="text" 
                        placeholder="e.g. axios or lodash@4" 
                        className="flex-1 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-[0.75rem] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition shadow-inner"
                    />
                    <button className="bg-[#7fa1f9] hover:bg-[#6b8bea] text-white font-medium px-4 py-1.5 rounded-md transition shadow-sm text-[0.75rem]">
                        Install
                    </button>
                </div>
                <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic">
                    No modules installed.
                </p>
            </div>
        </div>
    );
}
