import React from 'react';
import StatCard from '../../components/StatCard';
import ProxyTable from '../../components/ProxyTable';
import PageHeader from '../../components/PageHeader';
import InfoBanner from '../../components/InfoBanner';
import { Button, ConfigProvider, theme } from 'antd';
import { RefreshCcw, PlusSquare, Lightbulb, Settings } from 'lucide-react';
import { mockProxiesData } from '../../data/mockProxies';
import toast from 'react-hot-toast';

const Proxies = () => {
  // Tính toán dữ liệu động từ mock data
  const totalProxies = mockProxiesData.length;
  const liveCount = mockProxiesData.filter(p => p.status === 'Live').length;
  const deadCount = mockProxiesData.filter(p => p.status === 'Dead').length;
  
  const liveProxiesWithLatency = mockProxiesData.filter(p => p.status === 'Live' && p.latency !== null);
  const avgLatency = liveProxiesWithLatency.length > 0 
    ? Math.round(liveProxiesWithLatency.reduce((acc, curr) => acc + curr.latency, 0) / liveProxiesWithLatency.length)
    : 0;

  const headerExtra = (
    <>
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgContainer: '#1e293b', colorBorder: 'transparent', colorText: '#f1f5f9', borderRadius: 8, controlHeight: 38 } }}>
        <Button 
          onClick={() => toast.success('Checking all proxies...')}
          className="flex items-center gap-2 font-semibold shadow-sm text-sm font-display px-4 hover:!bg-slate-700 transition-all border-none"
        >
          <RefreshCcw size={18} />
          <span>Check All Proxies</span>
        </Button>
      </ConfigProvider>
      
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 38 } }}>
        <Button 
          type="primary" 
          onClick={() => toast.success('Mở modal thêm Proxy hàng loạt...')}
          className="flex items-center gap-2 font-semibold shadow-lg shadow-primary/20 text-sm font-display px-4"
        >
          <PlusSquare size={18} />
          <span>Bulk Import</span>
        </Button>
      </ConfigProvider>
    </>
  );

  return (
    <>
      <PageHeader 
        title="Proxies Management" 
        description="Manage and monitor your dedicated proxy pool performance."
        extra={headerExtra}
      />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Proxies" value={totalProxies.toLocaleString()} />
        <StatCard title="Live Status" value={liveCount.toLocaleString()} titleClass="text-emerald-500" />
        <StatCard title="Dead Status" value={deadCount.toLocaleString()} titleClass="text-rose-500" />
        <StatCard title="Avg Latency" value={`${avgLatency} ms`} titleClass="text-primary" />
      </section>

      <section className="mb-8">
        <ProxyTable />
      </section>

      <InfoBanner 
        title="Auto-Check is enabled"
        description="Proxies are automatically re-checked every 15 minutes to ensure reliability."
        icon={Lightbulb}
        actionText="Change Settings"
        onAction={() => toast.success('Mở cài đặt Auto-Check...')}
      />
    </>
  );
};

export default Proxies;
