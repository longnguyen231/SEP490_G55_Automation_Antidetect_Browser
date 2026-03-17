import React from 'react';
import { Input, Badge, Avatar, ConfigProvider, theme } from 'antd';
import { Search, Bell, User } from 'lucide-react';

const Header = () => {
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
          <span className="h-2 w-2 rounded-full bg-primary"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary leading-none">System Online</span>
        </div>
        
        <button className="text-slate-500 hover:text-primary transition-colors flex items-center justify-center mt-1">
          <Badge dot color="#f43f5e" offset={[-2, 4]}>
            <Bell size={22} className="text-slate-500 hover:text-primary transition-colors" />
          </Badge>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-primary/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">Alex Jensen</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <Avatar 
            size={40} 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTZeE4lcD3rTLJIN7QPf6xmNMngrZWIxqohovsaT1w9JroY68p8jUf2q-s1gcwTTNzauTZBx-lJN_gmkSRypzOkD0T1RZbcScl2tD8NVtaRTs9m0OTOEmPvgf2mU6GxpRdHVMX5pnu67a_hHrQ7YdsIRc9hBFLpDUPl5G5lbON-1DxZp4M7C5K-rB6a4tBL1x6oUF9HTuOk_-pO_S_dLlrW90b5R-K0fMZ-mkoWB3X2sl1ZOdt4p_n5k5a7RuV0K_J-3rVnGbk0Hyg" 
            icon={<User />} 
            className="border border-primary/30 cursor-pointer hover:border-primary transition-colors"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
