import React, { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { Pagination, ConfigProvider, theme } from 'antd';
import { mockProfilesData } from '../../../data/mockProfiles';

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
          <div className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isRunning ? 'bg-primary' : 'bg-slate-700'}`}>
            <span className={`${isRunning ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wide ${isRunning ? 'text-primary' : 'text-slate-500'}`}>{status}</span>
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
    cell: () => (
      <div className="flex items-center justify-end gap-2">
        <button className="p-1.5 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
        <button className="p-1.5 rounded hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-xl">content_copy</span>
        </button>
        <button className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors">
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>
      </div>
    ),
  }),
];

const ProfileTable = () => {
  const [data, setData] = useState(() => mockProfilesData);

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

  return (
    <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-primary/10 overflow-hidden shadow-sm flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-primary/5">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-primary/10 flex items-center justify-end">
        <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgContainer: 'transparent', colorPrimary: '#00bcd4', colorBorder: 'rgba(0,188,212,0.1)' } }}>
          <Pagination
            current={table.getState().pagination.pageIndex + 1}
            pageSize={table.getState().pagination.pageSize}
            total={table.getPrePaginationRowModel().rows.length}
            showSizeChanger
            pageSizeOptions={['10', '20', '50', '100']}
            showTotal={(total, range) => <span className="text-slate-400 mr-4">Showing {range[0]}-{range[1]} of {total} profiles</span>}
            onChange={(page, pageSize) => {
              table.setPageIndex(page - 1);
              table.setPageSize(pageSize);
            }}
          />
        </ConfigProvider>
      </div>
    </div>
  );
};

export default ProfileTable;
