import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

export default function Users() {
  const { getUsers } = useAdminApi();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPro, setFilterPro] = useState(false);
  const [source, setSource] = useState('');

  useEffect(() => {
    getUsers()
      .then(d => { setUsers(d.users || []); setSource(d.source || ''); })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = users.filter(u => {
    const matchSearch = !search || (u.email || '').toLowerCase().includes(search.toLowerCase()) || (u.displayName || '').toLowerCase().includes(search.toLowerCase());
    const matchPro = !filterPro || u.isPro;
    return matchSearch && matchPro;
  });

  return (
    <>
      <PageHeader title="Người dùng" description="Danh sách tài khoản Firebase" />

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Tìm email hoặc tên..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary w-64"
        />
        <button
          onClick={() => setFilterPro(v => !v)}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${filterPro ? 'bg-amber-500 text-black border-amber-500' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-400'}`}
        >
          ⚡ Pro only
        </button>
        <span className="ml-auto text-xs text-slate-400 self-center">
          {visible.length} user{source === 'orders-fallback' && ' (từ orders, không có Firebase Admin)'}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Không có user nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Email', 'Tên', 'Pro', 'Provider', 'Đăng ký', 'Last login'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {visible.map((u, i) => (
                <tr key={u.uid || i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{u.displayName || <span className="italic text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {u.isPro && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        ⚡ PRO
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.provider || 'password'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
