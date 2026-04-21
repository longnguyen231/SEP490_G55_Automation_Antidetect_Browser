import React, { useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import { useAdminApi } from '../../hooks/useAdminApi';
import toast from 'react-hot-toast';

function formatVnd(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

export default function Dashboard() {
  const { getStats } = useAdminApi();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(err => toast.error('Không tải được thống kê: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Tổng quan" description="Thống kê người dùng & license" />

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Đang tải...</div>
      ) : stats ? (
        <>
          {/* Row 1 — User & license stats */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              title="Trial đang hoạt động"
              value={stats.trialOrders ?? 0}
              change="License miễn phí"
              icon="rocket_launch"
              iconClass="text-cyan-400"
            />
            <StatCard
              title="Đã kích hoạt"
              value={stats.activatedLicenses ?? 0}
              icon="key"
              iconClass="text-amber-400"
            />
            <StatCard
              title="Tổng downloads"
              value={stats.totalDownloads ?? 0}
              change="Tất cả nền tảng"
              icon="download"
              iconClass="text-primary"
            />
            <StatCard
              title="License paid"
              value={stats.paidOrders ?? 0}
              change={`CVR ${stats.conversionRate ?? 0}%`}
              icon="verified"
              iconClass="text-emerald-400"
            />
          </section>

          {/* Row 2 — Revenue (kept for future use, shown dimmed when disabled) */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Tổng doanh thu"
              value={formatVnd(stats.totalRevenue)}
              icon="payments"
              iconClass="text-slate-400"
              dimmed
            />
            <StatCard
              title="Đơn chờ"
              value={stats.pendingOrders ?? 0}
              icon="pending"
              iconClass="text-rose-400"
            />
            <StatCard
              title="Win downloads"
              value={stats.downloadsByPlatform?.windows?.count ?? 0}
              icon="desktop_windows"
              iconClass="text-blue-400"
            />
            <StatCard
              title="Revoked"
              value={stats.revokedOrders ?? 0}
              icon="block"
              iconClass="text-slate-500"
            />
          </section>

          {/* Activity chart */}
          <section className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">Hoạt động 7 ngày qua</h3>
            <div className="flex items-end gap-3 h-28">
              {stats.last7Days.map((day, i) => {
                const maxCount = Math.max(...stats.last7Days.map(d => d.count), 1);
                const heightPct = (day.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-400">{day.count > 0 ? day.count : ''}</span>
                    <div className="w-full rounded-t bg-primary/70 transition-all" style={{ height: `${Math.max(heightPct, day.count > 0 ? 8 : 2)}%`, minHeight: '4px' }} />
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{day.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-sm text-slate-500">
              <span>Tổng: <strong className="text-slate-700 dark:text-slate-200">{stats.totalOrders}</strong></span>
              <span>Trial: <strong className="text-cyan-400">{stats.trialOrders ?? 0}</strong></span>
              <span>Paid: <strong className="text-emerald-500">{stats.paidOrders}</strong></span>
              <span>Downloads: <strong className="text-primary">{stats.totalDownloads ?? 0}</strong></span>
            </div>
          </section>
        </>
      ) : (
        <div className="text-slate-400 text-sm py-8 text-center">Không có dữ liệu.</div>
      )}
    </>
  );
}
