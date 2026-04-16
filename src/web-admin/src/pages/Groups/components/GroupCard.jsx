import React from 'react';
import { Button, Dropdown } from 'antd';
import { MoreVertical, StopCircle, PlayCircle, Trash2, Settings, Archive } from 'lucide-react';

const GroupCard = ({ group }) => {
  const isRunning = group.status === 'Running';
  
  return (
    <div className="group bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-primary/50 transition-all flex flex-col h-full">
      <div className="h-32 relative shrink-0">
        <div className={`absolute inset-0 bg-gradient-to-br ${group.gradient}`}></div>
        <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full border uppercase ${
          isRunning 
            ? 'bg-primary/10 text-primary border-primary/20' 
            : group.status === 'Paused'
            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
        }`}>
          {group.status}
        </div>
        <div className="absolute bottom-4 left-4 flex -space-x-2">
          {group.tags.map((tag, idx) => (
            <div 
              key={idx} 
              className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 ${group.tagColors[idx]} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{group.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{group.profilesCount} Profiles • Last active {group.lastActive}</p>
          </div>
          <Dropdown 
            menu={{ items: [
              { key: '1', label: 'Edit Group', icon: <Settings size={14} /> },
              { key: '2', label: 'Archive', icon: <Archive size={14} /> },
              { type: 'divider' },
              { key: '3', label: 'Delete', icon: <Trash2 size={14} />, danger: true },
            ] }} 
            trigger={['click']}
          >
            <Button type="text" icon={<MoreVertical size={20} />} className="!text-slate-400 hover:!text-primary transition-colors flex items-center justify-center h-auto min-w-0 p-1" />
          </Dropdown>
        </div>
        
        <div className="mt-auto flex items-center gap-2">
          {isRunning ? (
            <Button 
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-200 dark:bg-slate-800 !text-slate-600 dark:!text-slate-300 rounded text-xs font-bold hover:!bg-rose-500/10 hover:!text-red-500 transition-colors border-none h-9"
            >
              <StopCircle size={16} />
              <span>Stop all</span>
            </Button>
          ) : (
            <Button 
              type="primary"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-white rounded text-xs font-bold hover:opacity-90 transition-opacity h-9"
            >
              <PlayCircle size={16} />
              <span>Start all</span>
            </Button>
          )}
          <Button 
            type="text" 
            icon={<Trash2 size={18} />} 
            className="!text-slate-400 hover:!text-red-500 transition-colors flex items-center justify-center" 
          />
        </div>
      </div>
    </div>
  );
};

export default GroupCard;
