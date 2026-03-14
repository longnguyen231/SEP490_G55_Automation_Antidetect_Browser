import React from 'react';
import { Button, Input, Switch, ConfigProvider, theme, Select } from 'antd';
import { Settings as SettingsIcon, Shield, User, Globe, Database, Key } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SectionCard from '../../components/SectionCard';
import toast from 'react-hot-toast';

const Settings = () => {
  const headerExtra = (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
      <Button 
        type="primary" 
        onClick={() => toast.success('Cài đặt đã được lưu thành công!')}
        className="flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20"
      >
        Save Changes
      </Button>
    </ConfigProvider>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <PageHeader 
        title="Workspace Settings" 
        description="Configure your environment, security and workspace preferences."
        extra={headerExtra}
      />

      <div className="grid grid-cols-1 gap-6">
        <SectionCard title="Profile Information" icon="person">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace Name</label>
              <Input placeholder="Antidetect Pro Workspace" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Admin</label>
              <Input placeholder="admin@antidetect.pro" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Security & API" icon="shield">
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Key size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold">2-Factor Authentication</p>
                  <p className="text-xs text-slate-500">Secure your account with 2FA tokens</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Public API Key</label>
                <Button type="link" className="!h-auto !p-0 text-xs font-bold text-primary">Regenerate</Button>
              </div>
              <Input.Password value="op_••••••••••••••••••••••••" readOnly />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Storage & Backup" icon="database">
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm font-bold">
                <Globe size={18} className="text-primary" />
                <span>Cloud Synchronization</span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center">
              <p className="text-xs text-slate-500 mb-3">Syncing results in real-time across all your devices.</p>
              <Button type="dashed" className="text-xs font-bold">View Cloud Logs</Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default Settings;
