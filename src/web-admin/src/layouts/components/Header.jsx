import React, { useRef, useEffect } from 'react';
import { Input, Badge, Avatar, ConfigProvider, theme, Dropdown } from 'antd';
import { Search, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useNotifications } from '../../hooks/useNotifications';
import toast from 'react-hot-toast';

// ─── Provider badge (mini) ────────────────────────────────────────────────────
const PROVIDER_ICONS = {
  google: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  facebook: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
};

const PROVIDER_LABELS = {
  google: 'Google Account',
  facebook: 'Facebook Account',
  local: 'Email Account',
};

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, isPro } = useAuthStore();
  const { notifications, unreadCount, open: notiOpen, toggle: toggleNoti, close: closeNoti } = useNotifications();
  const notiRef = useRef(null);

  // Close notification panel when clicking outside
  useEffect(() => {
    if (!notiOpen) return;
    function handleClick(e) {
      if (notiRef.current && !notiRef.current.contains(e.target)) closeNoti();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notiOpen, closeNoti]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const providerLabel = PROVIDER_LABELS[user?.provider] ?? 'Account';
  const providerIcon = PROVIDER_ICONS[user?.provider] ?? null;

  const menuItems = [
    {
      key: 'info',
      label: (
        <div className="px-1 py-1 min-w-[190px]">
          {/* Avatar row */}
          <div className="flex items-center gap-2.5 mb-2">
            <Avatar
              size={36}
              src={user?.avatar || undefined}
              icon={!user?.avatar && <User size={16} />}
              className="border border-primary/30 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-700/50">
            {/* Provider badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/60 text-slate-300">
              {providerIcon}
              {providerLabel}
            </span>
            {/* Role badge */}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold uppercase tracking-wider">
              {user?.role}
            </span>
            {/* PRO badge */}
            {isPro && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold uppercase tracking-wider">
                ⚡ PRO
              </span>
            )}
          </div>
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

      <div className="flex items-center gap-6 ml-8 relative">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary leading-none">System Online</span>
        </div>

        <button className="text-slate-500 hover:text-primary transition-colors flex items-center justify-center mt-1" onClick={toggleNoti} aria-label="Thông báo">
          <Badge count={unreadCount} size="small" style={{ backgroundColor: '#f43f5e' }} offset={[-2, 2]}>
            <Bell size={22} className={`transition-colors ${notiOpen ? 'text-primary' : 'text-slate-500 hover:text-primary'}`} />
          </Badge>
        </button>

        {/* Notification Panel */}
        {notiOpen && (
          <div
            ref={notiRef}
            className="absolute right-4 top-14 z-50 w-80 rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <span className="text-sm font-bold text-slate-200">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-xs text-primary font-semibold">{unreadCount} mới</span>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/60">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  <Bell size={28} className="mx-auto mb-2 opacity-30" />
                  Chưa có thông báo nào
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <span className={`material-symbols-outlined text-base ${n.color}`}>{n.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 leading-tight">{n.title}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{n.meta}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0 mt-0.5">
                      {new Date(n.time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-700/50 text-center">
                <span className="text-xs text-slate-500">{notifications.length} sự kiện gần nhất</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pl-6 border-l border-primary/10">
          <ConfigProvider theme={{ token: { colorBgElevated: '#1e293b', colorText: '#e2e8f0', colorTextSecondary: '#94a3b8', colorSplit: 'rgba(148,163,184,0.12)', borderRadius: 10 } }}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[120px]">
                    {user?.name || 'Admin'}
                  </p>
                  {/* PRO badge hoặc Provider sub-label */}
                  {isPro ? (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold uppercase tracking-widest leading-none">
                      ⚡ PRO
                    </span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {providerIcon && <span className="opacity-70">{providerIcon}</span>}
                      <p className="text-xs text-slate-500">{providerLabel}</p>
                    </div>
                  )}
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
