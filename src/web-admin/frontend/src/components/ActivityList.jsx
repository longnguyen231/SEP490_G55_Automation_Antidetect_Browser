import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

const ActivityList = ({ activities }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
      {activities.map((activity) => (
        <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
              activity.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-500'
            }`}>
              {activity.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{activity.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activity.description}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 shrink-0">{activity.time}</span>
        </div>
      ))}
    </div>
  );
};

export default ActivityList;
