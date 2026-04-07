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
import EditProfile from './pages/Profiles/EditProfile';
import LandingPage from './pages/Landing';

function App() {
  return (
    <ConfigProvider theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white border border-primary/20' }} />
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* Admin dashboard (protected layout) */}
          <Route path="/dashboard" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="profiles" element={<Profiles />} />
            <Route path="profiles/edit/:id" element={<EditProfile />} />
            <Route path="proxies" element={<Proxies />} />
            <Route path="groups" element={<Groups />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Legacy short paths → keep working */}
          <Route path="/profiles" element={<Navigate to="/dashboard/profiles" replace />} />
          <Route path="/proxies" element={<Navigate to="/dashboard/proxies" replace />} />
          <Route path="/groups" element={<Navigate to="/dashboard/groups" replace />} />
          <Route path="/team" element={<Navigate to="/dashboard/team" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
