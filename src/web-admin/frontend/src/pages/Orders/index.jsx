import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  revoked: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

function formatVnd(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0) + '₫';
}

export default function Orders() {
  const { getOrders, markPaid } = useAdminApi();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(null);

  const load = () => {
    setLoading(true);
    getOrders()
      .then(d => setOrders(d.orders || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleMarkPaid = async (code) => {
    setActing(code);
    try {
      await markPaid(code);
      toast.success(`Đơn ${code} đã được đánh dấu Paid`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActing(null);
    }
  };

  const visible = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = !search || (o.email || '').toLowerCase().includes(search.toLowerCase()) || String(o._orderCode).includes(search);
    return matchStatus && matchSearch;
  });

  return (
    <>
      <PageHeader title="Đơn hàng" description="Tất cả giao dịch PayOS" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Tìm email hoặc mã đơn..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-primary w-64"
        />
        {['all', 'pending', 'paid', 'revoked'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${filter === s ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'}`}
          >
            {s === 'all' ? 'Tất cả' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{visible.length} đơn</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải...</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Không có đơn hàng nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Mã đơn', 'Email', 'Gói', 'Số tiền', 'Trạng thái', 'Ngày tạo', 'Hành động'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {visible.map(o => (
                <tr key={o._orderCode} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{o._orderCode}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{o.email || '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-primary uppercase">{o.tier || 'pro'}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{formatVnd(o.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3">
                    {o.status === 'pending' && (
                      <button
                        onClick={() => handleMarkPaid(o._orderCode)}
                        disabled={acting === o._orderCode}
                        className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md px-3 py-1 transition-colors disabled:opacity-50"
                      >
                        {acting === o._orderCode ? '...' : 'Mark Paid'}
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
