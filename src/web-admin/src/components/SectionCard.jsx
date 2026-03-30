import React from 'react';

const SectionCard = ({ title, icon, extra, children }) => {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 flex justify-between items-center text-slate-900 dark:text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon && <span className="material-symbols-outlined text-primary">{icon}</span>}
          {title}
        </h2>
        {extra && <div className="flex items-center">{extra}</div>}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
