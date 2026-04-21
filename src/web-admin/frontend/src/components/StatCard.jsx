import React from 'react';

const StatCard = ({ title, value, change, icon, iconClass = 'text-primary', titleClass = 'text-slate-500' }) => {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');
  
  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
      <div>
        <h3 className={`text-xs uppercase font-bold tracking-widest mb-1 ${titleClass}`}>{title}</h3>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold dark:text-white">{value}</p>
          {change && (
            <span className={`text-sm font-semibold mb-1 ${
              isPositive ? 'text-emerald-500' : isNegative ? 'text-rose-500' : 'text-slate-400'
            }`}>
              {change}
            </span>
          )}
        </div>
      </div>
      {icon && (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className={`material-symbols-outlined text-2xl ${iconClass}`}>
            {icon}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
