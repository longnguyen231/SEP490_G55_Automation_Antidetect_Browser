import React, { useState, useEffect, useRef } from 'react';

export default function AppLogsTab() {
    // Dynamic runtime state for logs.
    const [logs, setLogs] = useState([]);
    const [levelFilter, setLevelFilter] = useState('Trace+');
    const [autoScroll, setAutoScroll] = useState(true);
    const logsEndRef = useRef(null);
    const containerRef = useRef(null);

    // Capture console methods to provide actual runtime logs without hardcoding
    useEffect(() => {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;

        const addRuntimeLog = (level, args) => {
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            setLogs(prev => [...prev, { id: Date.now() + Math.random(), time, level, text }]);
        };

        console.log = (...args) => {
            addRuntimeLog('INF', args);
            originalLog(...args);
        };
        console.info = (...args) => {
            addRuntimeLog('INF', args);
            originalInfo(...args);
        };
        console.warn = (...args) => {
            addRuntimeLog('WRN', args);
            originalWarn(...args);
        };
        console.error = (...args) => {
            addRuntimeLog('ERR', args);
            originalError(...args);
        };

        // Hook into IPC channel if the backend streams logs
        let cleanupIpc = null;
        if (window.electronAPI && window.electronAPI.onAppLog) {
            cleanupIpc = window.electronAPI.onAppLog(logData => {
                 setLogs(prev => [...prev, { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('en-US', { hour12: false }), level: logData.level || 'INF', text: logData.message || '' }]);
            });
        }

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
            console.info = originalInfo;
            if (cleanupIpc) cleanupIpc();
        };
    }, []);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const handleClear = () => setLogs([]);

    const getLevelColor = (level) => {
        switch (level) {
            case 'INF': return 'text-blue-500 font-semibold';
            case 'WRN': return 'text-amber-500 font-semibold';
            case 'ERR': return 'text-red-500 font-semibold';
            case 'DBG': return 'text-slate-500 font-semibold';
            default: return 'text-slate-600 font-semibold';
        }
    };

    const filteredLogs = logs.filter(log => {
        if (levelFilter === 'Error+' && log.level !== 'ERR') return false;
        if (levelFilter === 'Warn+' && !['ERR', 'WRN'].includes(log.level)) return false;
        if (levelFilter === 'Info+' && !['ERR', 'WRN', 'INF'].includes(log.level)) return false;
        return true;
    });

    return (
        <div className="w-full h-full flex flex-col p-4" style={{ background: 'var(--bg)' }}>
            <h1 className="text-[1.2rem] font-bold mb-4 tracking-tight" style={{ color: 'var(--fg)' }}>Application Logs</h1>
            
            <div className="flex-1 rounded-xl flex flex-col overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {/* Header Toolbar */}
                <div className="flex justify-between items-center px-3 py-2" style={{ background: 'var(--card2)', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <select 
                                value={levelFilter}
                                onChange={e => setLevelFilter(e.target.value)}
                                className="appearance-none text-[0.75rem] rounded-md pl-2 pr-6 py-1 cursor-pointer"
                                style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
                            >
                                <option>Trace+</option>
                                <option>Debug+</option>
                                <option>Info+</option>
                                <option>Warn+</option>
                                <option>Error+</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-[0.75rem] font-medium cursor-pointer" style={{ color: 'var(--muted)' }}>
                            <input 
                                type="checkbox" 
                                checked={autoScroll} 
                                onChange={e => setAutoScroll(e.target.checked)}
                                className="rounded w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--primary)' }}
                            />
                            Auto-scroll
                        </label>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>{filteredLogs.length} entries</span>
                        <button 
                            onClick={handleClear}
                            className="btn btn-secondary text-[0.75rem]"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Terminal View */}
                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 font-mono text-[0.75rem] leading-relaxed" style={{ background: 'var(--card)' }}>
                    {filteredLogs.length === 0 ? (
                        <div className="italic" style={{ color: 'var(--muted)' }}>No logs currently available. Waiting for runtime events...</div>
                    ) : (
                        filteredLogs.map(log => (
                            <div key={log.id} className="flex gap-4 mb-1 px-2 py-0.5 -mx-2 rounded transition-colors group" style={{ '--hover-bg': 'var(--glass-hover)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <span className="min-w-[65px]" style={{ color: 'var(--muted)' }}>{log.time}</span>
                                <span className={`min-w-[35px] ${getLevelColor(log.level)}`}>{log.level}</span>
                                <span className="whitespace-pre-wrap break-all" style={{ color: 'var(--fg)' }}>{log.text}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
