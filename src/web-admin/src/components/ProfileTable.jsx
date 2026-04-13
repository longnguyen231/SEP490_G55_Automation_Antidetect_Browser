import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { ConfigProvider, Switch, Button } from 'antd';
import { mockProfilesData } from '../dataweb/mockProfiles';
import toast from 'react-hot-toast';
import DataTable from './DataTable';

const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor('name', {
    header: 'Profile Name',
    cell: info => {
      const profile = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-sm">{profile.icon}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-200">{info.getValue()}</p>
            <p className="text-[10px] text-slate-500">{profile.modified}</p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => {
      const status = info.getValue();
      const isRunning = status === 'Running';
      return (
        <div className="flex items-center gap-3">
          <ConfigProvider theme={{ components: { Switch: { colorPrimary: '#00bcd4', colorTextQuaternary: '#334155' } } }}>
            <Switch
              checked={isRunning}
              onChange={(checked) => info.table.options.meta.updateStatus(info.row.index, checked ? 'Running' : 'Stopped')}
              className="shadow-sm"
            />
          </ConfigProvider>
          <span className={`text-xs font-bold uppercase tracking-wide w-16 ${isRunning ? 'text-primary' : 'text-slate-500'}`}>{status}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor('proxy', {
    header: 'Proxy (IP/Country)',
    cell: info => (
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-xs text-slate-500">public</span>
        <span className="text-sm dark:text-slate-300">{info.getValue()}</span>
      </div>
    ),
  }),
  columnHelper.accessor('group', {
    header: 'Group',
    cell: info => {
      const group = info.getValue();
      const groupColors = {
        primary: 'bg-primary/10 text-primary',
        slate: 'bg-slate-500/10 text-slate-500',
        amber: 'bg-amber-500/10 text-amber-500',
      };
      return (
        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${groupColors[group.color]}`}>
          {group.name}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: () => <div className="text-right">Actions</div>,
    cell: (info) => {
      const navigate = info.table.options.meta.navigate;
      const profile = info.row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="text"
            icon={<span className="material-symbols-outlined text-xl pt-[2px]">settings</span>}
            onClick={() => navigate(`/profiles/edit/${profile.id}`)}
            className="p-1.5 rounded hover:!bg-primary/10 !text-slate-400 hover:!text-primary transition-colors flex items-center justify-center h-auto min-w-0"
          />
          <Button
            type="text"
            icon={<span className="material-symbols-outlined text-xl pt-[2px]">content_copy</span>}
            className="p-1.5 rounded hover:!bg-primary/10 !text-slate-400 hover:!text-primary transition-colors flex items-center justify-center h-auto min-w-0"
          />
          <Button
            type="text"
            icon={<span className="material-symbols-outlined text-xl pt-[2px]">delete</span>}
            className="p-1.5 rounded hover:!bg-rose-500/10 !text-slate-400 hover:!text-rose-500 transition-colors flex items-center justify-center h-auto min-w-0 border-none"
          />
        </div>
      );
    },
  }),
];

const ProfileTable = () => {
  const [data, setData] = useState(() => mockProfilesData);
  const navigate = useNavigate();

  const updateStatus = (rowIndex, newStatus) => {
    const profileName = data[rowIndex]?.name;
    if (profileName) {
      toast.success(`Profile ${profileName} is now ${newStatus}`);
    }

    setData((old) =>
      old.map((row, index) => {
        if (index === rowIndex) {
          return {
            ...row,
            status: newStatus,
          };
        }
        return row;
      })
    );
  };

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
    meta: {
      updateStatus,
      navigate,
    },
  });

  return <DataTable table={table} />;
};

export default ProfileTable;
