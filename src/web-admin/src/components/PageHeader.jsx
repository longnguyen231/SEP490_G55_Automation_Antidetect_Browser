import React from 'react';
import { ConfigProvider, theme } from 'antd';

const PageHeader = ({ title, description, extra }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        )}
      </div>
      {extra && (
        <div className="flex items-center gap-3">
          {extra}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
