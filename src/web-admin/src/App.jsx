import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider } from 'antd';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Profiles from './pages/Profiles';
import Proxies from './pages/Proxies';
import Groups from './pages/Groups';
import Team from './pages/Team';
import Settings from './pages/Settings';

function App() {
  return (
    <ConfigProvider theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white border border-primary/20' }} />
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profiles" element={<Profiles />} />
            <Route path="proxies" element={<Proxies />} />
            <Route path="groups" element={<Groups />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
