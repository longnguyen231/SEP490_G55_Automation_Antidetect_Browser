import React, { useState } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { Progress, Dropdown, Button } from 'antd';
import { MoreVertical, Settings, Copy, Trash2, Globe } from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { mockProxiesData } from '../data/mockProxies';
import DataTable from './DataTable';

const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor('ip', {
    header: 'IP Address',
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('port', {
    header: 'Port',
    cell: info => <span className="text-slate-500">{info.getValue()}</span>,
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: info => (
      <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded uppercase">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('location', {
    header: () => <div className="text-center">Location</div>,
    cell: info => {
      const location = info.getValue();
      return (
        <div className="flex justify-center">
          <div className="inline-flex items-center justify-center size-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden shrink-0">
            {location.country ? (
              <ReactCountryFlag 
                countryCode={location.country} 
                svg 
                style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', objectFit: 'cover' }}
                title={location.country} 
              />
            ) : (
              <Globe size={16} className="text-slate-500" />
            )}
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => {
      const isLive = info.getValue() === 'Live';
      return (
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${isLive ? 'bg-primary shadow-[0_0_8px_rgba(0,194,203,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></span>
          <span className={`text-xs font-semibold ${isLive ? 'text-primary' : 'text-red-500'}`}>{info.getValue()}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor('latency', {
    header: 'Latency',
    cell: info => {
      const latency = info.getValue();
      const isDead = latency === null;
      let percent = 0;
      let strokeColor = '#94a3b8'; // slate-400
      
      if (!isDead) {
        // Assume max acceptable latency is around 300ms for calculation
        percent = Math.min(100, (latency / 300) * 100);
        strokeColor = latency < 100 ? '#00c2cb' : latency < 200 ? '#eab308' : '#ef4444'; // primary, yellow, red
      }

      return (
        <div className="flex items-center gap-3">
          <div className="flex-1 w-16">
            <Progress 
              percent={isDead ? 100 : percent} 
              showInfo={false} 
              strokeColor={isDead ? '#94a3b8' : strokeColor}
              trailColor="rgba(30, 41, 59, 0.5)"
              size="small"
            />
          </div>
          <span className={`text-xs font-medium ${isDead ? 'text-slate-500' : ''}`}>
            {isDead ? 'N/A' : `${latency} ms`}
          </span>
        </div>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: () => (
      <div className="flex justify-end pr-2">
        <Dropdown menu={{ items: [
          { key: '1', label: 'Check Proxy', icon: <Globe size={14} /> },
          { key: '2', label: 'Edit', icon: <Settings size={14} /> },
          { key: '3', label: 'Copy IP', icon: <Copy size={14} /> },
          { type: 'divider' },
          { key: '4', label: 'Delete', icon: <Trash2 size={14} />, danger: true },
        ] }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreVertical size={20} />} className="p-1.5 rounded hover:!bg-primary/10 !text-slate-400 hover:!text-primary transition-colors flex items-center justify-center h-auto min-w-0 border-none" />
        </Dropdown>
      </div>
    ),
  }),
];

const ProxyTable = () => {
  const [data] = useState(() => mockProxiesData);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return <DataTable table={table} />;
};

export default ProxyTable;
