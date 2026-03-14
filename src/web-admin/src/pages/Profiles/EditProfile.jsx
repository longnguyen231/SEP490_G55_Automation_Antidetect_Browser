import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, ConfigProvider, theme, Input, Select, Switch, Checkbox, Space } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Settings, Save, X, RotateCcw, Monitor, Laptop, Smartphone, ShieldCheck, Cpu, Database, Network, Type, Palette } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SectionCard from '../../components/SectionCard';
import toast from 'react-hot-toast';

const schema = yup.object().shape({
  name: yup.string().required('Profile name is required'),
  group: yup.string().required('Group is required'),
  os: yup.string().required('OS is required'),
  proxyType: yup.string().required(),
  proxyHost: yup.string().when('proxyType', {
    is: (val) => val !== 'Direct',
    then: () => yup.string().required('Proxy host is required'),
  }),
  proxyPort: yup.string().when('proxyType', {
    is: (val) => val !== 'Direct',
    then: () => yup.string().required('Port is required'),
  }),
});

const EditProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: 'E-Commerce Research - US',
      group: 'marketing',
      os: 'windows',
      proxyType: 'HTTPS',
      proxyHost: 'proxy.premium-service.net',
      proxyPort: '44301',
      proxyUser: 'user_premium_39',
      cpuCores: '8',
      ram: '16',
      webrtcMasking: true,
      canvasNoise: true,
      audioNoise: true,
    }
  });

  const onSubmit = (data) => {
    console.log('Saving profile:', data);
    toast.success('Changes saved successfully!');
    navigate('/profiles');
  };

  const headerExtra = (
    <div className="flex gap-3">
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgContainer: '#334155', colorBorder: 'transparent', colorText: '#f1f5f9' } }}>
        <Button 
          onClick={() => navigate('/profiles')}
          className="font-bold border-none h-10 px-6"
        >
          Discard
        </Button>
      </ConfigProvider>
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4' } }}>
        <Button 
          type="primary" 
          icon={<Save size={18} />} 
          onClick={handleSubmit(onSubmit)}
          className="font-bold shadow-lg shadow-primary/20 h-10 px-6"
        >
          Save Changes
        </Button>
      </ConfigProvider>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <PageHeader 
        title="Edit Profile Fingerprint"
        description={`ID: prof_${id || '88291'} • Last synced 2 minutes ago • Chrome 122.0.x`}
        extra={headerExtra}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Information */}
        <SectionCard title="1. Basic Information" icon="info">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profile Name</label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input {...field} className="h-11" status={errors.name ? 'error' : ''} />
                )}
              />
              {errors.name && <p className="text-rose-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Group</label>
              <Controller
                name="group"
                control={control}
                render={({ field }) => (
                  <Select 
                    {...field} 
                    className="w-full h-11" 
                    options={[
                      { value: 'marketing', label: 'Marketing Team' },
                      { value: 'affiliate', label: 'Affiliate Research' },
                      { value: 'testing', label: 'Testing' },
                    ]} 
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Operating System</label>
              <Controller
                name="os"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button 
                      type="button"
                      onClick={() => field.onChange('windows')}
                      className={`flex-1 flex flex-col items-center py-2 rounded transition-all ${
                        field.value === 'windows' 
                          ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' 
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <Monitor size={20} />
                      <span className="text-[10px] font-bold mt-1 uppercase">Windows</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => field.onChange('macos')}
                      className={`flex-1 flex flex-col items-center py-2 rounded transition-all ${
                        field.value === 'macos' 
                          ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' 
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <Laptop size={20} />
                      <span className="text-[10px] font-bold mt-1 uppercase">macOS</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => field.onChange('ios')}
                      className={`flex-1 flex flex-col items-center py-2 rounded transition-all ${
                        field.value === 'ios' 
                          ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' 
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <Smartphone size={20} />
                      <span className="text-[10px] font-bold mt-1 uppercase">iOS</span>
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 2: Proxy Configuration */}
        <SectionCard 
          title="2. Proxy Configuration" 
          icon="router" 
          extra={
            <Button type="link" icon={<ShieldCheck size={16} />} className="text-primary font-semibold p-0 h-auto">
              Test Proxy Connection
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Proxy Type</label>
              <Controller
                name="proxyType"
                control={control}
                render={({ field }) => (
                  <Select 
                    {...field} 
                    className="w-full h-11" 
                    options={[
                      { value: 'Direct', label: 'Direct (No Proxy)' },
                      { value: 'HTTP', label: 'HTTP' },
                      { value: 'HTTPS', label: 'HTTPS' },
                      { value: 'SOCKS5', label: 'SOCKS5' },
                    ]} 
                  />
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Host (IP or Domain)</label>
              <Controller
                name="proxyHost"
                control={control}
                render={({ field }) => (
                  <Input {...field} className="h-11" placeholder="proxy.example.com" />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Port</label>
              <Controller
                name="proxyPort"
                control={control}
                render={({ field }) => (
                  <Input {...field} className="h-11" placeholder="8080" />
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Username</label>
              <Controller
                name="proxyUser"
                control={control}
                render={({ field }) => (
                  <Input {...field} className="h-11" placeholder="Optional" />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <Controller
                name="proxyPass"
                control={control}
                render={({ field }) => (
                  <Input.Password {...field} className="h-11" placeholder="Optional" />
                )}
              />
            </div>
          </div>
        </SectionCard>
        
        {/* Section 3: Fingerprint Customization */}
        <SectionCard 
          title="3. Fingerprint Customization" 
          icon="fingerprint"
          extra={
            <Button size="small" className="bg-primary/10 text-primary border-none font-bold text-[10px] uppercase tracking-wider h-7">
              Generate Random
            </Button>
          }
        >
          <div className="space-y-10">
            {/* Hardware */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Cpu size={14} /> Hardware Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">CPU Cores</label>
                  <Controller
                    name="cpuCores"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="w-full" options={['2', '4', '8', '16'].map(v => ({ value: v, label: `${v} Cores` }))} />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">RAM (GB)</label>
                  <Controller
                    name="ram"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} className="w-full" options={['4', '8', '16', '32'].map(v => ({ value: v, label: `${v} GB` }))} />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Device Memory Hint</label>
                  <Input type="number" defaultValue={8} className="w-full" />
                </div>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* WebRTC & Screen */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Network size={14} /> WebRTC
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">WebRTC Masking</span>
                    <Controller
                      name="webrtcMasking"
                      control={control}
                      render={({ field }) => <Switch {...field} checked={field.value} size="small" />}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Local IP Leak Protection</span>
                    <Switch defaultChecked size="small" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Public IP Address</label>
                    <Input value="103.14.5.122" readOnly className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Monitor size={14} /> Screen & Resolution
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Width (px)</label>
                    <Input defaultValue="1920" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Height (px)</label>
                    <Input defaultValue="1080" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Color Depth</label>
                    <Select defaultValue="32" className="w-full" options={[{ value: '24', label: '24-bit' }, { value: '32', label: '32-bit' }, { value: '48', label: '48-bit' }]} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Graphics & Rendering */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Palette size={14} /> Graphics & Rendering
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-base">texture</span>
                      <span className="text-sm font-medium">Canvas Noise</span>
                    </div>
                    <Controller
                      name="canvasNoise"
                      control={control}
                      render={({ field }) => <Checkbox {...field} checked={field.value} />}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-base">audiotrack</span>
                      <span className="text-sm font-medium">Audio Fingerprint Noise</span>
                    </div>
                    <Controller
                      name="audioNoise"
                      control={control}
                      render={({ field }) => <Checkbox {...field} checked={field.value} />}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-[11px] font-black text-primary uppercase tracking-wider">WebGL Metadata</h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">WebGL Vendor</label>
                      <Input value="Google Inc. (NVIDIA)" size="small" className="text-xs bg-white dark:bg-slate-800" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">WebGL Renderer</label>
                      <Input value="ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11)" size="small" className="text-xs bg-white dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Fonts & Misc */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Type size={14} /> Fonts & Client Hints
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Enabled Fonts (52)</span>
                    <Button type="link" size="small" className="text-xs font-bold p-0 h-auto">Select All</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {['Arial', 'Calibri', 'Cambria', 'Consolas', 'Georgia', 'Impact', 'Segoe UI', 'Verdana'].map(f => (
                      <Checkbox key={f} defaultChecked><span className="text-[11px] text-slate-600 dark:text-slate-400">{f}</span></Checkbox>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Navigator Language</label>
                    <Input defaultValue="en-US,en;q=0.9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Platform Hint</label>
                    <Input defaultValue="Win32" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </form>

      {/* Footer Info */}
      <div className="flex items-start gap-4 p-5 rounded-xl bg-primary/5 border border-primary/20">
        <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
        <div className="text-sm">
          <p className="font-bold text-slate-900 dark:text-white">Profile Score: 100/100 (Indistinguishable)</p>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            These settings are automatically optimized for your proxy location (United States). 
            Changing hardware parameters manually might affect your anonymity score on high-security platforms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
