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
        <div className="w-full h-full flex flex-col p-4 bg-[#f1f5f9]">
            <h1 className="text-[1.2rem] font-bold text-slate-800 mb-4 tracking-tight">Application Logs</h1>
            
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                {/* Header Toolbar */}
                <div className="flex justify-between items-center bg-[#f8fafc] border-b border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <select 
                                value={levelFilter}
                                onChange={e => setLevelFilter(e.target.value)}
                                className="appearance-none bg-white border border-slate-300 text-slate-700 text-[0.75rem] rounded-md pl-2 pr-6 py-1 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer shadow-sm"
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
                        <label className="flex items-center gap-2 text-[0.75rem] text-slate-600 font-medium cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={autoScroll} 
                                onChange={e => setAutoScroll(e.target.checked)}
                                className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            Auto-scroll
                        </label>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[0.75rem] text-slate-500">{filteredLogs.length} entries</span>
                        <button 
                            onClick={handleClear}
                            className="bg-[#e2e8f0] hover:bg-[#cbd5e1] text-slate-700 text-[0.75rem] font-medium px-3 py-1 rounded-md transition border border-slate-200 shadow-sm"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Terminal View */}
                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 font-mono text-[0.75rem] leading-relaxed bg-white">
                    {filteredLogs.length === 0 ? (
                        <div className="text-slate-400 italic">No logs currently available. Waiting for runtime events...</div>
                    ) : (
                        filteredLogs.map(log => (
                            <div key={log.id} className="flex gap-4 mb-1 hover:bg-slate-50 px-2 py-0.5 -mx-2 rounded transition-colors group">
                                <span className="text-slate-400 min-w-[65px]">{log.time}</span>
                                <span className={`min-w-[35px] ${getLevelColor(log.level)}`}>{log.level}</span>
                                <span className="text-slate-700 whitespace-pre-wrap break-all">{log.text}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
