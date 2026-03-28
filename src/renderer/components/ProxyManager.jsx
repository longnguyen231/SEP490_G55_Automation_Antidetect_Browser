import React, { useState, useEffect } from 'react';
import {
    Network, Plus, Upload, Search, Trash2, Edit2, CheckCircle2,
    XCircle, AlertCircle, HelpCircle, X, Zap, Loader2
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
    const [checkingIds, setCheckingIds] = useState(new Set()); // proxy IDs currently being checked
    const [checkingAll, setCheckingAll] = useState(false);

    const handleCheckOne = async (proxy) => {
        setCheckingIds(prev => new Set([...prev, proxy.id]));
        try {
            const result = await window.electronAPI.checkProxy({
                type: proxy.type || proxy.protocol || 'http',
                host: proxy.host,
                port: Number(proxy.port),
                username: proxy.username || '',
                password: proxy.password || '',
            });
            // Update proxy in backend
            if (result) {
                await window.electronAPI.updateProxy(proxy.id, {
                    status: result.alive ? 'alive' : 'dead',
                    latency: result.latency || null,
                    lastChecked: new Date().toISOString(),
                    country: result.countryCode || '',
                });
            }
            await loadProxies();
        } catch (e) {
            console.error('Check proxy failed:', e);
        } finally {
            setCheckingIds(prev => { const s = new Set(prev); s.delete(proxy.id); return s; });
        }
    };

    const handleCheckAll = async () => {
        setCheckingAll(true);
        try {
            await window.electronAPI.checkAllProxies();
            await loadProxies();
        } catch (e) {
            alert('Check all failed: ' + e.message);
        } finally {
            setCheckingAll(false);
        }
    };

    // Load proxies from backend on mount
    useEffect(() => {
        loadProxies();
    }, []);

    const loadProxies = async () => {
        try {
            const list = await window.electronAPI.getProxies();
            // Map backend 'type' field to UI 'protocol' for display
            setProxies((Array.isArray(list) ? list : []).map(p => ({
                ...p,
                protocol: p.type || p.protocol || 'http',
            })));
        } catch (e) {
            console.error('Failed to load proxies:', e);
        }
    };

    const handleAddSubmit = async (formData) => {
        try {
            const res = await window.electronAPI.createProxy({
                name: formData.name,
                type: formData.protocol || 'http',
                host: formData.host,
                port: Number(formData.port),
                username: formData.username || '',
                password: formData.password || '',
            });
            if (res?.success) {
                await loadProxies();
                setShowForm(false);
            } else {
                alert(res?.error || 'Create proxy failed');
            }
        } catch (e) {
            alert('Error creating proxy: ' + e.message);
        }
    };

    const handleUpdateSubmit = async (formData) => {
        try {
            const res = await window.electronAPI.updateProxy(formData.id, {
                name: formData.name,
                type: formData.protocol || formData.type,
                host: formData.host,
                port: Number(formData.port),
                username: formData.username || '',
                password: formData.password || '',
            });
            if (res?.success) {
                await loadProxies();
                setShowForm(false);
                setEditingProxy(null);
            } else {
                alert(res?.error || 'Update proxy failed');
            }
        } catch (e) {
            alert('Error updating proxy: ' + e.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('proxies.delete.confirm') || 'Delete this proxy?')) {
            try {
                const res = await window.electronAPI.deleteProxy(id);
                if (res?.success) {
                    await loadProxies();
                } else {
                    alert(res?.error || 'Delete failed');
                }
            } catch (e) {
                alert('Error deleting proxy: ' + e.message);
            }
        }
    };

    const handleImportSubmit = async (textData) => {
        try {
            const res = await window.electronAPI.importProxies(textData, 'auto');
            if (res?.success) {
                await loadProxies();
                setShowImport(false);
                alert(`Imported ${res.imported} proxies` + (res.skipped ? ` (${res.skipped} skipped)` : ''));
            } else {
                alert(res?.error || 'Import failed');
            }
        } catch (e) {
            alert('Error importing proxies: ' + e.message);
        }
    };

    const filteredProxies = proxies.filter(p => {
        const q = search.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) ||
            (p.host || '').toLowerCase().includes(q);
    });

    return (
        <div className="w-full h-full flex flex-col p-4" style={{ background: 'var(--bg)' }}>
            {/* Header Area */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-[1.2rem] font-bold" style={{ color: 'var(--fg)' }}>Proxy Pool</h1>
                <div className="flex items-center gap-3">
                    <button 
                        className="btn btn-secondary text-[0.75rem]"
                        onClick={() => setShowImport(true)}
                    >
                        Import Excel
                    </button>
                    <button 
                        className="btn btn-secondary text-[0.75rem]"
                        onClick={() => {}}
                        disabled={proxies.length === 0}
                    >
                        Export Excel
                    </button>
                    <button 
                        className="btn btn-primary text-[0.75rem]"
                        onClick={() => { setEditingProxy(null); setShowForm(true); }}
                    >
                        + Add Proxy
                    </button>
                </div>
            </div>

            {/* List or Empty State */}
            <div className="flex-1 flex flex-col w-full">
                {proxies.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 relative top-[-40px]">
                        <h3 className="text-[1.125rem] font-semibold" style={{ color: 'var(--muted)' }}>No proxies yet</h3>
                        <p className="text-[0.875rem]" style={{ color: 'var(--muted)' }}>Add a proxy or import from Excel.</p>
                    </div>
                ) : (
                    <div className="w-full rounded-lg overflow-hidden flex-1" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                        <ProxyTable
                            proxies={filteredProxies}
                            onEdit={(p) => { setEditingProxy(p); setShowForm(true); }}
                            onDelete={handleDelete}
                            onCheck={handleCheckOne}
                            checkingIds={checkingIds}
                            t={t}
                        />
                    </div>
                )}
            </div>

            {showForm && (
                <ProxyFormModal
                    proxy={editingProxy}
                    onSave={editingProxy ? handleUpdateSubmit : handleAddSubmit}
                    onClose={() => { setShowForm(false); setEditingProxy(null); }}
                    t={t}
                />
            )}

            {showImport && (
                <ProxyImportModal
                    onImport={handleImportSubmit}
                    onClose={() => setShowImport(false)}
                    t={t}
                />
            )}
        </div>
    );
}

function ProxyTable({ proxies, onEdit, onDelete, onCheck, checkingIds, t }) {
    const getStatusIcon = (status) => {
        switch (status) {
            case 'alive': return <CheckCircle2 size={14} />;
            case 'dead': return <XCircle size={14} />;
            case 'unchecked':
            default: return <HelpCircle size={14} />;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'alive': return 'status-active';
            case 'dead': return 'status-error';
            case 'unchecked':
            default: return 'status-untested';
        }
    };

    return (
        <div className="proxy-table-wrapper">
            <table className="proxy-table">
                <thead>
                    <tr>
                        <th>{t('proxies.col.name')}</th>
                        <th>{t('proxies.col.protocol')}</th>
                        <th>{t('proxies.col.host')}</th>
                        <th>{t('proxies.col.status')}</th>
                        <th>Latency</th>
                        <th>Country</th>
                        <th style={{ textAlign: 'right' }}>{t('proxies.col.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {proxies.map(p => {
                        const isChecking = checkingIds?.has(p.id);
                        return (
                            <tr key={p.id}>
                                <td><strong>{p.name}</strong></td>
                                <td><span style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>{p.protocol || 'http'}</span></td>
                                <td>
                                    <span style={{ fontFamily: 'monospace' }}>
                                        {p.username ? `${p.username}:***@` : ''}{p.host}:{p.port}
                                    </span>
                                </td>
                                <td>
                                    <span className={`proxy-status ${getStatusClass(p.status)}`}>
                                        {getStatusIcon(p.status)} {p.status || 'unchecked'}
                                    </span>
                                </td>
                                <td>
                                    {p.latency != null ? (
                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.latency}ms</span>
                                    ) : '—'}
                                </td>
                                <td>{p.country || '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        className="btn-icon-primary"
                                        onClick={() => onCheck(p)}
                                        disabled={isChecking}
                                        title="Check proxy"
                                    >
                                        {isChecking ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                                    </button>
                                    <button className="btn-icon-primary" onClick={() => onEdit(p)} title={t('proxies.form.title.edit')}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="btn-icon-danger" onClick={() => onDelete(p.id)} title={t('proxies.delete.confirm')}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function ProxyFormModal({ proxy, onSave, onClose, t }) {
    const [formData, setFormData] = useState(proxy ? {
        ...proxy,
        protocol: proxy.protocol || proxy.type || 'http',
        port: proxy.port || '',
    } : {
        name: '', protocol: 'http', host: '', port: '', username: '', password: ''
    });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await onSave(formData);
        } catch (err) {
            alert('Error: ' + (err?.message || err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[999] p-4" style={{ background: 'var(--overlay-bg)' }} onClick={onClose}>
            <div className="rounded-xl w-full max-w-[440px] p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} onClick={e => e.stopPropagation()}>
                <h2 className="text-[1.35rem] font-bold mb-6 tracking-tight" style={{ color: 'var(--fg)' }}>
                    {proxy ? 'Edit Proxy' : 'Add Proxy'}
                </h2>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Label (optional)</label>
                        <input type="text" name="name" className="w-full text-[0.9rem] rounded-[0.5rem] px-3 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} placeholder="e.g. US Residential #1" value={formData.name} onChange={handleChange} />
                    </div>

                    <div className="flex gap-4">
                        <div className="w-1/3">
                            <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Type</label>
                            <select name="protocol" className="w-full text-[0.9rem] rounded-[0.5rem] px-3 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} value={formData.protocol} onChange={handleChange}>
                                <option value="http">HTTP</option>
                                <option value="https">HTTPS</option>
                                <option value="socks4">SOCKS4</option>
                                <option value="socks5">SOCKS5</option>
                            </select>
                        </div>
                        <div className="w-2/3">
                            <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Port</label>
                            <input type="text" name="port" className="w-full text-[0.9rem] rounded-[0.5rem] px-3 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} placeholder="8080" value={formData.port} onChange={handleChange} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Host / IP</label>
                        <input type="text" name="host" className="w-full text-[0.9rem] rounded-[0.5rem] px-3 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} placeholder="proxy.example.com" value={formData.host} onChange={handleChange} required />
                    </div>

                    <div className="flex gap-4 mb-2">
                        <div className="w-1/2">
                            <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Username (optional)</label>
                            <input type="text" name="username" className="w-full text-[0.9rem] rounded-[0.5rem] px-3 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} placeholder="user" value={formData.username || ''} onChange={handleChange} />
                        </div>
                        <div className="w-1/2 relative">
                            <label className="block text-[0.8rem] font-semibold text-slate-500 mb-1.5">Password (optional)</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} name="password" className="w-full text-[0.9rem] rounded-[0.5rem] pl-3 pr-12 py-2.5 transition" style={{ background: 'var(--glass-input)', border: '1px solid var(--border2)', color: 'var(--fg)' }} placeholder="••••••••" value={formData.password || ''} onChange={handleChange} />
                                <button type="button" className="absolute right-3 top-[0.6rem] text-[0.85rem] font-medium" style={{ color: 'var(--muted)' }} onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" className="btn btn-secondary px-6 py-2.5 text-[0.85rem]" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary px-7 py-2.5 text-[0.85rem]" disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ProxyImportModal({ onImport, onClose, t }) {
    const [text, setText] = useState('');

    const submit = (e) => {
        e.preventDefault();
        if (text.trim()) onImport(text);
    };

    return (
        <div className="proxy-modal-backdrop" onClick={onClose}>
            <div className="proxy-modal-content" onClick={e => e.stopPropagation()}>
                <div className="proxy-modal-header">
                    <h2 className="proxy-modal-title">{t('proxies.import.title')}</h2>
                    <button className="btn-icon-danger" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="proxy-form-group">
                        <label className="proxy-form-label">{t('proxies.import.format')}</label>
                        <textarea
                            className="proxy-form-control"
                            placeholder={t('proxies.import.placeholder')}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                        ></textarea>
                    </div>
                    <div className="proxy-modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('proxies.form.cancel')}</button>
                        <button type="submit" className="btn btn-primary">{t('proxies.import.btn')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
