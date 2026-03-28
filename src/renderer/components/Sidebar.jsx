import React from 'react';

const MENU_ITEMS = [
  'Profiles',
  'Proxies',
  'Scripts',
  'Logs',
  'Settings'
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <div className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col pt-8">
      {/* Brand */}
      <div className="px-6 mb-8 mt-2 sticky top-0 bg-white">
        <h2 className="text-xl font-extrabold text-[#1f2937] leading-tight flex items-center gap-1.5">
          {/* Logo mock icon */}
          <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex items-center justify-center p-0.5" style={{ background: '#f8fafc' }}>
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
          </div>
          HL-MCKBrowser
        </h2>
        <span className="text-[13px] text-gray-400 font-medium tracking-wide">
          Antidetect Manager
        </span>
      </div>

      <div className=" border-b border-[#f1f5f9] mb-4"></div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col px-4 gap-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`
              w-full text-left px-4 py-3 rounded-lg font-medium text-[15px] transition-all
              ${
                activeTab === item
                  ? 'bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]'
                  : 'text-[#4b5563] hover:bg-[#xf1f5f9] hover:text-[#1f2937]'
              }
            `}
          >
            {item}
          </button>
        ))}
      </nav>
    </div>
  );
}
