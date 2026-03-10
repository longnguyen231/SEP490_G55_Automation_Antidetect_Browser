import React, { useState, useEffect } from 'react';
import {
    Network, Plus, Upload, Search, Trash2, Edit2, CheckCircle2,
    XCircle, AlertCircle, HelpCircle, X
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

    // Mock initial load
    useEffect(() => {
        // In actual implementation, fetch from API / IPC:
        // window.electronAPI.getProxies().then(setProxies)
        setProxies([
            { id: '1', name: 'US Datacenter 1', protocol: 'http', host: '192.168.1.1', port: '8080', status: 'active' },
            { id: '2', name: 'EU Residential', protocol: 'socks5', host: '10.0.0.1', port: '3128', status: 'error' },
            { id: '3', name: 'Testing node', protocol: 'https', host: '172.16.0.1', port: '443', status: 'untested' }
        ]);
    }, []);

    const handleAddSubmit = (formData) => {
        // Implementation for IPC save proxy
        const newProxy = {
            id: Date.now().toString(),
            status: 'untested',
            ...formData
        };
        setProxies([...proxies, newProxy]);
        setShowForm(false);
    };

    const handleUpdateSubmit = (formData) => {
        // Implementation for IPC update proxy
        setProxies(proxies.map(p => p.id === formData.id ? { ...p, ...formData } : p));
        setShowForm(false);
        setEditingProxy(null);
    };

    const handleDelete = (id) => {
        if (window.confirm(t('proxies.delete.confirm'))) {
            // Implementation for IPC delete proxy
            setProxies(proxies.filter(p => p.id !== id));
        }
    };

    const handleImportSubmit = (textData) => {
        // Basic parser for import (host:port:user:pass)
        const lines = textData.split('\n').map(l => l.trim()).filter(Boolean);
        const newProxies = lines.map((line, idx) => {
            const parts = line.split(':');
            let p = { id: `imp_${Date.now()}_${idx}`, status: 'untested', protocol: 'http', name: `Imported ${idx + 1}` };
            if (parts.length >= 2) {
                p.host = parts[0];
                p.port = parts[1];
            }
            if (parts.length >= 4) {
                p.username = parts[2];
                p.password = parts[3];
            }
            return p;
        });
        setProxies([...proxies, ...newProxies]);
        setShowImport(false);
    };

    const filteredProxies = proxies.filter(p => {
        const q = search.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) ||
            (p.host || '').toLowerCase().includes(q);
    });

    return (
        <div className="proxy-manager-container">
            <div className="proxy-manager-header">
                <h1 className="proxy-manager-title">{t('proxies.title')}</h1>
                <div className="proxy-actions">
                    <input
                        type="text"
                        className="proxy-search"
                        placeholder={t('proxies.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                        <Upload size={16} /> {t('proxies.import')}
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingProxy(null); setShowForm(true); }}>
                        <Plus size={16} /> {t('proxies.add')}
                    </button>
                </div>
            </div>

            <div className="proxy-list-card">
                {proxies.length === 0 ? (
                    <div className="proxy-empty-state">
                        <Network size={48} className="proxy-empty-icon" />
                        <p>{t('proxies.empty')}</p>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                                {t('proxies.import')}
                            </button>
                            <button className="btn btn-primary" onClick={() => { setEditingProxy(null); setShowForm(true); }}>
                                {t('proxies.add')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <ProxyTable
                        proxies={filteredProxies}
                        onEdit={(p) => { setEditingProxy(p); setShowForm(true); }}
                        onDelete={handleDelete}
                        t={t}
                    />
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

function ProxyTable({ proxies, onEdit, onDelete, t }) {
    const getStatusIcon = (status) => {
        switch (status) {
            case 'active': return <CheckCircle2 size={14} />;
            case 'error': return <XCircle size={14} />;
            case 'inactive': return <AlertCircle size={14} />;
            default: return <HelpCircle size={14} />;
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
                        <th style={{ textAlign: 'right' }}>{t('proxies.col.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {proxies.map(p => (
                        <tr key={p.id}>
                            <td><strong>{p.name}</strong></td>
                            <td><span style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>{p.protocol || 'http'}</span></td>
                            <td>
                                <span style={{ fontFamily: 'monospace' }}>
                                    {p.username ? `${p.username}:***@` : ''}{p.host}:{p.port}
                                </span>
                            </td>
                            <td>
                                <span className={`proxy-status status-${p.status || 'untested'}`}>
                                    {getStatusIcon(p.status)} {t(`proxies.status.${p.status || 'untested'}`)}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button className="btn-icon-primary" onClick={() => onEdit(p)} title={t('proxies.form.title.edit')}>
                                    <Edit2 size={16} />
                                </button>
                                <button className="btn-icon-danger" onClick={() => onDelete(p.id)} title={t('proxies.delete.confirm')}>
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ProxyFormModal({ proxy, onSave, onClose, t }) {
    const [formData, setFormData] = useState(proxy || {
        name: '', protocol: 'http', host: '', port: '', username: '', password: ''
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="proxy-modal-backdrop" onClick={onClose}>
            <div className="proxy-modal-content" onClick={e => e.stopPropagation()}>
                <div className="proxy-modal-header">
                    <h2 className="proxy-modal-title">
                        {proxy ? t('proxies.form.title.edit') : t('proxies.form.title.add')}
                    </h2>
                    <button className="btn-icon-danger" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={submit}>
                    <div className="proxy-form-group">
                        <label className="proxy-form-label">{t('proxies.form.name')}</label>
                        <input type="text" name="name" className="proxy-form-control" value={formData.name} onChange={handleChange} required />
                    </div>

                    <div className="proxy-form-row">
                        <div className="proxy-form-group" style={{ flex: 1 }}>
                            <label className="proxy-form-label">{t('proxies.form.protocol')}</label>
                            <select name="protocol" className="proxy-form-control" value={formData.protocol} onChange={handleChange}>
                                <option value="http">HTTP</option>
                                <option value="https">HTTPS</option>
                                <option value="socks4">SOCKS4</option>
                                <option value="socks5">SOCKS5</option>
                            </select>
                        </div>
                        <div className="proxy-form-group" style={{ flex: 2 }}>
                            <label className="proxy-form-label">{t('proxies.form.host')}</label>
                            <input type="text" name="host" className="proxy-form-control" value={formData.host} onChange={handleChange} required />
                        </div>
                        <div className="proxy-form-group" style={{ flex: 1 }}>
                            <label className="proxy-form-label">{t('proxies.form.port')}</label>
                            <input type="text" name="port" className="proxy-form-control" value={formData.port} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="proxy-form-row">
                        <div className="proxy-form-group" style={{ flex: 1 }}>
                            <label className="proxy-form-label">{t('proxies.form.username')} (Optional)</label>
                            <input type="text" name="username" className="proxy-form-control" value={formData.username} onChange={handleChange} />
                        </div>
                        <div className="proxy-form-group" style={{ flex: 1 }}>
                            <label className="proxy-form-label">{t('proxies.form.password')} (Optional)</label>
                            <input type="password" name="password" className="proxy-form-control" value={formData.password} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="proxy-modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('proxies.form.cancel')}</button>
                        <button type="submit" className="btn btn-primary">{t('proxies.form.save')}</button>
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
