import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const AdminLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden text-slate-900 bg-background-light dark:bg-background-dark dark:text-slate-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50 dark:bg-background-dark">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
