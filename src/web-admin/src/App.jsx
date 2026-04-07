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
import LoginPage from './pages/Auth/Login';
import RegisterPage from './pages/Auth/Register';
import { AdminRoute, GuestRoute } from './components/ProtectedRoute';

function App() {
  return (
    <ConfigProvider theme={{ token: { fontFamily: '"Inter", sans-serif' } }}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{ className: 'dark:bg-slate-800 dark:text-white border border-primary/20' }}
        />
        <Routes>
          {/* ── Public ───────────────────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Auth (guest-only, redirect if already logged in) ─────────── */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />

          {/* ── Admin dashboard (requires role === 'admin') ──────────────── */}
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="profiles" element={<Profiles />} />
            <Route path="profiles/edit/:id" element={<EditProfile />} />
            <Route path="proxies" element={<Proxies />} />
            <Route path="groups" element={<Groups />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* ── Fallback: mọi path không khớp → landing page ────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
