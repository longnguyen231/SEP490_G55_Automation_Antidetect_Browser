import React, { useState } from 'react';
import { Tabs, Button, ConfigProvider, theme } from 'antd';
import { PlusCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import GroupCard from '../../components/GroupCard';
import ActivityList from '../../components/ActivityList';
import { mockGroupsData, recentActivities } from '../../dataweb/mockGroups';
import toast from 'react-hot-toast';

const Groups = () => {
  const [activeTab, setActiveTab] = useState('1');

  const headerExtra = (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
      <Button 
        type="primary" 
        onClick={() => toast.success('Mở modal tạo Nhóm mới...')}
        className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
      >
        <PlusCircle size={18} />
        <span>Create New Group</span>
      </Button>
    </ConfigProvider>
  );

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Groups Management" 
        description="Manage and organize your browser profile groups"
        extra={headerExtra}
      />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Groups" value={mockGroupsData.length.toLocaleString()} />
        <StatCard title="Active Groups" value="8" titleClass="text-emerald-500" />
        <StatCard title="Archived" value="4" titleClass="text-slate-500" />
        <StatCard title="Most Frequent" value="Social Media" titleClass="text-primary" />
      </section>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <ConfigProvider theme={{ 
          algorithm: theme.darkAlgorithm,
          token: { colorPrimary: '#00bcd4' }
        }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              { key: '1', label: <span className="px-2 font-bold uppercase text-xs">All Groups ({mockGroupsData.length})</span> },
              { key: '2', label: <span className="px-2 font-bold uppercase text-xs">Active (8)</span> },
              { key: '3', label: <span className="px-2 font-bold uppercase text-xs">Archived (4)</span> },
            ]}
          />
        </ConfigProvider>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockGroupsData.map(group => (
          <GroupCard key={group.id} group={group} />
        ))}
        
        <button className="flex flex-col items-center justify-center gap-4 bg-transparent border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[250px]">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
            <PlusCircle size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">New Group</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Create a workspace</p>
          </div>
        </button>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Recent Activities</h3>
        <ActivityList activities={recentActivities} />
      </div>
    </div>
  );
};

export default Groups;
