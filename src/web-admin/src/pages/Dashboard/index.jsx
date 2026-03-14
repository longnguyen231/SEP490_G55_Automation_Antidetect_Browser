import React from 'react';
import StatCard from './components/StatCard';
import ProfileTable from './components/ProfileTable';
import { Button, ConfigProvider, theme } from 'antd';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
          <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
            <Button 
              type="primary" 
              onClick={() => toast.success('Mở modal thêm Profile mới...')}
              className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
            >
              <PlusCircle size={18} />
              <span>Create New Profile</span>
            </Button>
          </ConfigProvider>
        </div>
        
        <ProfileTable />
      </section>
    </>
  );
};

export default Dashboard;
