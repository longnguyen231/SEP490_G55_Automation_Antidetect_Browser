import React, { useState } from 'react';
import StatCard from '../../components/StatCard';
import ProfileTable from '../../components/ProfileTable';
import CreateProfileModal from './components/CreateProfileModal';
import PageHeader from '../../components/PageHeader';
import { mockProfilesData } from '../../dataweb/mockProfiles';
import { mockProxiesData } from '../../dataweb/mockProxies';
import { Button, ConfigProvider, theme } from 'antd';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tính toán dữ liệu động
  const totalProfiles = mockProfilesData.length;
  const runningCount = mockProfilesData.filter(p => p.status === 'Running').length;
  const activeProxiesCount = mockProxiesData.filter(p => p.status === 'Live').length;
  const expiringSoonCount = Math.floor(totalProfiles * 0.05); 

  const handleProfileCreated = (data) => {
    console.log('New Profile Data to update table:', data);
    // Future API logic here
  };

  const headerExtra = (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
      <Button 
        type="primary" 
        onClick={() => setIsModalOpen(true)}
        className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
      >
        <PlusCircle size={18} />
        <span>Create New Profile</span>
      </Button>
    </ConfigProvider>
  );

  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Profiles" value={totalProfiles.toLocaleString()} change="+12%" icon="browser_updated" />
        <StatCard title="Running" value={runningCount.toLocaleString()} change="+5%" icon="play_circle" />
        <StatCard title="Proxies Active" value={activeProxiesCount.toLocaleString()} change="-2%" icon="hub" iconClass="text-amber-500" />
        <StatCard title="Expiring Soon" value={expiringSoonCount.toLocaleString()} change="+1%" icon="timer" iconClass="text-rose-500" />
      </section>

      <section className="space-y-4">
        <PageHeader 
          title="Browser Profiles" 
          description="Manage and launch your isolated browsing sessions"
          extra={headerExtra}
        />
        
        <ProfileTable />
        
        <CreateProfileModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleProfileCreated}
        />
      </section>
    </>
  );
};

export default Dashboard;
