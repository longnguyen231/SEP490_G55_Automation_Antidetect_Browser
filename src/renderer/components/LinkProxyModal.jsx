import React, { useState, useEffect } from 'react';

export default function LinkProxyModal({ profile, onClose, onLink }) {
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProxies() {
      try {
        const list = await window.electronAPI?.getProxies();
        setProxies(list || []);
      } catch (err) {
        console.error('Failed to fetch proxies proxy list', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProxies();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[999]" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[480px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 pb-3">
          <h2 className="text-xl font-semibold text-slate-800 leading-none">Link Proxy</h2>
          <p className="text-sm text-slate-500 mt-2">Profile: {profile?.name || 'Unknown'}</p>
        </div>

        <div className="p-5 pt-2 flex-1 max-h-[350px] overflow-y-auto">
          {(() => {
            const currentProxyType = profile?.settings?.proxy?.type;
            const currentProxyServer = profile?.settings?.proxy?.server;
            const hasCurrentProxy = currentProxyType && currentProxyType !== 'none' && currentProxyServer;

            return (
              <>
                {hasCurrentProxy && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#94a3b8] border border-[#64748b] shadow-sm">
                      <div className="text-sm text-[#e2e8f0] font-mono truncate">
                        <span className="font-semibold text-white mr-1">Current:</span> 
                        {currentProxyType.toUpperCase()} {currentProxyServer}
                      </div>
                      <button
                        className="text-[#ef4444] hover:text-[#dc2626] text-sm font-semibold px-2 transition-colors cursor-pointer"
                        onClick={() => onLink({ type: 'none' })}
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                )}
                
                {loading ? (
                  <div className="text-center py-6 text-slate-400">Loading proxies...</div>
                ) : proxies.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">No proxies available. Create one in the Proxies tab.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {proxies.map(p => {
                      const proxyType = (p.type || p.protocol || 'http').toUpperCase();
                      const hostStr = p.host || p.name;
                      const rawServer = p.port ? (hostStr.includes(':') ? hostStr : `${hostStr}:${p.port}`) : hostStr;
                      const isLinked = hasCurrentProxy && currentProxyServer === rawServer;
                      
                      return (
                        <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${isLinked ? 'bg-[#cbd5e1] border-[#60a5fa]' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${isLinked ? 'bg-[#94a3b8] text-white' : 'bg-[#e2e8f0] text-slate-600'}`}>
                              {proxyType}
                            </span>
                            <div className={`text-sm truncate font-mono ${isLinked ? 'text-slate-800' : 'text-slate-700'}`}>
                              {p.name && p.name !== p.host ? `${p.name} ` : ''}
                              {p.host}{p.port ? `:${p.port}` : ''}
                            </div>
                          </div>
                          {isLinked ? (
                            <span className="text-[#3b82f6] text-sm font-medium px-3 py-1">
                              Linked
                            </span>
                          ) : (
                            <button
                              className="text-[#64748b] hover:text-[#0f172a] text-sm font-medium px-3 py-1 transition-colors"
                              onClick={() => {
                                const finalType = (p.type || p.protocol || 'http').toLowerCase();
                                onLink({ ...p, type: finalType, server: rawServer });
                              }}
                            >
                              Link
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="p-4 flex justify-end">
           <button className="bg-[#cbd5e1] hover:bg-[#94a3b8] text-white font-medium text-[13px] px-4 py-1.5 rounded transition" onClick={onClose}>
             Close
           </button>
        </div>
      </div>
    </div>
  );
}
