import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', end: true, icon: 'bar_chart', label: 'Tổng quan' },
  { to: '/dashboard/orders', icon: 'receipt_long', label: 'Đơn hàng' },
  { to: '/dashboard/licenses', icon: 'key', label: 'Licenses' },
  { to: '/dashboard/users', icon: 'group', label: 'Người dùng' },
];

const NAV_BOTTOM = [
  { to: '/dashboard/config', icon: 'settings', label: 'Cấu hình' },
];

const linkClass = (isActive) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
    isActive
      ? 'bg-primary text-white font-medium'
      : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
  }`;

const Sidebar = () => (
  <aside className="w-64 flex-shrink-0 border-r border-primary/10 bg-white flex flex-col dark:bg-background-dark">
    {/* Logo */}
    <div className="p-6 flex items-center gap-3">
      <div className="bg-primary/20 p-2 rounded-lg">
        <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
      </div>
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">HL-MCK</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Admin Panel</p>
      </div>
    </div>

    {/* Main nav */}
    <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
      {NAV_ITEMS.map(({ to, end, icon, label }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClass(isActive)}>
          <span className="material-symbols-outlined">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}

      <div className="pt-4 mt-4 border-t border-primary/10 space-y-1">
        {NAV_BOTTOM.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
            <span className="material-symbols-outlined">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>

    {/* Footer info */}
    <div className="p-4 m-4 rounded-xl border border-primary/10 bg-primary/5">
      <p className="text-[10px] uppercase font-bold text-primary/60 mb-1">Admin</p>
      <p className="text-xs text-slate-400">Quản lý license & doanh thu</p>
    </div>
  </aside>
);

export default Sidebar;
