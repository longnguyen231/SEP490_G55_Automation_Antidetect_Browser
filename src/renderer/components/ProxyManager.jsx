import React, { useState, useEffect } from 'react';
import {
    Network, Plus, Upload, Download, Search, Trash2, Edit2, CheckCircle2,
    XCircle, HelpCircle, X, Zap, Loader2, RefreshCcw, Shield, Globe
} from 'lucide-react';
import { useI18n } from '../i18n';
import './ProxyManager.css';

export default function ProxyManager() {
    const { t } = useI18n();
    const [proxies, setProxies] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingProxy, setEditingProxy] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [checkingIds, setCheckingIds] = useState(new Set());
    const [rotatingIds, setRotatingIds] = useState(new Set());
    const [checkingAll, setCheckingAll] = useState(false);

    useEffect(() => { loadProxies(); }, []);

    const loadProxies = async () => {
        try {
            const list = await window.electronAPI.getProxies();
            setProxies((Array.isArray(list) ? list : []).map(p => ({
                ...p, protocol: p.type || p.protocol || 'http',
            })));
        } catch (e) { console.error('Failed to load proxies:', e); }
    };

    // ── Stats ──
    const stats = {
        total: proxies.length,
        alive: proxies.filter(p => p.status === 'alive').length,
        dead: proxies.filter(p => p.status === 'dead').length,
        unknown: proxies.filter(p => !p.status || p.status === 'unchecked').length,
    };

    // ── Selection ──
    const toggleSelect = (id) => setSelectedIds(prev => {
        const s = new Set(prev);
        s.has(id) ? s.delete(id) : s.add(id);
        return s;
    });
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProxies.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredProxies.map(p => p.id)));
    };
    const clearSelection = () => setSelectedIds(new Set());

    // ── CRUD ──
    const handleAddSubmit = async (formData) => {
        try {
            const res = await window.electronAPI.createProxy({
                name: formData.name, type: formData.protocol || 'http',
                host: formData.host, port: Number(formData.port),
                username: formData.username || '', password: formData.password || '',
                rotateUrl: formData.rotateUrl || '',
            });
            if (res?.success) { await loadProxies(); setShowForm(false); }
            else alert(res?.error || 'Create failed');
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleUpdateSubmit = async (formData) => {
        try {
            const res = await window.electronAPI.updateProxy(formData.id, {
                name: formData.name, type: formData.protocol || formData.type,
                host: formData.host, port: Number(formData.port),
                username: formData.username || '', password: formData.password || '',
                rotateUrl: formData.rotateUrl || '',
            });
            if (res?.success) { await loadProxies(); setShowForm(false); setEditingProxy(null); }
            else alert(res?.error || 'Update failed');
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this proxy?')) return;
        try {
            const res = await window.electronAPI.deleteProxy(id);
            if (res?.success) await loadProxies();
            else alert(res?.error || 'Delete failed');
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleDeleteSelected = async () => {
        if (!selectedIds.size) return;
        if (!window.confirm(`Delete ${selectedIds.size} selected proxy(es)?`)) return;
        try {
            const ids = [...selectedIds];
            if (window.electronAPI.deleteProxiesBulk) {
                await window.electronAPI.deleteProxiesBulk(ids);
            } else {
                await Promise.all(ids.map(id => window.electronAPI.deleteProxy(id)));
            }
            setSelectedIds(new Set());
            await loadProxies();
        } catch (e) { alert('Bulk delete error: ' + e.message); }
    };

    // ── Check / Rotate ──
    const handleCheckOne = async (proxy) => {
        setCheckingIds(prev => new Set([...prev, proxy.id]));
        try {
            const result = await window.electronAPI.checkProxy({
                type: proxy.type || proxy.protocol || 'http',
                host: proxy.host, port: Number(proxy.port),
                username: proxy.username || '', password: proxy.password || '',
            });
            if (result) {
                await window.electronAPI.updateProxy(proxy.id, {
                    status: result.alive ? 'alive' : 'dead',
                    latency: result.latency || null,
                    lastChecked: new Date().toISOString(),
                    country: result.country || result.countryCode || '',
                    countryCode: result.countryCode || '',
                    ip: result.ip || '',
                    city: result.city || '',
                });
            }
            await loadProxies();
        } catch (e) { console.error('Check failed:', e); }
        finally { setCheckingIds(prev => { const s = new Set(prev); s.delete(proxy.id); return s; }); }
    };

    const handleCheckAll = async () => {
        setCheckingAll(true);
        try { await window.electronAPI.checkAllProxies(); await loadProxies(); }
        catch (e) { alert('Check all failed: ' + e.message); }
        finally { setCheckingAll(false); }
    };

    const handleCheckSelected = async () => {
        const selected = proxies.filter(p => selectedIds.has(p.id));
        for (const p of selected) await handleCheckOne(p);
    };

    const handleRotateOne = async (proxy) => {
        if (!proxy.rotateUrl) { alert('No rotation URL for this proxy.'); return; }
        setRotatingIds(prev => new Set([...prev, proxy.id]));
        try {
            const result = await window.electronAPI.rotateProxy(proxy.id);
            if (!result?.success) alert('Rotate failed: ' + (result?.error || 'Unknown'));
        } catch (e) { alert('Rotate failed: ' + e.message); }
        finally { setRotatingIds(prev => { const s = new Set(prev); s.delete(proxy.id); return s; }); }
    };

    // ── Import / Export ──
    const handleImportSubmit = async (textData) => {
        try {
            const res = await window.electronAPI.importProxies(textData, 'auto');
            if (res?.success) {
                await loadProxies(); setShowImport(false);
                alert(`Imported ${res.imported} proxies` + (res.skipped ? ` (${res.skipped} skipped)` : ''));
            } else alert(res?.error || 'Import failed');
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleExport = async () => {
        try {
            const ids = selectedIds.size > 0 ? [...selectedIds] : proxies.map(p => p.id);
            const res = await window.electronAPI.exportProxies(ids);
            if (res?.success && res.data) {
                const blob = new Blob([res.data], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'proxies-export.txt';
                a.click();
            } else {
                // Fallback: export manually
                const toExport = proxies.filter(p => ids.includes(p.id));
                const text = toExport.map(p => {
                    const auth = p.username ? `${p.username}:${p.password || ''}@` : '';
                    return `${p.protocol || 'http'}://${auth}${p.host}:${p.port}`;
                }).join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'proxies-export.txt';
                a.click();
            }
        } catch (e) { alert('Export error: ' + e.message); }
    };

    const filteredProxies = proxies.filter(p => {
        const q = search.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) ||
            (p.host || '').toLowerCase().includes(q) ||
            (p.country || '').toLowerCase().includes(q);
    });

    return (
        <div className="w-full h-full flex flex-col p-4" style={{ background: 'var(--bg)' }}>
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <Shield size={22} style={{ color: 'var(--primary)' }} />
                    <h1 className="text-[1.15rem] font-bold" style={{ color: 'var(--fg)' }}>Proxy Pool</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-secondary text-[0.72rem] flex items-center gap-1" onClick={() => setShowImport(true)}>
                        <Upload size={13} /> Import
                    </button>
                    <button className="btn btn-secondary text-[0.72rem] flex items-center gap-1" onClick={handleExport} disabled={proxies.length === 0}>
                        <Download size={13} /> Export
                    </button>
                    <button className="btn btn-success text-[0.72rem] flex items-center gap-1" onClick={() => { setEditingProxy(null); setShowForm(true); }}>
                        <Plus size={14} /> Add Proxy
                    </button>
                </div>
            </div>

            {/* ── Stats Bar ── */}
            {proxies.length > 0 && (
                <div className="flex gap-3 mb-3">
                    {[
                        { label: 'Total', value: stats.total, color: 'var(--primary)', bg: 'rgba(59,130,246,0.08)' },
                        { label: 'Alive', value: stats.alive, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                        { label: 'Dead', value: stats.dead, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                        { label: 'Unchecked', value: stats.unknown, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
                            <span className="text-[0.7rem] font-medium" style={{ color: s.color }}>{s.label}</span>
                            <span className="text-[0.85rem] font-bold" style={{ color: s.color }}>{s.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Search + Actions Bar ── */}
            {proxies.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-[0.55rem]" style={{ color: 'var(--muted)' }} />
                        <input placeholder="Search by name, host, country..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg pl-9 pr-3 py-2 text-[0.75rem]"
                            style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} />
                        {search && <button className="absolute right-3 top-[0.55rem]" onClick={() => setSearch('')} style={{ color: 'var(--muted)' }}><X size={14} /></button>}
                    </div>
                    <button className="btn btn-secondary text-[0.72rem] flex items-center gap-1 whitespace-nowrap" onClick={handleCheckAll} disabled={checkingAll}>
                        {checkingAll ? <><Loader2 size={13} className="animate-spin" /> Checking...</> : <><Zap size={13} /> Check All</>}
                    </button>
                    {selectedIds.size > 0 && (
                        <>
                            <button className="btn btn-secondary text-[0.72rem] flex items-center gap-1 whitespace-nowrap" onClick={handleCheckSelected}>
                                <Zap size={13} /> Check ({selectedIds.size})
                            </button>
                            <button className="text-[0.72rem] flex items-center gap-1 px-3 py-1.5 rounded-md whitespace-nowrap transition hover:brightness-110"
                                style={{ background: '#ef4444', color: '#fff' }} onClick={handleDeleteSelected}>
                                <Trash2 size={13} /> Delete ({selectedIds.size})
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ── Table or Empty State ── */}
            <div className="flex-1 flex flex-col w-full min-h-0">
                {proxies.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-strong)' }}>
                            <Network size={32} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
                        </div>
                        <h3 className="text-[1rem] font-semibold" style={{ color: 'var(--fg)' }}>No proxies yet</h3>
                        <p className="text-[0.8rem] max-w-[300px]" style={{ color: 'var(--muted)' }}>
                            Add proxies manually or import from a text file. Supported formats: host:port, user:pass@host:port
                        </p>
                        <div className="flex gap-2 mt-2">
                            <button className="btn btn-success text-[0.75rem] flex items-center gap-1" onClick={() => { setEditingProxy(null); setShowForm(true); }}>
                                <Plus size={14} /> Add Proxy
                            </button>
                            <button className="btn btn-secondary text-[0.75rem] flex items-center gap-1" onClick={() => setShowImport(true)}>
                                <Upload size={14} /> Import
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg overflow-hidden flex-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                        <div className="overflow-auto h-full">
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th className="px-3 py-2.5 text-left w-[40px]">
                                            <input type="checkbox"
                                                checked={selectedIds.size === filteredProxies.length && filteredProxies.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Name</th>
                                        <th className="px-3 py-2.5 text-left text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Type</th>
                                        <th className="px-3 py-2.5 text-left text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Host : Port</th>
                                        <th className="px-3 py-2.5 text-left text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Status</th>
                                        <th className="px-3 py-2.5 text-left text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Country</th>
                                        <th className="px-3 py-2.5 text-right text-[0.72rem] font-semibold" style={{ color: 'var(--fg)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProxies.map((p, i) => {
                                        const isChecking = checkingIds.has(p.id);
                                        const isRotating = rotatingIds.has(p.id);
                                        const isSelected = selectedIds.has(p.id);
                                        return (
                                            <tr key={p.id}
                                                className="group transition-colors"
                                                style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    background: isSelected ? 'rgba(59,130,246,0.05)' : i % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'rgba(59,130,246,0.05)' : i % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent'}
                                            >
                                                <td className="px-3 py-2">
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                                                        className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-[0.78rem] font-medium" style={{ color: 'var(--fg)' }}>{p.name || '—'}</span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="px-2 py-0.5 rounded text-[0.62rem] font-bold uppercase tracking-wide"
                                                        style={{ background: 'var(--glass-strong)', color: 'var(--muted)' }}>
                                                        {p.protocol || 'http'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <code className="text-[0.75rem]" style={{ color: 'var(--muted)' }}>
                                                        {p.username ? `${p.username}:***@` : ''}{p.host}:{p.port}
                                                    </code>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusBadge status={p.status} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    {p.country
                                                        ? <span className="text-[0.75rem] flex items-center gap-1" style={{ color: 'var(--fg)' }}>
                                                            {p.countryCode && p.countryCode.length === 2
                                                                ? <span style={{ fontSize: '1rem' }}>{String.fromCodePoint(...[...p.countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))}</span>
                                                                : <Globe size={12} />
                                                            }
                                                            {p.country}
                                                          </span>
                                                        : <span className="text-[0.72rem]" style={{ color: 'var(--muted)' }}>—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex gap-1 justify-end items-center">
                                                        {p.rotateUrl && (
                                                            <button className="p-1.5 rounded-md transition hover:bg-white/10" title="Rotate IP"
                                                                style={{ color: '#8b5cf6' }} disabled={isRotating} onClick={() => handleRotateOne(p)}>
                                                                {isRotating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                                                            </button>
                                                        )}
                                                        <button className="p-1.5 rounded-md transition hover:bg-white/10" title="Check proxy"
                                                            style={{ color: '#f59e0b' }} disabled={isChecking} onClick={() => handleCheckOne(p)}>
                                                            {isChecking ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                                        </button>
                                                        <button className="p-1.5 rounded-md transition hover:bg-white/10" title="Edit"
                                                            style={{ color: 'var(--primary)' }} onClick={() => { setEditingProxy(p); setShowForm(true); }}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button className="p-1.5 rounded-md transition hover:bg-white/10" title="Delete"
                                                            style={{ color: '#ef4444' }} onClick={() => handleDelete(p.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredProxies.length === 0 && proxies.length > 0 && (
                                <div className="p-8 text-center text-[0.8rem]" style={{ color: 'var(--muted)' }}>
                                    No proxies match "{search}"
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom Selection Bar ── */}
            {selectedIds.size > 0 && (
                <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--glass-strong)', border: '1px solid var(--border)' }}>
                    <span className="text-[0.75rem] font-medium" style={{ color: 'var(--fg)' }}>
                        {selectedIds.size} of {filteredProxies.length} selected
                    </span>
                    <button className="text-[0.72rem] underline" style={{ color: 'var(--primary)' }} onClick={clearSelection}>Clear</button>
                </div>
            )}

            {/* ── Modals ── */}
            {showForm && (
                <ProxyFormModal
                    proxy={editingProxy}
                    onSave={editingProxy ? handleUpdateSubmit : handleAddSubmit}
                    onClose={() => { setShowForm(false); setEditingProxy(null); }}
                />
            )}
            {showImport && (
                <ProxyImportModal
                    onImport={handleImportSubmit}
                    onClose={() => setShowImport(false)}
                />
            )}
        </div>
    );
}

/* ── Status Badge Component ── */
function StatusBadge({ status }) {
    const config = {
        alive: { icon: <CheckCircle2 size={12} />, label: 'Alive', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        dead: { icon: <XCircle size={12} />, label: 'Dead', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    };
    const c = config[status] || { icon: <HelpCircle size={12} />, label: 'Unchecked', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.68rem] font-semibold"
            style={{ background: c.bg, color: c.color }}>
            {c.icon} {c.label}
        </span>
    );
}

/* ── Add/Edit Form Modal ── */
function ProxyFormModal({ proxy, onSave, onClose }) {
    const [formData, setFormData] = useState(proxy ? {
        ...proxy, protocol: proxy.protocol || proxy.type || 'http',
        port: proxy.port || '', rotateUrl: proxy.rotateUrl || '',
    } : { name: '', protocol: 'http', host: '', port: '', username: '', password: '', rotateUrl: '' });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try { await onSave(formData); } catch (err) { alert('Error: ' + (err?.message || err)); }
        finally { setSaving(false); }
    };

    const inputStyle = { background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="rounded-xl w-full max-w-[460px] shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h2 className="text-[1rem] font-bold" style={{ color: 'var(--fg)' }}>{proxy ? 'Edit Proxy' : 'Add New Proxy'}</h2>
                    <button className="p-1 rounded-md transition hover:bg-white/10" style={{ color: 'var(--muted)' }} onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={submit} className="px-6 py-4 flex flex-col gap-3.5">
                    <div>
                        <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Label (optional)</label>
                        <input type="text" name="name" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} placeholder="e.g. US Residential #1" value={formData.name} onChange={handleChange} />
                    </div>
                    <div className="flex gap-3">
                        <div className="w-[120px]">
                            <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Type</label>
                            <select name="protocol" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} value={formData.protocol} onChange={handleChange}>
                                <option value="http">HTTP</option>
                                <option value="https">HTTPS</option>
                                <option value="socks4">SOCKS4</option>
                                <option value="socks5">SOCKS5</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Host / IP</label>
                            <input type="text" name="host" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} placeholder="proxy.example.com" value={formData.host} onChange={handleChange} required />
                        </div>
                        <div className="w-[90px]">
                            <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Port</label>
                            <input type="text" name="port" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} placeholder="8080" value={formData.port} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Username</label>
                            <input type="text" name="username" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} placeholder="(optional)" value={formData.username || ''} onChange={handleChange} />
                        </div>
                        <div className="flex-1 relative">
                            <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Password</label>
                            <input type={showPassword ? 'text' : 'password'} name="password" className="w-full rounded-lg pl-3 pr-12 py-2 text-[0.8rem]" style={inputStyle} placeholder="(optional)" value={formData.password || ''} onChange={handleChange} />
                            <button type="button" className="absolute right-3 top-[1.7rem] text-[0.7rem] font-medium" style={{ color: 'var(--primary)' }} onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[0.72rem] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Rotate URL (optional)</label>
                        <input type="url" name="rotateUrl" className="w-full rounded-lg px-3 py-2 text-[0.8rem]" style={inputStyle} placeholder="https://api.proxy.com/rotate?key=..." value={formData.rotateUrl || ''} onChange={handleChange} />
                        <p className="text-[0.65rem] mt-1" style={{ color: 'var(--muted)' }}>API endpoint to rotate proxy IP with one click.</p>
                    </div>
                    <div className="flex justify-end gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <button type="button" className="btn btn-secondary text-[0.78rem] px-5 py-2" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-success text-[0.78rem] px-6 py-2" disabled={saving}>
                            {saving ? 'Saving...' : proxy ? 'Update' : 'Add Proxy'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ── Import Modal ── */
function ProxyImportModal({ onImport, onClose }) {
    const [text, setText] = useState('');

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="rounded-xl w-full max-w-[500px] shadow-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h2 className="text-[1rem] font-bold" style={{ color: 'var(--fg)' }}>Import Proxies</h2>
                    <button className="p-1 rounded-md transition hover:bg-white/10" style={{ color: 'var(--muted)' }} onClick={onClose}><X size={18} /></button>
                </div>
                <div className="px-6 py-4">
                    <p className="text-[0.75rem] mb-3" style={{ color: 'var(--muted)' }}>
                        Paste proxy list, one per line. Supported formats:
                    </p>
                    <div className="mb-3 p-2.5 rounded-lg text-[0.7rem] font-mono leading-relaxed" style={{ background: 'var(--glass-strong)', color: 'var(--muted)' }}>
                        host:port<br />
                        user:pass@host:port<br />
                        protocol://user:pass@host:port
                    </div>
                    <textarea
                        className="w-full rounded-lg px-3 py-2.5 text-[0.78rem] font-mono"
                        style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)', minHeight: 150, resize: 'vertical' }}
                        placeholder="1.2.3.4:8080&#10;user:pass@5.6.7.8:3128&#10;socks5://user:pass@9.10.11.12:1080"
                        value={text} onChange={e => setText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button className="btn btn-secondary text-[0.78rem] px-5 py-2" onClick={onClose}>Cancel</button>
                        <button className="btn btn-success text-[0.78rem] px-6 py-2" disabled={!text.trim()} onClick={() => { if (text.trim()) onImport(text); }}>
                            Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
