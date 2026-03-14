import React from 'react';

const StatCard = ({ title, value, change, icon, iconClass = "text-primary" }) => {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');
  const changeColor = isPositive ? 'text-emerald-500' : isNegative ? 'text-rose-500' : 'text-slate-500';

  return (
    <div className="bg-white dark:bg-slate-800/40 p-6 rounded-xl border border-primary/5 hover:border-primary/20 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</span>
        <span className={`material-symbols-outlined ${iconClass}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        {change && (
          <span className={`text-xs font-bold ${changeColor}`}>{change}</span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
