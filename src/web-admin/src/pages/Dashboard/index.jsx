import React from 'react';
import StatCard from './components/StatCard';
import ProfileTable from './components/ProfileTable';

const Dashboard = () => {
  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Profiles" value="1,284" change="+12%" icon="browser_updated" />
        <StatCard title="Running" value="42" change="+5%" icon="play_circle" />
        <StatCard title="Proxies Active" value="912" change="-2%" icon="hub" iconClass="text-amber-500" />
        <StatCard title="Expiring Soon" value="15" change="+1%" icon="timer" iconClass="text-rose-500" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Browser Profiles</h2>
            <p className="text-sm text-slate-500 mt-1">Manage and launch your isolated browsing sessions</p>
          </div>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <span>Create New Profile</span>
          </button>
        </div>
        
        <ProfileTable />
      </section>
    </>
  );
};

export default Dashboard;
