import React from 'react';

const Sidebar = () => {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-primary/10 bg-white flex flex-col dark:bg-background-dark">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary/20 p-2 rounded-lg">
          <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">Vanguard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Antidetect Browser</p>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary text-white font-medium group" href="#">
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all group" href="#">
          <span className="material-symbols-outlined">group_work</span>
          <span>Profiles</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all group" href="#">
          <span className="material-symbols-outlined">vpn_lock</span>
          <span>Proxies</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all group" href="#">
          <span className="material-symbols-outlined">folder_shared</span>
          <span>Groups</span>
        </a>
        <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all group" href="#">
          <span className="material-symbols-outlined">groups</span>
          <span>Team</span>
        </a>
        <div className="pt-4 mt-4 border-t border-primary/10">
          <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all group" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </a>
        </div>
      </nav>
      
      <div className="p-4 bg-primary/5 m-4 rounded-xl border border-primary/10">
        <p className="text-[10px] uppercase font-bold text-primary/60 mb-2">Active Plan</p>
        <p className="text-sm font-semibold dark:text-slate-200">Enterprise Pro</p>
        <div className="w-full bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-primary h-full w-3/4"></div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">750 / 1000 Profiles</p>
      </div>
    </aside>
  );
};

export default Sidebar;
