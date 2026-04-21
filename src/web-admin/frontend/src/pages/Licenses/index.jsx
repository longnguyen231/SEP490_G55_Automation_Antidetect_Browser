import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

export default function Licenses() {
  const { getLicenses, resetMachine, revokeLicense } = useAdminApi();
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

  useEffect(load, []);

  const handleAction = async (email, action) => {
    const confirm = window.confirm(
      action === 'reset'
        ? `Reset machine binding cho ${email}?\nUser sẽ có thể kích hoạt lại trên máy mới.`
        : `Revoke license của ${email}?\nKey này sẽ không còn hoạt động.`
    );
    if (!confirm) return;

    setActing({ email, action });
    try {
      if (action === 'reset') {
        await resetMachine(email);
        toast.success(`Đã reset machine binding cho ${email}`);
      } else {
        await revokeLicense(email);
        toast.success(`Đã revoke license của ${email}`);
      }
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

  const isActing = (email, action) => acting?.email === email && acting?.action === action;

  return (
    <>
      <PageHeader title="Licenses" description="Quản lý kích hoạt license theo máy" />

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Tìm email hoặc license key..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary w-72"
        />
        <span className="ml-auto text-xs text-slate-400 self-center">{visible.length} license</span>
      </div>

      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Chưa có license nào được kích hoạt.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Email', 'License Key', 'Machine Code', 'Kích hoạt lúc', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {visible.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{l.email || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{l.licenseKey || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.activatedMachine || <span className="text-slate-300 italic">Chưa kích hoạt</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{l.activatedAt ? new Date(l.activatedAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3">
                    {l.status === 'revoked' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-500/15 text-rose-400 border-rose-500/20">revoked</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/20">active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {l.status !== 'revoked' && l.email && (
                      <>
                        {l.activatedMachine && (
                          <button
                            onClick={() => handleAction(l.email, 'reset')}
                            disabled={isActing(l.email, 'reset')}
                            className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-md px-3 py-1 transition-colors disabled:opacity-50"
                          >
                            {isActing(l.email, 'reset') ? '...' : 'Reset Machine'}
                          </button>
                        )}
                        <button
                          onClick={() => handleAction(l.email, 'revoke')}
                          disabled={isActing(l.email, 'revoke')}
                          className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-md px-3 py-1 transition-colors disabled:opacity-50"
                        >
                          {isActing(l.email, 'revoke') ? '...' : 'Revoke'}
                        </button>
                      </>
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
