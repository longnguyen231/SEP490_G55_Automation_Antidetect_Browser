import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

export default function Licenses() {
  const { getLicenses, revokeLicense } = useAdminApi();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(null); // { email, action }

  const load = () => {
    setLoading(true);
    getLicenses()
      .then(d => setLicenses(d.licenses || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRevoke = async (email) => {
    if (!window.confirm(`Revoke license for ${email}?\nThis key will no longer work.`)) return;

    setActing({ email, action: 'revoke' });
    try {
      await revokeLicense(email);
      toast.success(`License revoked for ${email}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActing(null);
    }
  };

  const visible = licenses.filter(l =>
    !search ||
    (l.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.licenseKey || '').toLowerCase().includes(search.toLowerCase())
  );

  const isRevoking = (email) => acting?.email === email && acting?.action === 'revoke';

  return (
    <>
      <PageHeader title="Licenses" description="Manage license activations by machine" />

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search email or license key..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary w-72"
        />
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        <span className="ml-auto text-xs text-slate-400 self-center">{visible.length} license(s)</span>
      </div>

      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No licenses activated yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Email', 'License Key', 'Tier', 'Machine Code', 'Activated At', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {visible.map((l, i) => (
                <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${l.status !== 'revoked' && !l.activatedMachine ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{l.email || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{l.licenseKey || '—'}</td>
                  <td className="px-4 py-3">
                    {l.tier === 'trial' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">Trial</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">Pro</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.activatedMachine || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{l.activatedAt ? new Date(l.activatedAt).toLocaleDateString('en-US') : '—'}</td>
                  <td className="px-4 py-3">
                    {l.status === 'revoked' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-500/15 text-rose-400 border-rose-500/20">revoked</span>
                    ) : l.activatedMachine ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-500/15 text-slate-400 border-slate-500/20">inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {l.status !== 'revoked' && l.email && (
                      <button
                        onClick={() => handleRevoke(l.email)}
                        disabled={isRevoking(l.email)}
                        className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-md px-3 py-1 transition-colors disabled:opacity-50"
                      >
                        {isRevoking(l.email) ? '...' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
