import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from 'antd';

const InfoBanner = ({ title, description, icon: Icon, actionText, onAction }) => {
  return (
    <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {Icon ? <Icon size={24} /> : <Settings size={24} />}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
      </div>
      {actionText && (
        <Button 
          type="link" 
          onClick={onAction}
          className="p-0 h-auto text-sm font-semibold text-primary hover:text-primary/80 flex items-center gap-2 transition-colors border-none"
        >
          <span>{actionText}</span>
          <Settings size={16} />
        </Button>
      )}
    </div>
  );
};

export default InfoBanner;
