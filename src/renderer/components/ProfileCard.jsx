import React from 'react';

// Common SVG Icons we can use without dependencies
const ChromiumIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
);

const AppleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2.04C10.5 2.04 9 3.54 9 5c1.5 0 3-1.5 3-2.96zm1.2 19.33c-.71.55-1.55.84-3.2.84-1.65 0-2.49-.29-3.2-.84-2.1-1.65-4.8-6.15-4.8-10.35 0-3.3 2.1-5.1 4.5-5.1 1.2 0 2.4.6 3.3 1.2.9-.6 2.1-1.2 3.3-1.2 2.4 0 4.5 1.8 4.5 5.1 0 4.2-2.7 8.7-4.8 10.35z"/>
  </svg>
);

const FoxIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 6s-2-2-5-2-4 2-4 2-2-2-4-2-5 2-5 2l1.6 4.8c0 0-1.6 3.2-1.6 6.4 0 3.2 2.4 4.8 4 4.8s4-2 6-2 4.4 2 6 2 4-1.6 4-4.8c0-3.2-1.6-6.4-1.6-6.4L22 6z"/>
  </svg>
);

const MonitorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export default function ProfileCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flexItems gap-4 shadow-sm hover:shadow-md transition-shadow flex items-start">
      
      {/* Active Dot indicator */}
      <div className="pt-[14px] pl-2">
        <div className="w-2.5 h-2.5 bg-slate-400 rounded-full"></div>
      </div>

      {/* Card Content Area - Taking most space */}
      <div className="flex-1 flex flex-col gap-3 ml-2">
        
        {/* Top Row: Details */}
        <div className="flex items-center gap-3">
          <span className="bg-[#e2e8f0] text-[#64748b] text-[11px] font-bold px-2 py-0.5 rounded align-middle uppercase">
            3XtaGA
          </span>
          
          <div className="bg-[#e0f2fe] text-[#0284c7] px-2 py-0.5 rounded flex items-center gap-1.5 text-xs font-semibold">
            <ChromiumIcon />
            Chromium
          </div>
          
          <h3 className="text-xl font-semibold text-slate-800 leading-none">Profile 2210</h3>
        </div>

        {/* Middle Row: OS and Screen Specs */}
        <div className="flex items-center gap-2 pl-[4px]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
            <span className="text-red-500"><AppleIcon /></span>
            MACINTEL
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
            <FoxIcon />
            Firefox
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
            <div className="text-slate-400"><MonitorIcon /></div>
            1536x864
          </div>
        </div>

        {/* Bottom Row: Badges */}
        <div className="flex items-center gap-1.5 pl-[4px]">
          {['ID', 'DSP', 'HW', 'CVS', 'GL', 'AUD', 'MED', 'NET', 'BAT'].map(badge => (
            <span key={badge} className="bg-[#cbd5e1] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
              {badge}
            </span>
          ))}
        </div>
        
      </div>

      {/* Right Side Actions Container - Flexed to middle right */}
      <div className="pt-2 flex items-center gap-2 self-start flex-wrap justify-end">
        <button className="bg-[#10b981] hover:bg-[#059669] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Launch
        </button>
        <button className="bg-[#94a3b8] hover:bg-[#64748b] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Headless
        </button>
        <button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Proxy
        </button>
        <button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Clone
        </button>
        <button className="bg-[#94a3b8] hover:bg-[#64748b] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Edit
        </button>
        <button className="bg-[#ef4444] hover:bg-[#dc2626] text-white font-medium text-[13px] px-3.5 py-1.5 rounded transition">
          Delete
        </button>
      </div>

    </div>
  );
}
