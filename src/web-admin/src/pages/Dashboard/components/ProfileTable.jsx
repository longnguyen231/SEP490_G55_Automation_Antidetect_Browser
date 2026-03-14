import React from 'react';

const profilesData = [
  {
    id: 1,
    name: 'Ads_Manager_USA_01',
    modified: 'Modified 2h ago',
    icon: 'language',
    status: 'Running',
    proxy: '192.168.1.1 (United States)',
    group: { name: 'Marketing', color: 'primary' }
  },
  {
    id: 2,
    name: 'Stealth_UK_Main',
    modified: 'Modified 5h ago',
    icon: 'security',
    status: 'Stopped',
    proxy: '45.12.33.1 (United Kingdom)',
    group: { name: 'Main Team', color: 'slate' }
  },
  {
    id: 3,
    name: 'Social_Audit_FR',
    modified: 'Modified 1d ago',
    icon: 'alternate_email',
    status: 'Running',
    proxy: '103.4.11.2 (France)',
    group: { name: 'Social', color: 'amber' }
  }
];

const ProfileTable = () => {
  return (
    <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-primary/10 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">Profile Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Proxy (IP/Country)</th>
              <th className="px-6 py-4">Group</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {profilesData.map((profile) => {
              const groupColors = {
                primary: 'bg-primary/10 text-primary',
                slate: 'bg-slate-500/10 text-slate-500',
                amber: 'bg-amber-500/10 text-amber-500',
              };

              return (
                <tr key={profile.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-slate-400 text-sm">{profile.icon}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-200">{profile.name}</p>
                        <p className="text-[10px] text-slate-500">{profile.modified}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${profile.status === 'Running' ? 'bg-primary' : 'bg-slate-700'}`}>
                        <span className={`${profile.status === 'Running' ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-wide ${profile.status === 'Running' ? 'text-primary' : 'text-slate-500'}`}>{profile.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-slate-500">public</span>
                      <span className="text-sm dark:text-slate-300">{profile.proxy}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${groupColors[profile.group.color]}`}>
                      {profile.group.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">settings</span>
                      </button>
                      <button className="p-1.5 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">content_copy</span>
                      </button>
                      <button className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors">
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 border-t border-primary/10 flex items-center justify-between">
        <p className="text-xs text-slate-500">Showing 1-3 of 1,284 profiles</p>
        <div className="flex items-center gap-2">
          <button className="p-1 rounded border border-primary/10 hover:bg-primary/10 text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button className="px-2.5 py-1 rounded bg-primary text-white text-xs font-bold">1</button>
          <button className="px-2.5 py-1 rounded hover:bg-primary/10 text-slate-400 text-xs font-bold">2</button>
          <button className="px-2.5 py-1 rounded hover:bg-primary/10 text-slate-400 text-xs font-bold">3</button>
          <button className="p-1 rounded border border-primary/10 hover:bg-primary/10 text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileTable;
