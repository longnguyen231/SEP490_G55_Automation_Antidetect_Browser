import React from 'react';

const Header = () => {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-primary/10 backdrop-blur-md z-10 dark:bg-background-dark">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary">search</span>
          <input className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-500" placeholder="Search profiles, proxies, or team members..." type="text"/>
        </div>
      </div>
      
      <div className="flex items-center gap-6 ml-8">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <span className="flex h-2 w-2 rounded-full bg-primary"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">System Online</span>
        </div>
        
        <button className="relative text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-0 right-0 h-2 w-2 bg-rose-500 rounded-full border-2 border-background-dark"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-primary/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">Alex Jensen</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
            <img className="w-full h-full object-cover" alt="User profile avatar component" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTZeE4lcD3rTLJIN7QPf6xmNMngrZWIxqohovsaT1w9JroY68p8jUf2q-s1gcwTTNzauTZBx-lJN_gmkSRypzOkD0T1RZbcScl2tD8NVtaRTs9m0OTOEmPvgf2mU6GxpRdHVMX5pnu67a_hHrQ7YdsIRc9hBFLpDUPl5G5lbON-1DxZp4M7C5K-rB6a4tBL1x6oUF9HTuOk_-pO_S_dLlrW90b5R-K0fMZ-mkoWB3X2sl1ZOdt4p_n5k5a7RuV0K_J-3rVnGbk0Hyg"/>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
