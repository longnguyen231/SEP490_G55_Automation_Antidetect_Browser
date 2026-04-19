import React from 'react';
import { flexRender } from '@tanstack/react-table';
import { Pagination, ConfigProvider, theme } from 'antd';

const DataTable = ({ table }) => {
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
            showTotal={(total, range) => <span className="text-slate-400 mr-4">Showing {range[0]}-{range[1]} of {total} entries</span>}
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

export default DataTable;
