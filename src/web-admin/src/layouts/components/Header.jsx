import React from 'react';
import { Input, Badge, Avatar, ConfigProvider, theme, Dropdown } from 'antd';
import { Search, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'info',
      label: (
        <div className="px-1 py-1 min-w-[160px]">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold uppercase tracking-wider">
            {user?.role}
          </span>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: (
        <span className="flex items-center gap-2 text-rose-500 font-medium">
          <LogOut size={14} />
          Sign out
        </span>
      ),
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-primary/10 backdrop-blur-md z-10 dark:bg-background-dark">
      <div className="flex items-center flex-1 max-w-xl">
        <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgContainer: 'rgba(30,41,59,0.5)', colorBorder: 'transparent', colorPrimary: '#00bcd4', borderRadius: 8, controlHeight: 40 } }}>
          <Input
            size="large"
            placeholder="Search profiles, proxies, or team members..."
            prefix={<Search size={18} className="text-slate-400 mr-2" />}
            className="w-full hover:border-primary/50 focus:border-primary focus:shadow-[0_0_0_2px_rgba(0,188,212,0.2)]"
          />
        </ConfigProvider>
      </div>

      <div className="flex items-center gap-6 ml-8">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary leading-none">System Online</span>
        </div>

        <button className="text-slate-500 hover:text-primary transition-colors flex items-center justify-center mt-1">
          <Badge dot color="#f43f5e" offset={[-2, 4]}>
            <Bell size={22} className="text-slate-500 hover:text-primary transition-colors" />
          </Badge>
        </button>

        <div className="flex items-center gap-3 pl-6 border-l border-primary/10">
          <ConfigProvider theme={{ token: { colorBgElevated: '#1e293b', colorText: '#e2e8f0', colorTextSecondary: '#94a3b8', colorSplit: 'rgba(148,163,184,0.12)', borderRadius: 10 } }}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[120px]">
                    {user?.name || 'Admin'}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">{user?.role || 'Administrator'}</p>
                </div>
                <Avatar
                  size={40}
                  src={user?.avatar || undefined}
                  icon={!user?.avatar && <User size={18} />}
                  className="border border-primary/30 cursor-pointer hover:border-primary transition-colors"
                />
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>
            </Dropdown>
          </ConfigProvider>
        </div>
      </div>
    </header>
  );
};

export default Header;
