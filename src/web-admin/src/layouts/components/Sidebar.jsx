import React from 'react';
import { NavLink } from 'react-router-dom';
import { Progress, ConfigProvider, theme } from 'antd';

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
        <NavLink 
          to="/dashboard" 
          end
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/dashboard/profiles" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">group_work</span>
          <span>Profiles</span>
        </NavLink>
        
        <NavLink 
          to="/dashboard/proxies" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">vpn_lock</span>
          <span>Proxies</span>
        </NavLink>
        
        <NavLink 
          to="/dashboard/groups" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">folder_shared</span>
          <span>Groups</span>
        </NavLink>
        
        <NavLink 
          to="/dashboard/team" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">groups</span>
          <span>Team</span>
        </NavLink>
        
        <NavLink 
          to="/dashboard/license-requests" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive 
                ? 'bg-primary text-white font-medium' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">key</span>
          <span>License Requests</span>
        </NavLink>
        
        <div className="pt-4 mt-4 border-t border-primary/10">
          <NavLink 
            to="/dashboard/settings" 
            className={({ isActive }) => 
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                isActive 
                  ? 'bg-primary text-white font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
              }`
            }
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </NavLink>
        </div>
      </nav>
      
      <div className="p-4 bg-primary/5 m-4 rounded-xl border border-primary/10">
        <p className="text-[10px] uppercase font-bold text-primary/60 mb-1">Active Plan</p>
        <p className="text-sm font-semibold dark:text-slate-200 mb-2">Enterprise Pro</p>
        <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', colorText: '#94a3b8' } }}>
          <Progress 
            percent={75} 
            showInfo={false} 
            strokeColor="#00bcd4" 
            trailColor="rgba(30,41,59,0.5)" 
            size="small" 
            className="mb-1"
          />
        </ConfigProvider>
        <p className="text-[11px] text-slate-400">750 / 1000 Profiles</p>
      </div>
    </aside>
  );
};

export default Sidebar;
